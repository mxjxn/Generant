"""
OSC Score Bridge — Baker
Converts mappings into Blender F-Curves with keyframes.

Uses keyframe_insert() for Blender 5.x compatibility
(new animation system / slotted actions).

Easing modes generate intermediate keyframes with carefully
positioned bezier handles to create smooth, overshoot, bounce,
and lag transitions between OSC events.
"""

import bpy
import math
from . import parser as osc_parser


# ──────────────────────────────────────────────
# Easing Functions
# ──────────────────────────────────────────────
# Each takes a normalized time t [0..1] and returns a curve value.
# These define the SHAPE of the transition between two values.

def _ease_linear(t):
    """Constant speed."""
    return t


def _ease_smooth(t):
    """Cubic ease in-out — S-curve."""
    if t < 0.5:
        return 4 * t * t * t
    else:
        p = -2 * t + 2
        return 1 - (p * p * p) / 2


def _ease_overshoot(t):
    """
    Spring past target, settle back.
    Based on ease-out-back with moderate overshoot.
    """
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def _ease_bounce(t):
    """Elastic bounce settle — ease-out-bounce."""
    n1 = 7.5625
    d1 = 2.75

    if t < 1 / d1:
        return n1 * t * t
    elif t < 2 / d1:
        t -= 1.5 / d1
        return n1 * t * t + 0.75
    elif t < 2.5 / d1:
        t -= 2.25 / d1
        return n1 * t * t + 0.9375
    else:
        t -= 2.625 / d1
        return n1 * t * t + 0.984375


def _ease_lag(t):
    """
    Delayed catch-up — exponential approach to target.
    Starts slow, finishes fast (ease-out-cubic).
    """
    return 1 - (1 - t) ** 3


# Dispatch table
EASING_FUNCTIONS = {
    "INSTANT": None,  # Handled specially — no intermediate frames
    "LINEAR": _ease_linear,
    "SMOOTH": _ease_smooth,
    "OVERSHOOT": _ease_overshoot,
    "BOUNCE": _ease_bounce,
    "LAG": _ease_lag,
}


# ──────────────────────────────────────────────
# Core Baking
# ──────────────────────────────────────────────

def remap(value, in_min, in_max, out_min, out_max):
    """Map a value from input range to output range."""
    if in_max == in_min:
        return out_min
    t = (value - in_min) / (in_max - in_min)
    return out_min + t * (out_max - out_min)


def bake_mappings(scene, on_progress=None):
    """
    Bake all mappings into F-Curves.

    Returns:
        (baked_count, errors_list)
    """
    settings = scene.osc_bridge_settings
    mappings = settings.mappings
    fps = settings.fps
    frame_start = settings.frame_start

    if not settings.osc_file:
        return 0, ["No OSC file loaded"]

    # Parse the OSC file fresh
    try:
        tracks = osc_parser.parse_osc_file(
            bpy.path.abspath(settings.osc_file)
        )
    except Exception as e:
        return 0, [f"Parse error: {e}"]

    baked = 0
    errors = []
    total = len(mappings)

    for i, mapping in enumerate(mappings):
        if on_progress:
            on_progress(i, total)

        track_name = mapping.track_name
        if track_name not in tracks:
            errors.append(f"Track '{track_name}' not found in OSC file")
            continue

        events = tracks[track_name]
        if not events:
            errors.append(f"Track '{track_name}' has no events")
            continue

        try:
            _bake_single(mapping, events, scene, fps, frame_start)
            mapping.baked = True
            baked += 1
        except Exception as e:
            errors.append(f"'{track_name}': {e}")

    return baked, errors


def _bake_single(mapping, events, scene, fps, frame_start):
    """
    Bake a single mapping into an F-Curve with easing transitions.
    """
    obj_name = mapping.target_object.strip()
    if obj_name:
        obj = bpy.data.objects.get(obj_name)
        if obj is None:
            raise ValueError(f"Object '{obj_name}' not found")
    else:
        raise ValueError("No target object specified")

    data_path = mapping.target_data_path
    array_index = mapping.target_array_index
    keyframe_index = _validate_target(obj, data_path, array_index)

    # Ensure animation data + action exist
    if obj.animation_data is None:
        obj.animation_data_create()
    if obj.animation_data.action is None:
        obj.animation_data.action = bpy.data.actions.new(
            name=f"OSC_{mapping.track_name}"
        )

    action = obj.animation_data.action

    # Remove existing keyframes on this data_path/index
    _clear_fcurves_for(action, data_path, keyframe_index)

    easing = mapping.easing
    transition_frames = max(1, int(mapping.transition * fps))
    ease_fn = EASING_FUNCTIONS.get(easing)

    # Remap all event values first
    remapped = [
        (time_sec, remap(raw, mapping.in_min, mapping.in_max,
                         mapping.out_min, mapping.out_max))
        for time_sec, raw in events
    ]

    if easing == "INSTANT" or ease_fn is None:
        # Simple step keyframes — one per event
        _insert_keyframe(scene, obj, data_path, array_index,
                         keyframe_index,
                         frame_start + int(remapped[0][0] * fps),
                         remapped[0][1])
        for i in range(1, len(remapped)):
            time_sec, value = remapped[i]
            frame = frame_start + int(time_sec * fps)
            _insert_keyframe(scene, obj, data_path, array_index,
                             keyframe_index,
                             frame, value)

        # Set to CONSTANT interpolation
        _set_keyframe_interp(action, data_path, keyframe_index, "CONSTANT")
        return

    # For easing modes: generate intermediate keyframes between each pair
    # First event: just plant it
    first_frame = frame_start + int(remapped[0][0] * fps)
    _insert_keyframe(scene, obj, data_path, array_index,
                     keyframe_index,
                     first_frame, remapped[0][1])

    for i in range(1, len(remapped)):
        prev_time, prev_val = remapped[i - 1]
        curr_time, curr_val = remapped[i]

        curr_frame = frame_start + int(curr_time * fps)
        trans_start_frame = curr_frame - transition_frames

        # Clamp transition start to not go before previous event frame
        prev_frame = frame_start + int(prev_time * fps)
        if trans_start_frame <= prev_frame:
            trans_start_frame = prev_frame + 1

        # Insert a keyframe at transition start holding the previous value
        # (only if not the same frame as the previous keyframe)
        if trans_start_frame > prev_frame:
            _insert_keyframe(scene, obj, data_path, array_index,
                             keyframe_index,
                             trans_start_frame, prev_val)

        # Generate intermediate keyframes tracing the easing curve.
        # With auto-clamped bezier handles, 4-5 samples is enough for
        # a smooth curve without flooding the Graph Editor.
        num_samples = max(2, min(transition_frames // 2, 5))
        for s in range(1, num_samples):
            t = s / num_samples  # normalized 0..1
            eased_t = ease_fn(t)
            val = prev_val + (curr_val - prev_val) * eased_t
            frame = trans_start_frame + int(t * transition_frames)
            if frame < curr_frame:
                _insert_keyframe(scene, obj, data_path, array_index,
                                 keyframe_index,
                                 frame, val)

        # Final keyframe at the event time with the target value
        _insert_keyframe(scene, obj, data_path, array_index,
                         keyframe_index,
                         curr_frame, curr_val)

    # Set bezier handles for smooth curves
    _setup_bezier_handles(action, data_path, keyframe_index)


# ──────────────────────────────────────────────
# Keyframe Insertion Helpers
# ──────────────────────────────────────────────

def _insert_keyframe(scene, obj, data_path, array_index, keyframe_index, frame, value):
    """
    Insert a single keyframe at a specific frame with a specific value.
    Sets frame first, then value, then inserts (order matters for depsgraph).
    """
    scene.frame_set(frame)
    _set_property_value(obj, data_path, array_index, value)
    obj.keyframe_insert(data_path, index=keyframe_index)


def _set_property_value(obj, data_path, array_index, value):
    """Set a property value on an object path."""
    parent, accessor = _resolve_target_parent(obj, data_path)
    prop = _read_target_value(parent, accessor, data_path)
    if _is_indexable(prop):
        try:
            prop[array_index] = value
        except Exception as exc:
            raise ValueError(
                f"Invalid array index {array_index} for '{data_path}'"
            ) from exc
        return
    if array_index not in (0, -1):
        raise ValueError(
            f"'{data_path}' is scalar; use index 0"
        )
    _write_target_value(parent, accessor, value)


def set_live_property_value(obj, data_path, array_index, value):
    """Public setter reused by live control mappings."""
    _validate_target(obj, data_path, array_index)
    _set_property_value(obj, data_path, array_index, value)


def _validate_target(obj, data_path, array_index):
    """Validate target path and return keyframe index (-1 for scalar)."""
    parent, accessor = _resolve_target_parent(obj, data_path)
    prop = _read_target_value(parent, accessor, data_path)
    if _is_indexable(prop):
        try:
            prop[array_index]
        except Exception as exc:
            raise ValueError(
                f"Invalid array index {array_index} for '{data_path}'"
            ) from exc
        return array_index
    if array_index not in (0, -1):
        raise ValueError(f"'{data_path}' is scalar; use index 0")
    return -1


def _is_indexable(value):
    return hasattr(value, "__getitem__") and hasattr(value, "__setitem__") and not isinstance(value, (str, bytes))


def _read_target_value(parent, accessor, data_path):
    kind, token = accessor
    try:
        if kind == "attr":
            return getattr(parent, token)
        return parent[token]
    except Exception as exc:
        raise ValueError(f"Invalid target path '{data_path}'") from exc


def _write_target_value(parent, accessor, value):
    kind, token = accessor
    if kind == "attr":
        setattr(parent, token, value)
    else:
        parent[token] = value


def _resolve_target_parent(obj, data_path):
    data_path = (data_path or "").strip()
    if not data_path:
        raise ValueError("No target data path specified")
    parent_path, accessor = _split_data_path(data_path)
    try:
        parent = obj if not parent_path else obj.path_resolve(parent_path)
    except Exception as exc:
        raise ValueError(
            f"Invalid target path '{data_path}' (cannot resolve '{parent_path or '<object>'}')"
        ) from exc
    return parent, accessor


def _split_data_path(data_path):
    if data_path.endswith("]"):
        start = data_path.rfind("[")
        if start < 0:
            raise ValueError(f"Invalid target path '{data_path}'")
        parent_path = data_path[:start]
        if parent_path.endswith("."):
            parent_path = parent_path[:-1]
        key_expr = data_path[start + 1:-1].strip()
        if key_expr.startswith(("'", '"')) and key_expr.endswith(("'", '"')) and len(key_expr) >= 2:
            key = key_expr[1:-1]
        else:
            try:
                key = int(key_expr)
            except ValueError:
                raise ValueError(f"Invalid target path '{data_path}'")
        return parent_path, ("key", key)
    depth = 0
    for idx in range(len(data_path) - 1, -1, -1):
        char = data_path[idx]
        if char == "]":
            depth += 1
        elif char == "[":
            depth -= 1
        elif char == "." and depth == 0:
            return data_path[:idx], ("attr", data_path[idx + 1:])
    return "", ("attr", data_path)


# ──────────────────────────────────────────────
# F-Curve Management (Blender 5.x aware)
# ──────────────────────────────────────────────

def _get_all_fcurves(action):
    """
    Get all F-curves from an action, handling both legacy
    and Blender 5.x slotted actions.
    """
    fcurves = getattr(action, "fcurves", None)
    if fcurves is not None:
        yield fcurves
        return

    layers = getattr(action, "layers", None)
    if layers is None:
        return

    for layer in layers:
        strips = getattr(layer, "strips", None)
        if strips is None:
            continue
        for strip in strips:
            channelbags = getattr(strip, "channelbags", None)
            if channelbags is None:
                continue
            for cb in channelbags:
                fcs = getattr(cb, "fcurves", None)
                if fcs:
                    yield fcs


def _clear_fcurves_for(action, data_path, array_index):
    """Remove existing F-curves for a specific data_path/index."""
    for fcurves in _get_all_fcurves(action):
        fc = fcurves.find(data_path, index=array_index)
        if fc is not None:
            fcurves.remove(fc)


def _set_keyframe_interp(action, data_path, array_index, interp):
    """Set interpolation on all keyframe points of a specific F-curve."""
    for fcurves in _get_all_fcurves(action):
        fc = fcurves.find(data_path, index=array_index)
        if fc is None:
            continue
        for kp in fc.keyframe_points:
            kp.interpolation = interp
        fc.update()


def _setup_bezier_handles(action, data_path, array_index):
    """
    Set auto-clamped bezier handles on keyframes for smooth curves.
    This lets Blender compute proper tangent handles for the
    intermediate easing keyframes.
    """
    for fcurves in _get_all_fcurves(action):
        fc = fcurves.find(data_path, index=array_index)
        if fc is None:
            continue

        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = "AUTO_CLAMPED"
            kp.handle_right_type = "AUTO_CLAMPED"

        fc.update()


# ──────────────────────────────────────────────
# Clear
# ──────────────────────────────────────────────

def clear_baked(scene):
    """Remove all baked F-Curves for OSC mappings."""
    settings = scene.osc_bridge_settings
    removed = 0

    for mapping in settings.mappings:
        if not mapping.baked:
            continue

        obj_name = mapping.target_object.strip()
        if not obj_name:
            continue

        obj = bpy.data.objects.get(obj_name)
        if obj is None:
            continue

        anim_data = getattr(obj, "animation_data", None)
        if anim_data is None or anim_data.action is None:
            continue

        action = anim_data.action
        try:
            keyframe_index = _validate_target(
                obj,
                mapping.target_data_path,
                mapping.target_array_index,
            )
        except ValueError:
            keyframe_index = mapping.target_array_index
        _clear_fcurves_for(
            action,
            mapping.target_data_path,
            keyframe_index,
        )
        removed += 1
        mapping.baked = False

    return removed
