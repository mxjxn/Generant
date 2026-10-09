"""Procedural portrait tunnel scene driven by live musical OSC."""

import math
import os
import time

import bpy
from mathutils import Vector


COLLECTION = "OSC Performance Scene"
RING_POOL = 36
RING_COLORS = (
    (1.0, 0.16, 0.05, 1.0),
    (1.0, 0.75, 0.08, 1.0),
    (0.1, 0.9, 1.0, 1.0),
    (0.65, 0.12, 1.0, 1.0),
    (0.15, 1.0, 0.45, 1.0),
    (1.0, 0.2, 0.72, 1.0),
)

_active_rings = []
_floor_pulses = {}
_pad_target = 0.0
_last_update = time.monotonic()


def _collection():
    return bpy.data.collections.get(COLLECTION)


def _link_only(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def _material(name, color, metallic=0.0, roughness=0.35, emission=0.0, transmission=0.0, alpha=1.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color[:3], alpha)
    node = material.node_tree.nodes.get("Principled BSDF")
    if node:
        node.inputs["Base Color"].default_value = (*color[:3], 1)
        node.inputs["Metallic"].default_value = metallic
        node.inputs["Roughness"].default_value = roughness
        emission_input = node.inputs.get("Emission Color") or node.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (*color[:3], 1)
        strength_input = node.inputs.get("Emission Strength")
        if strength_input:
            strength_input.default_value = emission
        transmission_input = node.inputs.get("Transmission Weight") or node.inputs.get("Transmission")
        if transmission_input:
            transmission_input.default_value = transmission
        alpha_input = node.inputs.get("Alpha")
        if alpha_input:
            alpha_input.default_value = alpha
    if alpha < 1:
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
            material.use_transparency_overlap = False
        elif hasattr(material, "blend_method"):
            material.blend_method = "BLEND"
    return material


def _look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def _mesh_ring(name, segments, pattern):
    vertices = []
    faces = []
    for index in range(segments):
        if pattern == 1 and index % 3 == 2:
            continue
        if pattern == 4 and index % 4 not in (0, 1):
            continue
        angle = 2 * math.pi * index / segments
        span = 2 * math.pi / segments * (0.42 if pattern == 2 else 0.72)
        radius = 2.5 + (0.22 * math.sin(index * 2.4) if pattern == 5 else 0)
        thickness = 0.10 + pattern * 0.018
        start = len(vertices)
        for y in (-thickness, thickness):
            for radial, offset in ((radius - thickness, -span), (radius + thickness, -span),
                                   (radius + thickness, span), (radius - thickness, span)):
                theta = angle + offset
                vertices.append((math.cos(theta) * radial, y, math.sin(theta) * radial))
        faces.extend([
            (start, start + 1, start + 2, start + 3),
            (start + 4, start + 7, start + 6, start + 5),
            (start, start + 4, start + 5, start + 1),
            (start + 1, start + 5, start + 6, start + 2),
            (start + 2, start + 6, start + 7, start + 3),
            (start + 3, start + 7, start + 4, start),
        ])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def _clear_collection(collection):
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def _build_camera(collection):
    camera_data = bpy.data.cameras.new("OSC Portrait Camera")
    camera = bpy.data.objects.new("OSC Portrait Camera", camera_data)
    collection.objects.link(camera)
    camera.location = (0, 7.5, 3.1)
    camera_data.lens = 28
    camera_data.sensor_width = 32
    _look_at(camera, (0, -14, 2.7))
    bpy.context.scene.camera = camera


def _build_floor(collection):
    dark = _material("OSC Floor Dark", (0.012, 0.018, 0.028, 1), metallic=0.72, roughness=0.24)
    edge = _material("OSC Floor Edge", (0.04, 0.65, 0.85, 1), metallic=0.45, roughness=0.2, emission=1.6)
    for row in range(44):
        y = 9 - row * 2
        for column in range(5):
            x = (column - 2) * 1.55
            bpy.ops.mesh.primitive_cube_add(location=(x, y, -0.15), scale=(0.7, 0.88, 0.10))
            tile = bpy.context.object
            tile.name = f"OSC_Tile_{row:02}_{column}"
            tile["osc_tile_row"] = row
            tile["osc_base_y"] = y
            tile["osc_base_z"] = -0.15
            tile.data.materials.append(edge if (row + column) % 11 == 0 else dark)
            bevel = tile.modifiers.new("Soft edges", "BEVEL")
            bevel.width = 0.055
            bevel.segments = 2
            _link_only(tile, collection)


def _wall_mesh(name, side):
    vertices = []
    faces = []
    segments = 48
    for index in range(segments + 1):
        y = 10 - index * 1.65
        for z in (0.0, 7.5):
            vertices.append((side * 4.25, y, z))
    for index in range(segments):
        base = index * 2
        faces.append((base, base + 2, base + 3, base + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def _build_walls(collection):
    glass = _material("OSC Glass", (0.12, 0.48, 0.62, 1), roughness=0.14, emission=0.28, transmission=0.86, alpha=0.20)
    texture = bpy.data.textures.get("OSC Wall Noise") or bpy.data.textures.new("OSC Wall Noise", type="CLOUDS")
    texture.noise_scale = 0.65
    texture.noise_depth = 2
    for side, label in ((-1, "Left"), (1, "Right")):
        wall = bpy.data.objects.new(f"OSC Glass Wall {label}", _wall_mesh(f"OSC Wall Mesh {label}", side))
        collection.objects.link(wall)
        wall.data.materials.append(glass)
        solid = wall.modifiers.new("Glass thickness", "SOLIDIFY")
        solid.thickness = 0.035
        displace = wall.modifiers.new("Pad spread", "DISPLACE")
        displace.texture = texture
        displace.texture_coords = "GLOBAL"
        displace.direction = "X"
        displace.strength = 0.12
        wall["osc_wall"] = True


def _build_rings(collection):
    meshes = [_mesh_ring(f"OSC Ring Pattern {kind}", 12 + kind * 3, kind) for kind in range(6)]
    materials = [_material(f"OSC Ring Color {kind}", color, metallic=0.15, roughness=0.22, emission=2.5)
                 for kind, color in enumerate(RING_COLORS)]
    for index in range(RING_POOL):
        kind = index % 6
        ring = bpy.data.objects.new(f"OSC_Ring_{index:02}", meshes[kind])
        collection.objects.link(ring)
        ring.data.materials.append(materials[kind])
        ring["osc_ring"] = True
        ring["osc_ring_kind"] = kind
        ring.hide_viewport = True
        ring.hide_render = True


def _build_lights(collection):
    for name, location, color, energy in (
        ("OSC Key", (0, 2, 7), (0.15, 0.65, 1), 850),
        ("OSC Rim", (-4, -12, 4), (0.8, 0.08, 1), 650),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = 6
        light = bpy.data.objects.new(name, data)
        light.location = location
        _look_at(light, (0, -10, 1))
        collection.objects.link(light)


def _build_compositor(scene):
    scene.use_nodes = True
    tree = getattr(scene, "node_tree", None) or getattr(scene, "compositing_node_group", None)
    if tree is None:
        tree = bpy.data.node_groups.new("OSC Performance Compositor", "CompositorNodeTree")
        scene.compositing_node_group = tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    render = nodes.new("CompositorNodeRLayers")
    glare = nodes.new("CompositorNodeGlare")
    if hasattr(glare, "glare_type"):
        glare.glare_type = "FOG_GLOW"
        glare.quality = "HIGH"
        glare.threshold = 0.7
        glare.size = 7
        composite = nodes.new("CompositorNodeComposite")
    else:
        glare.inputs["Type"].default_value = "Fog Glow"
        glare.inputs["Quality"].default_value = "High"
        glare.inputs["Threshold"].default_value = 0.7
        glare.inputs["Size"].default_value = 0.72
        tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        composite = nodes.new("NodeGroupOutput")
    links.new(render.outputs["Image"], glare.inputs["Image"])
    links.new(glare.outputs["Image"], composite.inputs["Image"])


def build_scene():
    global _active_rings, _floor_pulses, _pad_target
    scene = bpy.context.scene
    collection = _collection()
    if collection is None:
        collection = bpy.data.collections.new(COLLECTION)
        scene.collection.children.link(collection)
    _clear_collection(collection)
    _active_rings = []
    _floor_pulses = {}
    _pad_target = 0

    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1080
    scene.render.resolution_y = 1920
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 800
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.002, 0.004, 0.009)
    scene["osc_bpm"] = 108.0
    scene["osc_loop_bars"] = 12

    _build_camera(collection)
    _build_floor(collection)
    _build_walls(collection)
    _build_rings(collection)
    _build_lights(collection)
    _build_compositor(scene)
    install_frame_handler()

    # A subtle repeating camera sway; frame 801 duplicates frame 1.
    camera = scene.camera
    for frame, x in ((1, 0.0), (201, 0.22), (401, 0.0), (601, -0.22), (801, 0.0)):
        camera.location.x = x
        camera.keyframe_insert("location", frame=frame, index=0)
    if camera.animation_data and camera.animation_data.action:
        for curves in getattr(camera.animation_data.action, "layers", []):
            for strip in getattr(curves, "strips", []):
                for bag in getattr(strip, "channelbags", []):
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:
                            point.interpolation = "BEZIER"
    scene.frame_set(1)
    return collection


def apply_frame(scene):
    """Advance a repeating floor by 33 rows; frame 801 equals frame 1."""
    collection = _collection()
    if collection is None:
        return
    phase = (scene.frame_current_final - 1) / 800
    travel = phase * 66.0
    for tile in (obj for obj in collection.objects if "osc_base_y" in obj):
        tile.location.y = ((float(tile["osc_base_y"]) + travel + 77.0) % 88.0) - 77.0
    wave = math.sin(phase * math.tau * 4) * 0.06
    for wall in (obj for obj in collection.objects if obj.get("osc_wall")):
        modifier = wall.modifiers.get("Pad spread")
        if modifier:
            modifier.strength = max(0.02, _pad_target + wave)


def install_frame_handler():
    if apply_frame not in bpy.app.handlers.frame_change_post:
        bpy.app.handlers.frame_change_post.append(apply_frame)


def remove_frame_handler():
    if apply_frame in bpy.app.handlers.frame_change_post:
        bpy.app.handlers.frame_change_post.remove(apply_frame)


def _score_messages(filepath):
    messages = []
    with open(filepath, "r", encoding="utf8") as handle:
        for raw in handle:
            parts = raw.strip().split()
            if len(parts) < 3 or parts[0].startswith("#"):
                continue
            try:
                timestamp = float(parts[0])
            except ValueError:
                continue
            args = []
            for value in parts[2:]:
                try:
                    number = float(value)
                    args.append(int(number) if number.is_integer() else number)
                except ValueError:
                    args.append(value)
            messages.append((timestamp, parts[1], args))
    return messages


def _pairs(values):
    return {str(values[index]): values[index + 1] for index in range(0, len(values) - 1, 2)}


def _midi(freq):
    if not isinstance(freq, (int, float)) or freq <= 0:
        return None
    return round(69 + 12 * math.log2(freq / 440))


def _keyframe(obj, path, frame, value, index=-1):
    setattr(obj, path, value)
    obj.keyframe_insert(path, index=index, frame=frame)


def _clear_animation(objects):
    for obj in objects:
        obj.animation_data_clear()


def _set_interpolation(obj, mode):
    action = obj.animation_data.action if obj.animation_data else None
    if action is None:
        return
    from .baker import _get_all_fcurves
    for fcurves in _get_all_fcurves(action):
        for curve in fcurves:
            for point in curve.keyframe_points:
                point.interpolation = mode


def _driver_floor(collection):
    for tile in (obj for obj in collection.objects if "osc_base_y" in obj):
        tile.driver_remove("location", 1)
        curve = tile.driver_add("location", 1)
        curve.driver.expression = f"(({float(tile['osc_base_y']):.6f} + ((frame-1)/800)*66 + 77) % 88) - 77"


def _bake_floor(collection, bass_events, loop_seconds, fps):
    tiles = [obj for obj in collection.objects if "osc_tile_row" in obj]
    for tile in tiles:
        tile.location.z = float(tile.get("osc_base_z", -0.15))
        tile.keyframe_insert("location", index=2, frame=1)
        tile.keyframe_insert("location", index=2, frame=801)
    wrapped = [(time_value + shift, note, amp) for time_value, note, amp in bass_events
               for shift in (-loop_seconds, 0, loop_seconds)
               if -0.5 <= time_value + shift <= loop_seconds + 0.5]
    for time_value, note, amp in wrapped:
        row = int(note) % 12
        frame = 1 + time_value * fps
        for tile in tiles:
            if int(tile["osc_tile_row"]) % 12 != row:
                continue
            base = float(tile.get("osc_base_z", -0.15))
            _keyframe(tile, "location", frame - 0.5, (tile.location.x, tile.location.y, base), 2)
            _keyframe(tile, "location", frame + 1.0, (tile.location.x, tile.location.y, base + 0.22 + amp * 0.9), 2)
            _keyframe(tile, "location", frame + 7.0, (tile.location.x, tile.location.y, base), 2)


def _bake_rings(collection, drum_events, loop_seconds, fps):
    rings_by_kind = {kind: [] for kind in range(6)}
    for ring in (obj for obj in collection.objects if obj.get("osc_ring")):
        rings_by_kind[int(ring.get("osc_ring_kind", 0))].append(ring)
        ring.hide_viewport = False
        ring.hide_render = False
        ring.location = (0, -100, 3)
        ring.scale = (0.001,) * 3
    counters = {kind: 0 for kind in range(6)}
    minimum_gap = {0: 1.4, 1: 1.8, 2: 2.8, 3: 2.8, 4: 2.8, 5: 2.8}
    last_time = {kind: -100.0 for kind in range(6)}
    last_global = -100.0
    selected = []
    for event in sorted(drum_events):
        time_value, kind, amp, note = event
        kind = int(kind) % 6
        if time_value - last_time[kind] >= minimum_gap[kind] and time_value - last_global >= 0.42:
            selected.append((time_value, kind, amp, note))
            last_time[kind] = time_value
            last_global = time_value
    wrapped = [(time_value + shift, kind, amp, note) for time_value, kind, amp, note in selected
               for shift in (-loop_seconds, 0, loop_seconds)
               if -2.8 <= time_value + shift <= loop_seconds + 2.8]
    for time_value, kind, amp, note in wrapped:
        kind = int(kind) % 6
        pool = rings_by_kind[kind]
        ring = pool[counters[kind] % len(pool)]
        counters[kind] += 1
        start = 1 + time_value * fps
        duration = 54 + kind * 2
        diameter = (1.0, 0.84, 0.70, 1.12, 0.94, 1.22)[kind]
        ring.location = (0, -100, 3)
        ring.scale = (0.001,) * 3
        ring.keyframe_insert("location", frame=start - 0.2)
        ring.keyframe_insert("scale", frame=start - 0.2)
        ring.location = (0, -31 - (int(note) % 4) * 1.5, 3.0)
        ring.scale = (0.16,) * 3
        ring.keyframe_insert("location", frame=start)
        ring.keyframe_insert("scale", frame=start)
        ring.location.y = 9
        ring.scale = (diameter + min(0.35, amp),) * 3
        ring.rotation_euler.y += math.pi * (0.25 + kind * 0.08)
        ring.keyframe_insert("location", frame=start + duration)
        ring.keyframe_insert("scale", frame=start + duration)
        ring.keyframe_insert("rotation_euler", frame=start + duration)
        ring.location = (0, 12, 3)
        ring.scale = (0.001,) * 3
        ring.keyframe_insert("location", frame=start + duration + 0.2)
        ring.keyframe_insert("scale", frame=start + duration + 0.2)
        _set_interpolation(ring, "LINEAR")
    return len(selected)


def _bake_walls(collection, pad_events, loop_seconds, fps):
    walls = [obj for obj in collection.objects if obj.get("osc_wall")]
    for wall in walls:
        modifier = wall.modifiers.get("Pad spread")
        if not modifier:
            continue
        modifier.strength = 0.12
        modifier.keyframe_insert("strength", frame=1)
        active = 0
        for time_value, delta, amp in pad_events:
            if 0 <= time_value <= loop_seconds:
                active = max(0, active + delta)
                frame = 1 + time_value * fps
                modifier.strength = 0.12 + min(1.25, active * 0.12 + amp * 1.8)
                modifier.keyframe_insert("strength", frame=frame)
        modifier.strength = 0.12
        modifier.keyframe_insert("strength", frame=801)


def _close_loop(collection, scene):
    """Make frame 801 an exact animated-state duplicate of frame 1."""
    scene.frame_set(1)
    for obj in collection.objects:
        if "osc_tile_row" in obj:
            value = obj.location.z
            obj.location.z = value
            obj.keyframe_insert("location", index=2, frame=801)
        elif obj.get("osc_ring"):
            location = obj.location.copy()
            rotation = obj.rotation_euler.copy()
            scale = obj.scale.copy()
            obj.location = location
            obj.rotation_euler = rotation
            obj.scale = scale
            obj.keyframe_insert("location", frame=801)
            obj.keyframe_insert("rotation_euler", frame=801)
            obj.keyframe_insert("scale", frame=801)


def bake_performance(filepath):
    """Bake one 12-bar score cycle into scene objects for deterministic rendering."""
    collection = _collection() or build_scene()
    remove_frame_handler()
    scene = bpy.context.scene
    fps = 30
    loop_seconds = 800 / fps
    messages = _score_messages(filepath)
    node_info = {}
    bass_events = []
    drum_events = []
    pad_events = []
    animated = [obj for obj in collection.objects if obj.get("osc_ring") or "osc_tile_row" in obj]
    _clear_animation(animated)
    for timestamp, address, args in messages:
        if timestamp > loop_seconds + 2:
            continue
        if address == "/s_new" and len(args) >= 4:
            synth, node = str(args[0]), int(args[1])
            params = _pairs(args[4:])
            node_info[node] = (synth, params)
            freq = float(params.get("freq", 440))
            note = _midi(freq) or 60
            amp = float(params.get("amp", 0.1))
            if "dashMono" in synth:
                bass_events.append((timestamp, note, amp))
            elif synth.startswith("track7_dashDrum") or "dashDrum" in synth:
                drum_events.append((timestamp, int(params.get("type", 0)), amp, note))
            elif "ambPad" in synth:
                pad_events.append((timestamp, 1, amp))
        elif address == "/n_set" and len(args) >= 1:
            node = int(args[0])
            params = _pairs(args[1:])
            info = node_info.get(node)
            if info and "ambPad" in info[0] and float(params.get("gate", 1)) <= 0:
                pad_events.append((timestamp, -1, float(info[1].get("amp", 0.1))))
    _driver_floor(collection)
    _bake_floor(collection, bass_events, loop_seconds, fps)
    visual_rings = _bake_rings(collection, drum_events, loop_seconds, fps)
    _bake_walls(collection, pad_events, loop_seconds, fps)
    _close_loop(collection, scene)
    scene.frame_start = 1
    scene.frame_end = 800
    scene.frame_set(1)
    scene["osc_baked_score"] = os.path.abspath(filepath)
    scene["osc_baked_bass_events"] = len(bass_events)
    scene["osc_baked_drum_events"] = len(drum_events)
    scene["osc_baked_visual_rings"] = visual_rings
    scene["osc_baked_pad_events"] = len(pad_events)
    return len(bass_events), len(drum_events), len(pad_events)


def _ring_objects():
    collection = _collection()
    return [obj for obj in collection.objects if obj.get("osc_ring")] if collection else []


def trigger_drum(kind, amp=0.2, note=36):
    now = time.monotonic()
    pool = _ring_objects()
    if not pool:
        return
    preferred = [obj for obj in pool if obj.get("osc_ring_kind") == int(kind) % 6 and obj.hide_viewport]
    ring = preferred[0] if preferred else min(pool, key=lambda obj: obj.get("osc_ring_until", 0.0))
    diameter = (5.0, 4.2, 3.5, 5.6, 4.7, 6.1)[int(kind) % 6]
    ring.location = (0, -26 - (int(note) % 5) * 1.5, 3.0)
    ring.scale = (diameter / 5, diameter / 5, diameter / 5)
    ring.rotation_euler.y = int(kind) * 0.13
    ring.hide_viewport = False
    ring.hide_render = False
    ring["osc_ring_until"] = now + 2.2
    ring["osc_ring_speed"] = 13.5 + min(6.0, float(amp) * 18)
    if ring not in _active_rings:
        _active_rings.append(ring)


def trigger_bass(note, amp=0.15):
    row = int(note or 36) % 12
    _floor_pulses[row] = max(_floor_pulses.get(row, 0), 0.7 + float(amp) * 3)


def set_pad(spread=0.8, amp=0.08, voices=1):
    global _pad_target
    _pad_target = min(2.0, float(spread) * 1.4 + float(amp) * 2 + voices * 0.06)


def update_live():
    global _last_update
    collection = _collection()
    if collection is None:
        return
    now = time.monotonic()
    delta = min(0.1, now - _last_update)
    _last_update = now
    for ring in list(_active_rings):
        ring.location.y += float(ring.get("osc_ring_speed", 14)) * delta
        ring.rotation_euler.y += delta * (0.5 + ring.get("osc_ring_kind", 0) * 0.12)
        if now >= float(ring.get("osc_ring_until", 0)) or ring.location.y > 8:
            ring.hide_viewport = True
            ring.hide_render = True
            _active_rings.remove(ring)
    for tile in (obj for obj in collection.objects if "osc_tile_row" in obj):
        pulse = _floor_pulses.get(int(tile["osc_tile_row"]) % 12, 0)
        target = tile.get("osc_base_z", -0.15) + pulse * 0.34
        tile.location.z += (target - tile.location.z) * min(1, delta * 14)
    for row in list(_floor_pulses):
        _floor_pulses[row] *= max(0, 1 - delta * 3.4)
        if _floor_pulses[row] < 0.01:
            del _floor_pulses[row]
    for wall in (obj for obj in collection.objects if obj.get("osc_wall")):
        modifier = wall.modifiers.get("Pad spread")
        if modifier:
            modifier.strength += (_pad_target - modifier.strength) * min(1, delta * 2.5)


def reset_live():
    """Reset live envelopes and pooled objects to idle state."""
    global _pad_target, _last_update
    collection = _collection()
    _active_rings.clear()
    _floor_pulses.clear()
    _pad_target = 0.0
    _last_update = time.monotonic()
    if collection is None:
        return
    for ring in (obj for obj in collection.objects if obj.get("osc_ring")):
        ring.hide_viewport = True
        ring.hide_render = True
    for tile in (obj for obj in collection.objects if "osc_tile_row" in obj):
        tile.location.z = float(tile.get("osc_base_z", -0.15))
    for wall in (obj for obj in collection.objects if obj.get("osc_wall")):
        modifier = wall.modifiers.get("Pad spread")
        if modifier:
            modifier.strength = 0.12


class OSCBRIDGE_OT_build_performance_scene(bpy.types.Operator):
    bl_idname = "oscbridge.build_performance_scene"
    bl_label = "Build Portrait Tunnel"
    bl_description = "Create the 1080x1920 live performance tunnel scene"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        build_scene()
        self.report({"INFO"}, "Portrait tunnel created: 1080x1920, 30 FPS, 800 frames")
        return {"FINISHED"}


class OSCBRIDGE_OT_bake_performance_scene(bpy.types.Operator):
    bl_idname = "oscbridge.bake_performance_scene"
    bl_label = "Bake Score to Tunnel"
    bl_description = "Bake the loaded OSC score into floor, wall and ring animation"

    def execute(self, context):
        filepath = bpy.path.abspath(context.scene.osc_bridge_settings.osc_file)
        if not filepath or not os.path.isfile(filepath):
            self.report({"ERROR"}, "Load a text .osc performance first")
            return {"CANCELLED"}
        try:
            bass, drums, pads = bake_performance(filepath)
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Baked {bass} bass, {drums} drum and {pads} pad events")
        return {"FINISHED"}


classes = (OSCBRIDGE_OT_build_performance_scene, OSCBRIDGE_OT_bake_performance_scene)
