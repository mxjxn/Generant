# Generant

Generant is a desktop music workstation built on [SuperSonic](https://github.com/samaaron/supersonic). It is part of a personal creative toolkit for building custom instruments, sequencing music, and sending timestamped events to Blender through OSC.

The application is an Electron client. Audio is produced by Supercollider synthdefs running in SuperSonic. The UI stores projects as .rack.json files and provides tracker sequencing, song arrangement, device routing, CV connections, presets, MIDI, and OSC score export.

## Run it

    npm install
    npm start

The app starts with an empty project. Demo projects are available from File → Open Example.

## What is included

- Tracker and piano-roll note editing, including note-off events and indexed FX values.
- Song mode with reusable patterns, ordered positions, section labels, and position cues.
- Instruments, effects, CV sources, CV utilities, mixer channels, and rack routing.
- SuperSonic synthdefs for FM, wavetable, VCO, granular, sample, drum, modulation, filter, dynamics, and time-based effects.
- MIDI input, program/preset recall, audio device selection, and OSC output.
- A Blender OSC bridge for live control and deterministic score baking.

## Documentation

- [Instrument and CV devices](docs/instruments.md)
- [Tracker and song sequencing](docs/sequencer.md)
- [OSC and Blender integration](docs/osc-blender.md)
- [Renoise OSC Sequencer integration](https://github.com/mxjxn/renoise-osc-sequencer)
- [Development and testing](docs/development.md)

## Tests

    npm test

The test suite covers the project model, migration, routing, tracker editing, song mode, presets, MIDI, OSC score data, wavetable data, and device definitions. Tests that require a running desktop app or SuperSonic are separate scripts in tests/.

## Related repositories

- [OSC Score Bridge](https://github.com/mxjxn/osc-score-bridge) — standalone Blender add-on used for live OSC control and baking.
- [SuperSonic](https://github.com/samaaron/supersonic) — the audio engine Generant uses.

## License

Generant is released under the MIT License. See [LICENSE](LICENSE).
