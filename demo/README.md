# Ambient OSC Bloom

A live Generant → OSC Score Bridge demo. The separate `Ambient — OSC Bloom` scene preserves the original default scene.

- Volume ADSR (`control.keys`) swells the core and ring radius.
- Modulation ADSR (`control.modulation`) opens the nested halos.
- Motion CV (`control.motion`) turns the sculpture.

The current session is listening on localhost UDP 57141. Generant's Ambient sketch is an eight-bar, 80 BPM loop with long releases. Press Stop in Generant to end the performance.

To reopen: open `ambient-osc-bloom.blend`, run the included Blender text `START LIVE DEMO.py` from the Text Editor, and enable Preview in Blender in Generant before pressing Play. The text starts the receiver and refreshes property drivers with the timeline stopped. It does not need timeline playback. No automatic script execution is required.

This is live performance, not a baked movie. The frame range is 720 frames at 30 FPS (24 seconds); deterministic audio/animation export is separate work. The Motion LFO is free-running, so the live visuals are not yet guaranteed to form a seamless video loop.

## Percussive asteroid pulse

Open `asteroid-pulse.rack.json` in Generant for the revised demo: steady quarter-note kick, sparse snare, and offbeat hats at 80 BPM. All 72 constellation particles use `control.kick` to scale from 1x toward 5x on each hit, decaying with a 150 ms exponential time constant. The saved Blender scene includes the mapping and scale drivers. The pad/core/halo controls remain active.

## Chromatic Rift

`chromatic-rift.blend` is the redesigned portrait glass scene, based on the colour and material direction of `73.mp4`: cobalt blue, coral red, acid green and deep negative space. It contains 68 thick warped apertures, a camera-invisible emissive colour field that appears through reflection/refraction, and 180 faceted glass shards. Cycles transmission/reflection caustics are enabled; the visible coloured patterns primarily come from the reflected/refracted light field, not a promise of physically resolved dispersion.

Open the file and run the embedded `START CHROMATIC RIFT.py` text to reconnect after reopening. Use `asteroid-pulse.rack.json` for music. Kick expands the shards, keys breathe the aperture cross-sections, and modulation turns their folds. The original demo scenes remain available in the file's scene selector. The current live scene uses Cycles rendered viewport; material preview is faster but does not match the final glass appearance.
