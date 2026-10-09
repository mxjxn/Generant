"""Live OSC receiver and zero-setup performance visualizer."""

import math
import socket
import struct
import time
from collections import deque

import bpy
from bpy.props import IntProperty

from . import baker
from . import protocol


_socket = None
_timer_running = False
_scheduled = []
_events = deque(maxlen=10)
_voices = {}
_tracks = {}
_controls = {}
_received = 0
_last_error = ""


def _read_string(data, offset):
    end = data.find(b"\0", offset)
    if end < 0:
        raise ValueError("unterminated OSC string")
    value = data[offset:end].decode("utf8")
    return value, (end + 4) & ~3


def decode_packet(data, inherited_time=None, depth=0):
    """Decode messages and bundles emitted by the companion."""
    if depth > 8 or len(data) < 4:
        raise ValueError("invalid OSC packet")
    if data[:8] == b"#bundle\0":
        if len(data) < 16:
            raise ValueError("truncated OSC bundle")
        high, low = struct.unpack_from(">II", data, 8)
        due = inherited_time if (high, low) == (0, 1) else high + low / 2**32 - 2208988800
        offset = 16
        result = []
        while offset < len(data):
            size = struct.unpack_from(">i", data, offset)[0]
            offset += 4
            if size < 1 or offset + size > len(data):
                raise ValueError("invalid OSC bundle element")
            result.extend(decode_packet(data[offset:offset + size], due, depth + 1))
            offset += size
        return result

    address, offset = _read_string(data, 0)
    tags, offset = _read_string(data, offset)
    if not address.startswith("/") or not tags.startswith(","):
        raise ValueError("invalid OSC message")
    args = []
    for tag in tags[1:]:
        if tag == "s":
            value, offset = _read_string(data, offset)
        elif tag == "i":
            value = struct.unpack_from(">i", data, offset)[0]
            offset += 4
        elif tag == "f":
            value = struct.unpack_from(">f", data, offset)[0]
            offset += 4
        elif tag == "d":
            value = struct.unpack_from(">d", data, offset)[0]
            offset += 8
        elif tag in "TF":
            value = tag == "T"
        else:
            raise ValueError(f"unsupported OSC type {tag}")
        args.append(value)
    return [(inherited_time, address, args)]


def _midi(freq):
    if not isinstance(freq, (int, float)) or freq <= 0:
        return None
    return round(69 + 12 * math.log2(freq / 440))


def _note_name(note):
    if note is None:
        return "--"
    return f"{('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B')[note % 12]}{note // 12 - 1}"


def _safe_name(track):
    return "".join(char if char.isalnum() or char in "_-" else "_" for char in track)


def _track_object(track):
    for obj in bpy.data.objects:
        if obj.get("osc_bridge_track") == track:
            return obj
    return None


def _make_track_object(track, index):
    obj = _track_object(track)
    if obj:
        return obj
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=((index - 1) * 3.2, 0, 1))
    obj = bpy.context.object
    obj.name = f"OSC_{_safe_name(track)}"
    obj["osc_bridge_track"] = track
    obj["osc_bridge_base_x"] = obj.location.x
    obj["osc_bridge_base_z"] = obj.location.z
    obj.color = ((0.35, 0.9, 0.45, 1), (0.95, 0.35, 0.2, 1), (0.3, 0.55, 1, 1))[index % 3]
    return obj


def create_demo_rig():
    collection = bpy.data.collections.get("OSC Visual Rig")
    if collection is None:
        collection = bpy.data.collections.new("OSC Visual Rig")
        bpy.context.scene.collection.children.link(collection)
    tracks = list(_tracks) or ["bass", "drums", "pad"]
    for index, track in enumerate(tracks):
        obj = _make_track_object(track, index)
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)
    return len(tracks)


def _update_visual(track):
    state = _tracks[track]
    obj = _track_object(track)
    settings = getattr(bpy.context.scene, "osc_bridge_settings", None)
    performance_scene_exists = bpy.data.collections.get("OSC Performance Scene") is not None
    if obj is None and settings and settings.live_auto_objects and not performance_scene_exists:
        obj = _make_track_object(track, len(_tracks) - 1)
    if obj is None:
        return
    count = len(state["voices"])
    amp = max((voice["params"].get("amp", 0.15) for voice in state["voices"].values()), default=0)
    notes = [voice["note"] for voice in state["voices"].values() if voice["note"] is not None]
    pulse = 1 + min(2.5, count * 0.22 + amp * 3.5)
    obj.scale = (pulse, pulse, pulse)
    obj.location.z = obj.get("osc_bridge_base_z", 1) + (max(notes) - 48) / 24 if notes else obj.get("osc_bridge_base_z", 1)
    obj.rotation_euler.z += 0.12 + count * 0.035 if count else 0


def _apply_control_mappings(control_name, raw_value):
    settings = getattr(bpy.context.scene, "osc_bridge_settings", None)
    if settings is None:
        return
    track_name = protocol.control_track(control_name)
    for mapping in settings.mappings:
        if mapping.track_name != track_name:
            continue
        obj_name = mapping.target_object.strip()
        if not obj_name:
            raise ValueError(f"Mapping '{track_name}' has no target object")
        obj = bpy.data.objects.get(obj_name)
        if obj is None:
            raise ValueError(f"Object '{obj_name}' not found for '{track_name}'")
        mapped = baker.remap(
            raw_value,
            mapping.in_min,
            mapping.in_max,
            mapping.out_min,
            mapping.out_max,
        )
        baker.set_live_property_value(
            obj,
            mapping.target_data_path,
            mapping.target_array_index,
            mapped,
        )


def _reset_transport():
    from . import cues
    cues.reset_live()
    protocol.reset_transport_state(_scheduled, _voices, _tracks)
    _controls.clear()
    from . import performance_scene
    performance_scene.reset_live()
    _events.appendleft("RESET transport")


def _handle(address, args):
    global _received
    _received += 1
    now = time.time()
    if address == "/companion/note" and len(args) >= 3:
        track, node, synth = str(args[0]), int(args[1]), str(args[2])
        params = protocol.pairs(args[3:])
        note = _midi(params.get("freq"))
        end_at = protocol.compute_voice_end(now, synth, params)
        _voices[node] = {"track": track, "synth": synth, "note": note, "params": params, "at": now, "end_at": end_at}
        state = _tracks.setdefault(track, {"synth": synth, "voices": {}, "last": now})
        state.update(synth=synth, last=now)
        state["voices"][node] = _voices[node]
        _events.appendleft(f"ON  {track:<8} {_note_name(note):<4}  {synth}")
        _update_visual(track)
        from . import performance_scene
        if track == "drums":
            performance_scene.trigger_drum(params.get("type", 0), params.get("amp", 0.2), note or 36)
        elif track == "bass":
            performance_scene.trigger_bass(note, params.get("amp", 0.15))
        elif track == "pad":
            performance_scene.set_pad(params.get("spread", 0.8), params.get("amp", 0.08), len(state["voices"]))
    elif address == "/companion/set" and len(args) >= 2:
        track, node = str(args[0]), int(args[1])
        params = protocol.pairs(args[2:])
        voice = _voices.get(node)
        if voice:
            voice["params"].update(params)
            if "freq" in params:
                voice["note"] = _midi(params["freq"])
            new_end = protocol.compute_voice_end(now, voice["synth"], voice["params"])
            if new_end is not None:
                voice["end_at"] = new_end
            if float(params.get("gate", 1)) <= 0:
                _voices.pop(node, None)
                _tracks.get(track, {}).get("voices", {}).pop(node, None)
                _events.appendleft(f"OFF {track:<8} {_note_name(voice['note']):<4}  {voice['synth']}")
            else:
                _events.appendleft(f"SET {track:<8} node {node}")
            if track in _tracks:
                _tracks[track]["last"] = now
                _update_visual(track)
    elif address == "/companion/free" and len(args) >= 2:
        node = int(args[1])
        voice = _voices.pop(node, None)
        if voice:
            _tracks[voice["track"]]["voices"].pop(node, None)
            _events.appendleft(f"OFF {voice['track']:<8} {_note_name(voice['note'])}")
            _update_visual(voice["track"])
    elif address == "/companion/choke" and args:
        track = str(args[0])
        for node, voice in list(_voices.items()):
            if voice["track"] == track and int(voice["params"].get("type", -1)) in (2, 3):
                _voices.pop(node, None)
                _tracks[track]["voices"].pop(node, None)
        _events.appendleft(f"CHOKE {track}")
        _update_visual(track)
    elif address == "/rack/control" and len(args) >= 2:
        name = str(args[0]).strip()
        value = protocol.clamp_normalized(args[1])
        if not name or value is None:
            return
        _controls[name] = {"value": value, "at": now}
        _events.appendleft(f"CTL {name:<12} {value:.2f}")
        _apply_control_mappings(name, value)
    elif address in {"/rack/reset", "/companion/reset", "/transport/reset"}:
        _reset_transport()
    else:
        from . import cues
        cues.apply_live(address, args)
        _events.appendleft(f"CUE {address} {args}")


def _poll():
    global _last_error, _timer_running
    if _socket is None:
        _timer_running = False
        return None
    try:
        while True:
            try:
                data, _sender = _socket.recvfrom(65535)
            except BlockingIOError:
                break
            for event in decode_packet(data):
                if event[1] in {"/rack/reset", "/companion/reset", "/transport/reset"}:
                    _reset_transport()
                else:
                    _scheduled.append(event)
        now = time.time()
        due, future = protocol.split_due_events(_scheduled, now)
        _scheduled[:] = future
        for _at, address, args in sorted(due, key=lambda e: e[0] or 0):
            _handle(address, args)
        for track in protocol.expire_voices(_voices, _tracks, now):
            _events.appendleft(f"OFF {track:<8} auto")
            _update_visual(track)
        for track, state in _tracks.items():
            if not state["voices"]:
                obj = _track_object(track)
                if obj:
                    obj.scale += ((1 - obj.scale.x) * 0.18,) * 3
        from . import performance_scene
        performance_scene.update_live()
        for area in (area for screen in bpy.data.screens for area in screen.areas if area.type == "VIEW_3D"):
            area.tag_redraw()
    except Exception as exc:
        _last_error = str(exc)
    return 1 / 30


def start(port):
    global _socket, _timer_running, _last_error
    stop()
    _socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    _socket.setblocking(False)
    _socket.bind(("127.0.0.1", port))
    _last_error = ""
    if not _timer_running:
        _timer_running = True
        bpy.app.timers.register(_poll, first_interval=0.01, persistent=True)


def stop():
    global _socket
    if _socket:
        _socket.close()
        _socket = None
    _reset_transport()


def is_listening():
    return _socket is not None


class OSCBRIDGE_OT_live_toggle(bpy.types.Operator):
    bl_idname = "oscbridge.live_toggle"
    bl_label = "Start Live Input"

    def execute(self, context):
        if is_listening():
            stop()
            self.report({"INFO"}, "Live OSC stopped")
        else:
            try:
                start(context.scene.osc_bridge_settings.live_port)
            except OSError as exc:
                self.report({"ERROR"}, f"Cannot listen: {exc}")
                return {"CANCELLED"}
            self.report({"INFO"}, "Listening for musical OSC")
        return {"FINISHED"}


class OSCBRIDGE_OT_demo_rig(bpy.types.Operator):
    bl_idname = "oscbridge.demo_rig"
    bl_label = "Create / Refresh Visual Rig"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        count = create_demo_rig()
        self.report({"INFO"}, f"Visual rig ready for {count} tracks")
        return {"FINISHED"}


class OSCBRIDGE_OT_transport_reset(bpy.types.Operator):
    bl_idname = "oscbridge.transport_reset"
    bl_label = "Reset Transport"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        _reset_transport()
        self.report({"INFO"}, "Transport reset")
        return {"FINISHED"}


class OSCBRIDGE_PT_live(bpy.types.Panel):
    bl_label = "Live Performance"
    bl_idname = "OSCBRIDGE_PT_live"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "OSC Bridge"
    bl_parent_id = "OSCBRIDGE_PT_main"
    bl_order = 0

    def draw(self, context):
        layout = self.layout
        settings = context.scene.osc_bridge_settings
        row = layout.row(align=True)
        row.prop(settings, "live_port", text="UDP")
        row.operator("oscbridge.live_toggle", text="Stop" if is_listening() else "Listen", icon="PAUSE" if is_listening() else "PLAY")
        row.operator("oscbridge.transport_reset", text="", icon="FILE_REFRESH")
        layout.prop(settings, "live_auto_objects")
        layout.operator("oscbridge.build_performance_scene", icon="SCENE_DATA")
        layout.operator("oscbridge.bake_performance_scene", icon="ACTION")
        layout.operator("oscbridge.demo_rig", icon="OUTLINER_COLLECTION")
        status = "LISTENING" if is_listening() else "STOPPED"
        layout.label(text=f"{status} · {_received} events", icon="RADIOBUT_ON" if is_listening() else "RADIOBUT_OFF")
        if _last_error:
            layout.label(text=_last_error[:80], icon="ERROR")
        if _controls:
            control_box = layout.box()
            control_box.label(text="Controls", icon="EMPTY_SINGLE_ARROW")
            for name, info in sorted(_controls.items()):
                row = control_box.row(align=True)
                row.label(text=f"{name}: {info['value']:.2f}")
                op = row.operator("oscbridge.add_mapping", text="Map", icon="CON_FOLLOWPATH")
                op.track_name = protocol.control_track(name)
        for track, state in sorted(_tracks.items()):
            box = layout.box()
            row = box.row()
            row.label(text=track, icon="SPEAKER")
            row.label(text=f"{state['synth']} · {len(state['voices'])} active")
            notes = ", ".join(_note_name(voice["note"]) for voice in state["voices"].values()) or "—"
            box.label(text=f"Notes: {notes}")
            if state["voices"]:
                voice = next(reversed(state["voices"].values()))
                values = voice["params"]
                shown = [f"{key} {float(values[key]):.2f}" for key in ("amp", "cutoff", "glide", "type") if key in values]
                if shown:
                    box.label(text=" · ".join(shown))
        if not _tracks:
            layout.label(text="Press Play or trigger ~wcNote in SuperCollider", icon="INFO")
        if _events:
            layout.separator()
            layout.label(text="Recent events")
            for event in list(_events)[:6]:
                layout.label(text=event)


classes = (
    OSCBRIDGE_OT_live_toggle,
    OSCBRIDGE_OT_demo_rig,
    OSCBRIDGE_OT_transport_reset,
    OSCBRIDGE_PT_live,
)
