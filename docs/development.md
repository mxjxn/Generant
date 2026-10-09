# Development

## Repository layout

- app/ — Electron main process, local server, preload, and OSC output.
- public/ — browser UI, tracker views, device editors, and compiled SynthDefs.
- shared/ — project model, device definitions, sequencing, presets, MIDI, and OSC data.
- sc/ — SynthDef source and compilation scripts for SuperSonic.
- integrations/ — packaged Blender bridge copy.
- scripts/ — demo composition and bridge packaging helpers.
- tests/ — model tests and desktop/audio integration scripts.

## Commands

    npm test
    npm run start
    npm run dev:web
    npm run compile
    python3 scripts/package-bridge.py

Desktop tests use the running Electron app and are named *-desktop.mjs, *-ui.mjs, or *-events-desktop.mjs. Audio library checks use the SuperSonic/SynthDef runtime and are intentionally separate from the fast default test command.

## Project files

Projects use the .rack.json extension. They contain device state, routing, notes, patterns, song order, presets, wavetables, and OSC tracks. Samples are embedded only when explicitly loaded into a project; the external sample library is not part of the repository.

## Contributions

Keep changes focused, add a model test for new project behavior, and add a desktop or audio test when the change depends on the running app or SynthDef runtime. Do not commit node_modules, build output, sample-library contents, recovery files, or Blender .blend1 files.
