# OSC and Blender

Generant can send timestamped OSC events from standalone OSC tracks and from instrument controls. The Blender integration lives in the separate [OSC Score Bridge repository](https://github.com/mxjxn/osc-score-bridge); a packaged copy is available at integrations/rack-osc-bridge.zip.

## Event types

An OSC event can represent:

- a note-on or note-off;
- a normalized control value or knob change;
- an envelope or sampled curve;
- a string or numeric state change;
- an arbitrary marker such as /song/part1;
- a camera route or other score cue.

Events can be previewed live on UDP port 57141 or exported as a score for Blender.

## Blender workflow

1. Install integrations/rack-osc-bridge.zip in Blender.
2. Enable the OSC Bridge add-on and listen on port 57141.
3. Enable Generant's Blender preview for live values, or export a song OSC score.
4. Import and bake the score in Blender when the timeline should contain deterministic keyframes and markers.

This means visuals can be triggered by musical and non-musical events instead of relying only on FFT analysis. A note, a parameter change, or an arbitrary marker can drive an object, light, camera, material, or custom property.

## Source of truth

The standalone mxjxn/osc-score-bridge repository is canonical. Generant's scripts/package-bridge.py packages that checkout when it is available and falls back to the vendored integration for source archives.
