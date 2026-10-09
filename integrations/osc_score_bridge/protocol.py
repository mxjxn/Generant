"""Shared OSC protocol helpers for live and baked paths."""

import math


def pairs(values):
    """Convert [key, value, ...] to a dict."""
    return {str(values[i]): values[i + 1] for i in range(0, len(values) - 1, 2)}


def clamp_normalized(value):
    """Return a finite value clamped to [0, 1], otherwise None."""
    if not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value):
        return None
    return min(1.0, max(0.0, float(value)))


def control_track(name):
    """Canonical track name for named controls."""
    return f"control.{str(name)}"


def compute_voice_end(now, synth, params):
    """Compute optional auto-expiry time for a voice."""
    for key in ("duration", "dur"):
        if key in params:
            try:
                duration = float(params[key])
            except (TypeError, ValueError):
                continue
            if math.isfinite(duration) and duration > 0:
                return now + duration
    if str(synth) == "dashDrum":
        try:
            decay = float(params.get("decay", 0.25))
        except (TypeError, ValueError):
            decay = 0.25
        if not math.isfinite(decay):
            decay = 0.25
        return now + max(0.0, decay) + 0.1
    return None


def split_due_events(events, now):
    """Split scheduled events into due and future."""
    due, future = [], []
    for event in events:
        (due if event[0] is None or event[0] <= now else future).append(event)
    return due, future


def expire_voices(voices, tracks, now):
    """Expire voices whose end_at has passed; return affected track names."""
    affected = set()
    for node, voice in list(voices.items()):
        end_at = voice.get("end_at")
        if end_at is not None and end_at <= now:
            voices.pop(node, None)
            track = voice["track"]
            track_state = tracks.get(track, {})
            track_state.get("voices", {}).pop(node, None)
            affected.add(track)
    return sorted(affected)


def reset_transport_state(scheduled, voices, tracks):
    """Clear queued and active state; return touched track names."""
    affected = sorted(tracks.keys())
    scheduled.clear()
    voices.clear()
    for state in tracks.values():
        state.get("voices", {}).clear()
    tracks.clear()
    return affected
