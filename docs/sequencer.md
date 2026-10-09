# Sequencer

Generant has a tracker view for precise note and parameter entry, a piano roll for visual note editing, and Song mode for arranging patterns.

## Tracker

The tracker is selected per instrument or OSC device. Its columns contain notes, velocity, and indexed FX values. The FX legend maps parameter indexes to the selected device. Enter OFF to end a held note. Pattern length is controlled by rows and rows-per-beat; editing uses the current step and grid settings.

Keyboard editing supports piano input, step entry, insert mode, delete-under, step-delete, and Vim-style movement. The keyboard help panel documents the active keys.

## Song mode

Song mode is an ordered list of pattern positions. A position can reference an existing pattern, repeat it, clone it, or be made unique. Position cues belong to that occurrence; pattern content repeats with the pattern. The song can loop a selected range or the whole song.

The song exporter resolves the ordered timeline and can export all standalone OSC tracks and position cues. Audio rendering and final audiovisual muxing are separate workflows.

## Presets

Instrument programs use slots 00–7F. Store and recall them from the device editor, or enter a PR FX event in a tracker cell. MIDI Program Change maps to the same slots. Presets change device parameters without changing notes, routing, or external CV cables.
