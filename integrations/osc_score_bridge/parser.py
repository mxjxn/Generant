"""
OSC Score Bridge — Parser
Parses SuperCollider NRT OSC score files into parameter tracks.

Each track is named "synthname.paramname" and contains (time, value) tuples.
Also tracks "control_N" for /c_set and "control.name" for /rack/control.
"""

import math
import re
from collections import defaultdict


def parse_osc_file(filepath):
    """
    Parse an OSC score file into a dict of tracks.

    Returns:
        dict: { "sine.freq": [(0.0, 440.0), (0.5, 494.0), ...], ... }
    """
    tracks = defaultdict(list)
    node_to_synth = {}  # nodeid -> synthname, for /n_set resolution

    try:
        with open(filepath, "r") as f:
            lines = f.readlines()
    except Exception as e:
        raise IOError(f"Cannot read file: {e}")

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split()
        if len(parts) < 2:
            continue

        try:
            timestamp = float(parts[0])
        except ValueError:
            continue

        address = parts[1]
        args = parts[2:]

        if address == "/s_new":
            _parse_s_new(timestamp, args, tracks, node_to_synth)
        elif address == "/n_set":
            _parse_n_set(timestamp, args, tracks, node_to_synth)
        elif address == "/c_set":
            _parse_c_set(timestamp, args, tracks)
        elif address == "/rack/control":
            _parse_rack_control(timestamp, args, tracks)
        # /g_new, /n_free, /d_recv etc. are structural — no param data

    # Sort each track by time
    for key in tracks:
        tracks[key].sort(key=lambda x: x[0])

    return dict(tracks)


def _parse_s_new(timestamp, args, tracks, node_to_synth):
    """Parse /s_new synthname nodeid addaction target [param val ...]"""
    if len(args) < 4:
        return

    synthname = args[0]
    try:
        nodeid = int(args[1])
    except ValueError:
        return

    node_to_synth[nodeid] = synthname

    # args[2] = addaction, args[3] = target
    # args[4:] = alternating param/value pairs
    param_pairs = args[4:]
    _extract_params(timestamp, synthname, param_pairs, tracks)


def _parse_n_set(timestamp, args, tracks, node_to_synth):
    """Parse /n_set nodeid [param val ...]"""
    if len(args) < 1:
        return

    try:
        nodeid = int(args[0])
    except ValueError:
        return

    synthname = node_to_synth.get(nodeid, f"node_{nodeid}")
    param_pairs = args[1:]
    _extract_params(timestamp, synthname, param_pairs, tracks)


def _parse_c_set(timestamp, args, tracks):
    """Parse /c_set bus value"""
    if len(args) < 2:
        return

    try:
        bus = int(args[0])
        value = float(args[1])
    except ValueError:
        return

    track_name = f"control_{bus}"
    tracks[track_name].append((timestamp, value))


def _parse_rack_control(timestamp, args, tracks):
    """Parse /rack/control name value."""
    if len(args) < 2:
        return

    name = str(args[0]).strip()
    if not name:
        return

    try:
        value = float(args[1])
    except ValueError:
        return
    if not math.isfinite(value):
        return

    tracks[f"control.{name}"].append(
        (timestamp, min(1.0, max(0.0, value)))
    )


def _extract_params(timestamp, synthname, param_pairs, tracks):
    """Extract alternating param/value pairs from args list."""
    i = 0
    while i + 1 < len(param_pairs):
        param = param_pairs[i]
        try:
            value = float(param_pairs[i + 1])
        except ValueError:
            i += 2
            continue

        # Skip structural params (out, addaction, target etc. handled elsewhere)
        track_name = f"{synthname}.{param}"
        tracks[track_name].append((timestamp, value))
        i += 2


def get_track_summary(tracks):
    """
    Return summary info for UI display.
    [{name, event_count, min_val, max_val, duration}, ...]
    """
    summaries = []
    for name, events in sorted(tracks.items()):
        if not events:
            continue
        values = [v for _, v in events]
        summaries.append({
            "name": name,
            "event_count": len(events),
            "min_val": min(values),
            "max_val": max(values),
            "duration": events[-1][0] - events[0][0],
        })
    return summaries
