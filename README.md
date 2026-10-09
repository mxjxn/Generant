# Generant — Device library 0.11.0

## Instruments, effects and CV (0.11.0)

**Add Device…** now includes Granular Clouds, VCO, Gain / Trim, VCA, Multimode Filter, FreeVerb, GVerb Hall, Chorus, Phaser, Stereo Delay, LFO, Envelope and CV Scale / Mix. Existing Four FM, wavetable, drums and Contour remain available. Every new device has knobs with Shift for fine adjustment, indexed tracker FX, project persistence and undo. Startup stays empty.

**Granular Clouds** is a polyphonic sample-granulator with a built-in harmonic source so it plays immediately. Load audio embeds up to 30 seconds in the project (stereo is mixed to mono). Controls cover grain overlap, duration, clocked/random timing, duration jitter, position/range, scan speed, pitch randomness, pan spread and source root note, plus amplitude ADSR and filtering. Nominal grain rate is overlap ÷ duration, capped at 200 grains/second per voice. Grain duration/position/pitch changes affect new grains. Pitch, filter, amplitude, position and density accept independent CV inputs with signed depth controls. Presets store parameters; they retain the device's current sample.

**VCO** provides saw, pulse, sine, triangle and noise, stereo detune, pulse width, filter and amplitude ADSR. It is a note-driven audio instrument with pitch/filter/amplitude CV inputs. Its gate output follows held keyboard or sequenced notes. All synth instruments now expose this gate output.

**Routing:** effects added while an instrument/channel is selected are appended to that channel. Each channel supports six ordered inserts; Mixer provides add, move-up and remove controls. Rack Back shows the audio chain and directional CV sockets. Effect instances belong to one chain. An effect added when the chain is full remains unassigned. Projects support eight instrument channels and 48 total devices.

**Level tools:** Gain / Trim offers −60 to +24 dB gain, output trim, pan, width and polarity inversion. VCA adds normalized CV amplitude control and a response curve. Every new audio effect has output trim and bypass. Existing projects keep their levels; insert Gain / Trim to raise a quiet instrument. The master limiter/output guard remains the last stage.

**CV:** signals are normalized 0–1. Each modulator has its own bus. LFO has six shapes, free/tempo rates, signed depth and offset. Envelope supports external note gates, manual Held/Trigger, ADSR with hold for one-shot/loop operation, curve and a looping mode. CV Scale / Mix applies signed gains and offset, adds/multiplies/min/maxes two signals and smooths/clamps the result. Use cable depth plus the destination's depth to control modulation amount; pitch/filter/position inputs center on 0.5, while VCA uses 0–1 amplitude. Feedback cycles are rejected. CV currently runs at control rate, not audio-rate FM.

The filter has low-pass, high-pass, band-pass, notch and ladder modes. Stereo Delay offers free/tempo timing, feedback tone and ping-pong. GVerb room-size changes may produce pitch artifacts; animate mix/decay for smoother results. DSP uses standard [GrainBuf](https://doc.sccode.org/Classes/GrainBuf.html), [FreeVerb2](https://doc.sccode.org/Classes/FreeVerb2.html) and [GVerb](https://doc.sccode.org/Classes/GVerb.html) UGens compiled in `sc/library.scd`.

Verification: `npm test` checks routing, migration, cycle rejection, chain capacity/ownership and undo; `npm run test:library` exercises actual SuperSonic audio for both instruments and every new effect, embedded source import, CV routing, gate/release, manual envelope trigger and save/reopen.

## Sideways Bloom example (0.10.1)

Revision 4 removes the lead melody and its dedicated effects/CV. **Veil / transition chords** uses the existing voicings as dark, slow chord swells at selected handoffs, plus three quiet dotted-eighth chord pulses before the drop. The main grooves remain clear. The original drums, stabs, bass and Afterimage notes are unchanged. Veil's PR slots switch between swell and pulse articulations. The previous version is archived in `backup/sideways-bloom-hush-v3/`.

**File → Open Example → Sideways Bloom · Footwork** opens a complete 64-bar original arrangement at 160 BPM, with an 80 BPM halftime feel. Rootless extended chords, dotted-eighth stabs, dotted-sixteenth ghost echoes, syncopated kicks, a grounded bass, chord transitions and contrasting breakdown/drop sections are sequenced across sixteen named patterns. The chord track demonstrates PR preset changes (dry/open/low light). Six instruments, two effects and embedded drums make the project self-contained; startup remains empty and opening it does not start playback.

The editable project is `demos/Sideways Bloom.rack.json`; arrangement and sample provenance are in `demos/Sideways Bloom.txt`. The generator is `scripts/compose-footwork.mjs`. Glass rhythm and Slow glass ambient now share the Open Example submenu.

## Preset recall (0.10.0)

Each synth's rack patch strip has **Programs**. Choose a hex slot **00–7F** and **Store current** to capture its parameters and internal modulation assignments. **Recall** applies that snapshot immediately without changing notes, mixer routing or external CV cables. The snapshot uses the current patch/device name. Program banks are device-local and saved inside the project.

In a tracker FX cell, enter **PR 03** (or `PR03`) to recall slot 03 at that row. PR is always an instant Hold event. The sequencer captures the snapshot ID when entering the command: replacing slot 03 later changes manual/MIDI recall but leaves existing PR events pointing to their original sound. The contextual help for a PR cell identifies its captured preset; the left legend lists the current slot assignments. Clear/re-enter a PR cell to use a replacement slot assignment.

Preset values are the base for tracker automation; FX values override them, and CV modulates the result. Continuous controls reach held voices; envelope settings apply to subsequent notes. Playback does not overwrite the saved rack controls. Full-song playback resolves earlier PR events even when starting at a later position. Before the first PR event, the first pass uses the rack base; subsequent loops carry the final preset into the next cycle until the next PR. Pattern audition only resolves events in that pattern.

MIDI **Program Change** uses the enabled input, channel filter and selected/fixed synth routing in Settings. MIDI program numbers 0–127 correspond to PR 00–7F (some controllers display 1–128). Recall works with audio disabled and is undoable. During playback, scheduled PR and tracker automation retain priority over manual/MIDI base changes. MIDI program changes are not recorded automatically. Bank Select, SysEx transfer, preset morphing and switching synth engines through PR are not implemented. A PR event must match its device's synth engine; the editor rejects incompatible changes. Wavetable recall keeps the device's current wavetable asset.

Code API: `rack.presets.store(deviceId, slot, name)` returns a stable preset ID; `rack.presets.recall(deviceId, presetId)` and `rack.presets.recallProgram(deviceId, slot)` perform undoable recalls; `rack.presets.schedule(deviceId, beat, slot, column=0)` writes PR into the active pattern. Numeric API slots are 0–127, not hex strings. Shared helpers live in `shared/presets.mjs` for transactions outside the UI.

Verified with `npm test`, `npm run test:presets` and the MIDI settings test: stable references, precedence, held-voice control messages, real scheduled audio, mid-song starts, save/reopen and routed Program Change.

## Project lifecycle (0.9.1)

Fresh startup uses an empty project: no instruments, notes or cables. **Add Device…** is available in Sequencer, Rack and Mixer. The master output and one empty song position remain. Tape Drums and Motion currently support one instance each; adding either again selects the existing device.

**File → New project** uses your saved default, or an empty project. **New empty project** always starts blank. **Use current project as default** stores a separate copy of the project, including its devices, music and samples; **Clear default project** restores empty startup. Recovery still offers to restore interrupted work. Demos are explicitly available as **Demo: Glass rhythm** and **Demo: Slow glass ambient**. New projects and demos do not overwrite the previously opened file when saved.

Every rack device has **Delete device**, including the original starter devices. Deletion removes its track, mixer channel, connections and musical data across all patterns; Undo restores them together. **Delete position** and the × button beside each song pattern remove only that occurrence. The pattern stays available in the pool. Deleting the last occurrence creates an empty position so the editor remains usable. All position deletion is undoable.

Verification: `npm test`, `npm run test:empty`, and `npm run test:song` cover empty startup, device addition/removal, cross-pattern cleanup, undo, native defaults across restart, demos and existing song playback.

## Song sequencer (0.9.0)

The Sequencer now has a compact song order above the selected device's tracker. Each position references a reusable **whole-song pattern** containing notes, drums, FX and standalone OSC tracks. Rack instruments, patches, routing and mixer controls remain global. Existing projects migrate to Pattern 00 without changing their musical content.

- **New** inserts an empty pattern. **Repeat** inserts another reference to the same pattern: editing either occurrence changes both. **Clone** inserts an independent copy. **Make unique** detaches just the selected occurrence. Removing a position retains its pattern in the pattern dropdown. Arrow buttons reorder positions; section labels describe occurrences.
- **Song** plays the order; **Pattern** auditions the selected pattern. Loop and the range selectors control repetition. Selecting a row changes the editing target independently of playback. **Follow** moves the editor with playback. The small launch arrow queues a position at a pattern boundary beyond the audio scheduling lookahead.
- **Rows** and **Rows / beat** set pattern duration. Per-track **Grid / beat** sets editing resolution. Shortening a pattern trims content beyond its end and is undoable.
- New tracker notes continue until another note in their column or an **OFF**, including across pattern boundaries. OFF can be entered in an otherwise empty pattern to end a carried note. Existing explicit note lengths are preserved. Natural song completion releases held notes and lets tails decay; Stop ends transport immediately. Starting midway through a held note reattacks its envelope with the remaining gate duration.
- **Position cues** belong only to that occurrence: use `/song/part1` once even when its music pattern is reused. OSC device-track events belong to the pattern and repeat with it. **Export song OSC** exports the full ordered song, including position cues, from the same resolved timeline used by playback. The OSC-track export remains a single-pattern export.

Live keyboard/MIDI recording currently works in **Pattern mode**; Song-mode recording is disabled until cross-pattern recording is implemented. Step entry and audition remain available. Per-track pattern aliases, block operations, song automation recording, and audio render/export remain future work.

Project schema v3 stores `song.patterns` and `song.order`. Top-level note/sequence fields are an editing projection of the selected pattern. Code integrations should use `Store.edit` with helpers from `shared/song.mjs` (`selectPattern`, `editPattern`, `insertPosition`, `makeUnique`, `setPatternRows`, `compileSong`) rather than mutating both representations. Loading a v3 file restores its projection from the pattern pool.

Verification: `npm test` and `npm run test:song`; the desktop test checks real audio, release tails, ordered OSC, queued transitions, Follow, loop ranges, independent editing, save/reopen and timeline export. Model inspired by the [Renoise Pattern Sequencer](https://tutorials.renoise.com/wiki/Pattern_Sequencer) and [Pattern Matrix](https://tutorials.renoise.com/wiki/Pattern_Matrix).

## Samples / envelope wavetables (0.6.0)

**Samples → New wavetable** creates a project-owned source with two cyclic breakpoint shapes, A and B. Select or drag points (Shift for fine movement), adjust position/level/curvature, and add/remove internal points. Endpoints stay joined. Shapes have 3–16 points; up to 16 assets are supported.

Edits are drafts until **Apply**; Revert discards the draft. Apply is one undoable project edit and stops playback before rebuilding buffers. Apply before saving. Preview C3 auditions the applied asset at the preview morph position through the master output. Nothing plays automatically.

**Add rack instrument** creates an independent Envelope Wavetable voice with an empty clip, mixer channel and automatic audio routing. Its rack panel has morph position, detune, transpose, filter, amplitude ADSR, shape ADSR and signed envelope/CV-to-position depth. **Edit waveform** returns to its shared source in Samples. Duplicating the device shares that source while copying its controls and notes. Editing the source affects all its instances.

On the back, connect Motion CV OUT to **Table position CV IN**. The signal is centered at 0.5 and scaled by the signed rack depth and cable amount. Disconnection contributes zero. Existing tracker indexes retain their meanings; wave controls append to the map. The wavetable instrument shows only its relevant FX controls.

Waveforms are generated in JavaScript using numeric envelope curvature, converted to SC wavetable encoding and uploaded to SuperSonic buffers. Ten harmonic-limited versions per frame remove DC and share peak normalization; the voice chooses a conservative band for each detuned oscillator. This reduces static waveform aliasing; rapid morphing, distortion and pitch changes are not claimed to be alias-free. Crossing band boundaries during continuous tuning can change timbre. The 4.5 KB rackWavetable SynthDef uses VOsc, two detuned oscillators, RLPF, ADSRs and bounded output. It is separate from Four FM; existing instruments retain their engines.

This is a waveform-authoring workspace, not yet a full sample browser/editor: file import, audio-to-table conversion, more than two morph frames, spectral editing, custom macro-face authoring and table hot-swapping during playback remain future work. Drum sample loading remains in Tape Drums. Generated buffers are rebuilt from the compact saved shapes when reopening a project.

Verification: waveform math/encoding, project validation/undo, browser editing and audible SuperSonic preview, independent track playback, source navigation, buffer rebuild and project roundtrip. Run `npm run test:wavetable`. Source backup: `backup/before-wavetable.tgz`.


A standalone Electron interface with SuperSonic 0.88 running scsynth in an AudioWorklet. This first version is a working rack and sequencing prototype, separate from the earlier SC and web experiments.

See [TODO.md](TODO.md) for the staged product roadmap, milestone completion criteria, and next implementation queue.

## Keyboard tracker (0.5.2)

The tracker starts in **Normal** mode. Click a cell; **H/J/K/L** move left/down/up/right. **I** enters **Insert**, and **Escape** returns to Normal, releases held keyboard notes, and disarms recording without stopping transport.

- In a Note cell with **Piano keys** enabled, **Z S X D C V G B H N J M** play the lower octave; **Q 2 W 3 E R 5 T 6 Y 7 U** play the upper. The Octave selector sets the lower C. Physical key positions are used, independent of capitalization.
- Insert writes at the cursor and advances by **Edit Step** rows. Step 0 stays in place. **Backtick / tilde** inserts **OFF** in the Note column and advances. Key release ends the audition; step-entry durations are controlled by subsequent notes/OFF entries.
- Vel/FX cells accept hexadecimal text in Insert. **F2** or double-click allows direct cell text such as `F#4` or `OFF`, even with Piano keys enabled. Enter commits; Escape cancels the draft. Turn Piano keys off for continuous text entry.
- **Delete** clears the current cell in place; **Backspace** clears and advances by Edit Step. Both work in Normal and Insert, without shifting later events. F2/direct text editing keeps character deletion. Clearing a note removes its velocity and OFF; clearing only OFF extends the preceding note to the next note or loop end. Clearing Vel restores the default velocity. Block selection is not implemented yet.
- **Live Record** arms the selected instrument and enters Insert. While transport plays, piano key presses/releases record at the playhead using the selected quantization. Existing notes are preserved; overlapping voices use separate Note columns. A note is committed on release, with one undo step per voice. Stopped Insert still writes at the cursor.
- Space toggles transport while a tracker cell is focused. Stop, changing device/workspace, and window focus loss release held notes. Escape and Stop disarm recording. Normal mode prevents accidental cell writes; editing controls and FX reference actions remain available.

Recording currently covers computer-piano notes, not knob automation or external MIDI. Notes crossing the loop boundary split and retrigger; holds longer than a loop are limited to one loop. Drum pads remain one-shot step entries. Run `npm run test:keyboard` for modal navigation, note entry, real audio monitoring, and live recording checks.

## Four FM and CV (0.5.0)

Add Device → Four FM creates an independent four-operator instrument with an Init sine patch. Existing projects keep the legacy Glass engine until you choose a Four FM patch in that device's patch strip. Notes, routing and original FX indexes stay intact. Glass Keys is now also a factory patch for the new engine; the legacy sound is retained separately for compatibility.

- Select Operator 1–4 for ratio/fixed-Hz tuning, cents, semitone offset, audible output, modulator gain, velocity response, pan and its own ADSR. The always-visible 4×4 matrix runs from source rows to destination columns. Diagonal cells are self-feedback. Every operator can be audible, a modulator, or both.
- Matrix depth spans 0–32 radians of phase modulation, with a separate 0–8 modulator gain. Cyclic routes use one scsynth audio block of delay through LocalIn/LocalOut; this deliberately colors feedback and is not a zero-delay FM solver. Strong/high-frequency settings can alias. Per-voice tanh and the existing master limiter bound the output without restricting the matrix to gentle presets.
- Global controls include pitch envelope, transpose, cutoff/resonance, width/output, voice ADSR and a modulation ADSR. Volume ADSR controls the voice lifetime; a longer operator release cannot outlive the global release. Envelope timing edits apply to new notes; held notes respond to continuous tuning, matrix and CV controls.
- Patch controls are on the device: previous/next, selector, modified state, Save As, Import and Export. Saved patches travel inside the project; JSON export/import reuses them in other projects. They contain parameter values and CV assignments, not notes, samples, or external cables. Loading a patch is undoable and preserves sequencing/routing. Factory patches: Init, Glass Keys, Bent alloy, Rubber circuit, Slow fracture.
- **+ CV input** assigns up to eight slots. Choose a destination and a source: External CV, velocity, global modulation envelope, one of four operator envelopes, or random per note. For External CV, flip the rack and connect Motion CV OUT to the numbered CV IN socket. Multiple slots may target the same parameter and their contributions add.
- **Unipolar:** 0 adds nothing and 1 applies the signed depth. **Bipolar:** 0.5 adds nothing and 0/1 apply opposite offsets. Negative depth reverses the response. Per-note sources initially select unipolar; the external LFO initially selects bipolar. Optional smoothing is in seconds. A disconnected external input contributes zero, including in bipolar mode.
- Depth uses destination units: semitones, cents, Hz, octave shifts for cutoff, or native matrix/level units. The rack shows each affected knob's potential CV range and a live marker for connected external Motion CV. Per-note envelopes/random differ between voices; their range is shown rather than claiming one shared current value. Final destination values are clamped to that parameter's supported range.
- Existing tracker indexes 01–0E retain compatibility meanings. New FM indexes are appended starting at 10; none are renumbered by patch changes. On Four FM, legacy brightness automation maps to cutoff and legacy metal automation to matrix 2→1 unless the corresponding new parameter also has automation. The global modulation ADSR/target/depth and old brightness CV route remain usable. CV then offsets the automated base.

Current boundaries: sine operators, polyphonic voices, one external Motion source, eight assignments per instrument, and project-contained patch libraries. Macros, additional modulation devices, arbitrary audio-rate external CV, waveform choices, mono/legato glide and oversampling remain future work. The source backup is `backup/before-four-fm.tgz`. Run `npm run test:fm` for real UI/audio CV and patch checks.

## Tracker workflow (0.4.0)

Select a device in the Sequencer sidebar. The tracker uses **Note**, **Vel**, and **FX** columns. Keys can still switch to Piano roll, and the drum kit can switch to its step grid. Both editors share the same notes, including off-grid timing.

- Use F2 to enter `C-3`, `F#4`, etc. Enter `OFF` later in the same note column to release the note through its ADSR. A note without an earlier OFF ends at the loop boundary. Additional Note columns provide polyphony.
- Enter commits and advances down; Up/Down move between rows; Tab/Shift-Tab move between cells. In Insert, Delete clears a cell; Escape cancels its draft and returns to Normal, and Ctrl/Cmd-Z undoes an edit. Velocity is hexadecimal `00–FF`.
- FX entries use a stable device-specific index and a hex value: `0110` or `01 10`. Lowercase is accepted and committed text is normalized. Invalid drafts remain in the cell with an error; Enter/Tab will not advance until corrected or canceled with Escape. The compact **FX** pane below the device list is the reference. Select an FX cell, then click an index to insert it. Values map linearly across the parameter range shown in contextual help; switches and enums round to a valid choice.
- Select an FX event and choose **Hold**, **Linear**, or **Smooth** for its transition to the next event for that parameter. Curves wrap through the loop boundary. **Read FX** disables that device's automation without deleting it. Stop restores the saved rack controls; playback does not overwrite them. Envelope ADSR changes apply to new voices.
- **?** opens a persistent help dock. Point at or keyboard-focus a control to update the dock; moving away retains the explanation. Native floating title tooltips are removed, including inside rack panels. The FX reference stays separate and follows the selected device.
- **Rack → Add Device → OSC Control** creates a control-only device. Set its unique output name (for example `asteroid.scale`), open Track, and sequence `01 00` through `01 FF`. With Audio / OSC → Preview in Blender enabled, playback sends normalized `/rack/control <name> <value>` values on the existing timestamped bridge, at 60 Hz plus exact FX events. Configure the matching name in Blender.

This pass covers individual cells and interpolated FX points. Rectangular block selection/paste, a graphical curve drawing lane, pattern chains, and automation recording are still future work. Drum pads remain one-shot, fixed-pitch sample triggers on the existing sixteenth-note grid; their four Note columns correspond to Kick, Snare, Hat and Texture. Effects, Motion, and OSC devices have FX-only sequences.

Tracker settings and events live in optional `studio.sequences[deviceId]` records with a versioned parameter-index map. Existing version-2 projects load without any musical changes. The source backup for this pass is `backup/before-tracker.tgz`. Run `npm test` and `npm run test:tracker` for the core and audible tracker checks.

## Studio workflow

The compact top bar contains File, workspace buttons, transport, an output meter, and undo/redo. The left browser lists clickable tracks, devices, or channels. Project naming belongs to the window title and File → Rename project, without a project information block in the sidebar.

Rack displays all device panels in a vertical stack. Selecting a sidebar name scrolls to its panel; it does not replace the controls of another device. Each title strip contains the editable device name, routing, Track/Mixer navigation, and collapse. Add Device offers the currently creatable Glass Keys, Contour, and OSC Control types. New Keys use default parameters and an empty note clip, automatically connected to a new mixer channel; Duplicate copies the selected Keys and its notes. Tape Drums and Motion remain single-instance devices already present in the project.

Front/Back lives in the sidebar. Back exposes actual audio/CV sockets and drawn cables terminating at the mixer patch bay or an insert. Ports are explicitly marked **CV IN / CV OUT** or **AUDIO IN / AUDIO OUT** with direction arrows; outputs use square sockets and inputs round sockets. Choose an output then a compatible input to connect. CV connection rows identify source → destination, expose signed depth, and allow disconnecting. Flipping to Front hides the rear cables. Audio/OSC setup is a compact sidebar menu; the master gain control lives in Mixer.

- **Sequencer:** select a device for its tracker, with piano roll and drum grid available for their corresponding instruments. Switching to Rack or Mixer preserves the selected clip. Each instrument currently has one clip sharing the project loop length.
- **Rack:** edit sounds and envelopes directly in stacked panels, use front/rear connections, rename devices, add or duplicate Keys, or create another Contour. Audio Out connects/disconnects the instrument's own mixer channel. Additional Keys instances have independent parameters, clips, CV inputs, and channels.
- **Mixer:** each instrument has a dB fader, stereo balance, mute/solo, a post-fader meter, one Contour insert slot, and a Master/disconnected output. Selecting an insert in Mixer or a channel in Contour's rack panel changes the same routing. A Contour instance belongs to one insert at a time; create another instance for another channel.
- **Project code:** a global drawer edits the same complete project as the UI. Apply stops playback and is undoable.
- **Desktop files:** Save reuses the current file; Save as chooses another. Closing an edited project offers native Save / Discard / Cancel. Recovery snapshots are written after an editing pause and offered after an abnormal exit. Normal close clears the recovery snapshot. A second launch focuses the existing application.

The project schema is now version 2. Version-1 patches migrate on load; original notes, samples, parameters, and cables are retained. An old Contour assigned to both instruments becomes two independent effect instances. Original payload locations are retained behind adapters in `shared/studio.mjs`; additional devices/clips live in the `studio` section. Renaming a device does not change its ID or disconnect its track/channel.

Current bounds are explicit: up to eight instrument channels, additional Glass Keys and Contour instances, one Tape Drums kit, one Motion source, one insert per channel, and master output. Original devices remain available for patch compatibility; additional devices can be removed and restored with Undo. Structural changes stop playback. Sends, group buses, general insert chains, arrangement, Matrix, MIDI, detachable windows, and export remain roadmap work. This is a bounded engine allocation, not yet a general routing-graph engine.

Checks: `npm test`, `npm run test:studio`, `npm run test:ui`, `npm run test:workshop`, `node tests/dsp.mjs`, and `npm run test:desktop`. Packaged tests accept `RACK_EXECUTABLE`; desktop tests use isolated temporary profiles. `RACK_PROFILE` selects an alternate app profile for development/testing. The pre-milestone source backup is `backup/before-studio-workspaces.tgz`.


## New instrument workflow

In **Rack**, all device panels remain in the stack. The sidebar navigates to a panel; its title-strip minus button collapses it. Each panel owns independent controls and audition state.

- Drag knobs or faders vertically. **Shift** slows movement without jumping when pressed or released during a drag.
- **Ctrl/Cmd-click** resets a control. Each drag is one undo step. Arrow keys adjust focused controls; Shift makes those adjustments smaller.
- Double-click a value or press Enter on a focused control to type. Time fields accept seconds or `250 ms`; frequency fields accept Hz or `3 kHz`. Percent controls accept percent values. Volume controls display dB.
- Volume and modulation ADSRs have logarithmic faders and draggable graph handles. Time handles move horizontally; sustain moves vertically. The graph has a voice-position indicator and the affected timbre knob has a purple modulation marker. These are UI estimates based on the current patch, not DSP measurements of every existing voice.
- **Hold** auditions a note or chord until Release. **Retrigger** starts the current sound again without restarting transport. Envelope changes apply to new voices; existing voices finish using their original ADSR.
- Tape Drums selects one pad at a time. Adjust its own level, pitch, decay, cutoff, and drive; audition, mute, or solo it. Drag waveform edges to trim, with Shift for precision. Meters read the engine's per-pad output. Expand Shared kit controls for the existing kit-wide filter, rate, and gain.
- Contour has three algorithms: soft saturation, folding, and wrapping. Drive feeds the nonlinear stage; Character biases it for asymmetry. Tone filters the processed signal. Mix blends it with dry audio; Output adjusts gain. Bypass preserves the dry signal. **Clean lows** preserves a low-pass component around 120 Hz, while **Gain compensation** follows amplitude to help comparison. This is not a LUFS loudness matcher, and fold/wrap are intentionally not oversampled in this version.

The sample SynthDef no longer fades gain up from zero at every trigger; a short edge envelope prevents hard trim clicks while preserving the transient. Existing patches gain default per-pad and effect settings on load. Contour is bypassed for older patches.

A personal audition patch is saved at `demo/punch-and-contour.rack.json`. It includes your **BD S612 Analog Punch.wav** sample from Samples From Mars, per-pad balances, and mild saturation. It is kept outside the distributable app files.

Validation commands: `npm test`, `npm run test:workshop`, `node tests/dsp.mjs`, `npm run test:ui`, and the packaged OSC bridge test. The test suite covers interaction gestures, graph/trim edits, migrations, sample replacement and undo, all distortion modes with compensation on/off, independent channel muting, dry/wet/bypass audibility, output protection, and Stop silence.

## Start

On this Linux machine, launch `dist/linux-unpacked/rack-studio`, or run `npm start` from this directory. The window opens silently. **Play** prepares the engine and starts the loop; **Enable audio** prepares it without playing. No running SuperCollider IDE or server is required.

If Linux rejects Electron's sandbox on your system, `npm start -- --no-sandbox` is a local development fallback. The renderer still uses context isolation and has no Node access.

## Try the workflow

1. Press Play to hear the two-bar, 168 BPM demo phrase. Change the front-panel controls while it plays. Drag knobs vertically; hold Shift for finer movement, or double-click its value to type an exact value.
2. In the piano roll, double-click empty space to add a note. Drag notes to move; drag their right edge to change duration. Shift-click or drag a selection box for multiple notes. The toolbar provides exact velocity and length. Arrow keys move or transpose, Shift+Up/Down transposes an octave, Ctrl/Cmd+A selects all, and Ctrl/Cmd+D duplicates the selected phrase. Delete removes notes. Scroll vertically for other octaves.
3. Select the Drums track in Sequencer to toggle sixteenth-note steps. Use Show device to load your own samples per pad in Rack. Imported audio is embedded in the project, limited to 20 MB and 30 seconds per file, and mixed to mono. The supplied sounds are simple generated placeholders.
4. Open Rear connections. Click an output jack, then a matching input. Motion can control the brightness of Glass Keys and the tone of Tape Drums. Set a signed modulation amount or disconnect a cable. Removing an instrument's audio cable mutes its contribution to the output.
5. Open Patch code to edit the actual project JSON: notes, device parameters, drum steps, connections, and sample data. **Read current patch** refreshes the editor. **Apply code** validates the whole patch and applies it as one undoable change. It stops playback. This is structured patch editing, not an SC interpreter or Pdef environment.
6. Save patch writes a `.rack.json` project with samples included. Open restores a project. Undo/redo covers notes, parameters, connections, and samples. Sample replacement stops transport while buffers are changed.

Space toggles playback outside text fields. Escape stops and clears scheduled notes. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Tempo and loop length are changed while stopped. Musical edits affect upcoming scheduled events; front-panel controls also affect existing voices where the synth supports it. The scheduler looks ahead 120 ms.

## Instruments and signal contract

- **Glass Keys:** polyphonic FM/VarSaw voice with gated envelopes, stereo spread, and brightness CV.
- **Tape Drums:** four sample slots with independent level, tuning, decay, cutoff, drive, trim, mute/solo, and metering; shared kit controls and tone CV.
- **Motion:** sine, triangle, or random modulation. Its scope displays values returned by the running engine.
- **Contour:** Saturate, Fold, and Wrap, inserted on drums, keys, or both.
- **Output:** stereo mix and master gain, a limiter, and a final independent Web Audio output guard.

CV ports carry normalized **0–1** values. Signed cable depth maps the centered control to a useful parameter range inside each instrument. Audio and CV cannot be cross-connected. The current engine reserves eight channel slots: CV bus 0; original keys bus 16/17; per-pad buses 24–31 mixed to 18/19; additional source/effect pairs allocated by `engineLayout`; mixer summing bus 80/81; hardware output 0/1. Sources run before voices, followed by inserts, channels, and the master.

The final AudioWorklet converts non-finite samples to zero and caps output sample magnitude at 0.98, after the rack mix. The master SynthDef also removes DC, sanitizes values, and limits peaks. This bounds digital samples; it is not a guarantee about speaker loudness or intersample true peaks. Unrestricted `tanh` on every module was avoided so normal signals stay clean.

## Authoring the sound

The source is `sc/compile.scd`; compiled definitions are in `public/synthdefs/`. Edit the SynthDef source, then run:

```sh
npm run compile
```

This requires `sclang` only on the authoring machine. Reload the app to load the rebuilt definitions. For a headless Linux terminal:

```sh
QT_QPA_PLATFORM=offscreen QTWEBENGINE_DISABLE_SANDBOX=1 npm run compile
```

Device names, parameter ranges, defaults, and port declarations live in `shared/model.mjs`. UI and audio scheduling consume the same project data. The engine-specific routing currently lives in `public/audio.mjs` and `public/scheduler.mjs`; this is not yet a general plugin loader.

## Development and checks

```sh
npm install
npm test
npm run dev:web
# in another terminal:
npm run test:ui
npm run dist:linux
node tests/desktop.mjs
```

UI tests use Playwright and Chromium available on this machine; set `PLAYWRIGHT_MODULE` and `CHROME_PATH` for another installation. The desktop test uses the packaged Linux executable. Browser and desktop tests mute hardware output while inspecting audio-engine peak values.

Validated here: project/port validation, undo/redo, loop resize, real piano-roll input, knobs, sample import and undo, JSON save/open, live CV, audible engine output, Stop silence, and the packaged Electron app loading its bundled WASM and SynthDefs.

`npm run dist:mac` is configured for building on a Mac with Node installed. macOS packaging, audio behavior, signing, and notarization have **not** been tested.

## Deliberate boundaries of this first version

There is one loop per project. Additional Keys and Contour instances and mixer channels are available; arbitrary device types, effects chains, drawable cables, A–D/1–8 pattern banks, arrangement, automation lanes, MIDI integration, Renoise exchange, audio export, Pdef integration, and live SynthDef replacement are not implemented yet. Code and UI share project state now; full live synthesis authoring remains a separate step.

The next UX review should decide whether drawing/editing notes, switching between code and panels, and patching modulation feel right before expanding the device library.

## Ambient envelopes and Blender preview (October 8)

Click **Ambient sketch** for an undoable eight-bar, 80 BPM pad phrase with overlapping release tails and silent drums. It does not start playback. Volume and modulation each have a per-voice ADSR with an envelope graph and exact values. Attack/decay extend to 30 seconds and release to 60 seconds. Modulation targets brightness, FM amount, or stereo width with signed depth. ADSR edits apply to new voices; timbre and modulation depth remain live. Ordinary note-offs and loop boundaries preserve release tails; Stop intentionally clears all voices.

In the desktop app, enable **Preview in Blender**, then click **Listen** in the updated OSC Bridge add-on. The default destination is localhost UDP 57141. The button means “sending,” not an acknowledged Blender connection. The sender implements the bridge protocol at `mxjxn/osc-score-bridge` commit `46c619f` using `/companion/note`, `/rack/control`, and `/rack/reset`. It does not require sclang.

Map these named tracks in Blender:

| Track | Value |
| --- | --- |
| `control.keys` | Strongest active linear volume ADSR, scaled by note velocity |
| `control.modulation` | Strongest active modulation ADSR |
| `control.kick`, `control.snare`, `control.hat`, `control.texture` | Short musical trigger envelopes, approximations rather than sample waveform analysis |
| `control.motion` | The running Motion device's normalized CV |

Key and drum voices carry explicit lifetimes. Stop resets queued bridge events and visual state; Play starts a new synchronized run. Key/envelope messages carry the audio scheduler's OSC timestamps. Motion is sampled from the engine, so it is a lower-rate live preview signal. Audio and CV cables do not mute these musical event controls; they describe performed notes independently of audio routing.

Verification: nine model/output tests, browser UI regression checks, and an actual UDP receiver test from the packaged Electron app (notes, bounded controls, release-tail audio, Stop/reset, and restart). The live Blender MCP connection was unavailable during this pass, so the current Blender scene was not changed or visually verified. The bridge repository was fetched for protocol inspection; its working branch was not modified.

Run the additional packaged integration test with:

```sh
RACK_EXECUTABLE="$PWD/dist/linux-unpacked/rack-studio" node tests/bridge.mjs
```

WAV/take export and deterministic control baking from Generant are still next steps. Existing version-1 patches acquire missing envelope defaults when opened. The FM voice now supports sustained FM for ambient notes; its timbre differs from the earlier fixed percussive FM envelope.
### Audio / MIDI settings (0.7)

Open **Settings** in the top bar. Preferences are stored separately from projects in the desktop profile's `hardware.json`; the browser version uses local storage. Opening a project or the app does not start audio.

- Output selection applies immediately when audio is ready. An unavailable saved output falls back to the system default with a status message. **Allow device discovery** briefly opens then closes microphone access to reveal hardware names; it does not record audio.
- Sample rate (44.1, 48, 96 kHz) and latency preference apply through **Apply / restart audio**, stopping transport and rebuilding samples/wavetables. Diagnostics show actual rate and reported processing/output latency, not an invented buffer size. **Test L → R** plays a short −28 dBFS tone through the output guard independently of mixer levels. **Stop / Panic** stops transport, notes and test tones.
- Enable MIDI, check the input ports to use, select Any or channel 1–16, and route to the selected synth or a fixed instrument. The fixed instrument is session-only; device choices/channel are hardware preferences. Notes, velocity, sustain, note-on velocity zero, and MIDI all-notes-off are supported. Disconnecting or disabling an input releases its notes. No incoming messages are echoed to outputs.
- To record MIDI, select its synth in the tracker, arm **Live Record**, then start playback. Notes use the tracker's quantization and preserve incoming velocity. Sustain extends note duration. Released notes are recorded as an undoable edit; notes crossing the loop boundary split into retriggered segments. Normal mode auditions without writing. MIDI does not yet provide stopped step entry or drum-pad mapping.
- CC/pitch-bend messages are visible in the monitor; general parameter mapping, pitch-bend synthesis, MIDI output, external clock, and audio input recording remain future work. Web MIDI can see OS virtual ports for other applications; this app does not create them.

Validation: `npm test`, `npm run test:settings`, and `node tests/settings-desktop.mjs` (after packaging to `dist-settings`). Browser tests inject MIDI into the real synth engine; desktop tests use an isolated profile to verify hardware permissions and preferences across launches. A physical controller still needs an end-to-end playing check.

### Standalone OSC tracks — 0.8.0

Sequencer → **+ OSC track** creates a track independent of devices and mixer channels. Add an event at `bar:beat` (one-based; fractional beats allowed). `/song/part1` with arguments `[]` is a valid silent cue. Arguments use JSON arrays of strings/numbers; addresses are literal paths without OSC pattern wildcards. A track can contain multiple addresses and simultaneous events. Disable the track to mute all its messages. Changes are project data, undoable, and preserved in save/reopen; editing the OSC score during playback stops transport and clears queued cues.

- **Event** fires once whenever transport crosses it, repeating per loop.
- **State** sends held arguments; visual preview started later restores earlier state without replaying earlier triggers. Use at least one argument.
- **Curve** accepts one numeric argument and Hold/Linear/Smooth interpolation. Curves interpolate through the loop boundary and transmit at 60 Hz.
- **Preview OSC only** starts from the specified position using a clock worker; it enables the Blender bridge but does not boot an audio engine or allocate synth voices. Stop cancels pending receiver cues. The normal Play button also schedules these tracks alongside music when Preview in Blender is enabled. There is no general audio seeking UI yet.
- **Export OSC score** writes the enabled standalone tracks for 1–256 loops, including sampled curves and typed arguments, to `.osc-score.json`. This is not an audio render, nor an export of instrument-generated note/envelope streams or the earlier OSC Control device.
- **Blender add-on…** saves the bundled companion ZIP. See `integrations/osc_score_bridge/README.md` for camera mappings, the shared live/baked Rack OSC Score property source, importing markers/keyframes, and string-state handling.

`demo/standalone-cues.rack.json` and `demo/standalone-cues.osc-score.json` demonstrate section cues, palette strings and scale curves. They do not alter your existing project. Script/agent entry points are `addOscTrack`, `addOscEvent`, `validateOscTracks`, `oscStateAt`, `oscEventsBetween` and `exportOscScore` in `shared/osc-score.mjs`. Apply edits through Store to retain validation/undo. No MCP server is exposed yet.

Tests: `npm test`, `npm run test:osc`, and `blender --background --factory-startup --python tests/cues-blender.py`. Package the companion with `python3 scripts/package-bridge.py` before packaging Electron. The integration tests exercise real UDP, visual-only playback without audio initialization, looping, stop cancellation, state restoration, audio+OSC, export, and Blender bake/backward scrub/reimport.

## Drum Rack (0.12)

Add Device → **Drum Rack** creates an empty, automatically routed 16-pad instrument. Pads use MIDI 36–51 (C2–D♯3). The tracker defaults its keyboard octave to 2 for this device; Z starts at pad 1. Use its tracker or piano roll for sequencing.

Select a pad, open **Sample browser**, and click a sample name to load it. The adjacent ▶ previews the source at the browser volume; the pad’s ▶ auditions through its controls and mixer. Folders, search and drag-to-pad are supported. **Load audio…** accepts your own hits/breaks up to 30 seconds and 20 MB. Loaded sources are embedded in the project; slices share a single source asset. The 5,041-file default collection is copied from your SampleSwap folder into `sample-library/`; the external drive is no longer needed. AIFF entries were converted to PCM WAV for browser playback.

**Length** scales the playback time of each trimmed region without changing pitch or overwriting pad settings. At 25%, each hit or slice lasts a quarter of its full trimmed duration, including its end fade. **End fade** controls the fade, bounded to half the shortened duration. **Pad length** provides an additional per-pad scale; **Follow Length → Off** exempts a pad from the global knob. Reducing Length also closes running voices whose limit is reached; reopening it affects following hits, never resurrects finished voices. Mixer effect tails remain intact.

- **One-shot:** attack then natural sample playback, limited by trim/Length; OFF is ignored.
- **Envelope:** attack, hold and decay; OFF is ignored. Length is still a maximum duration.
- **Gated:** ADSR, with OFF/key release initiating release; playback still cannot exceed the source/Length limit.

Each pad also has gain, pan, tune/fine, reverse, filter, drive, pitch sweep, velocity sensitivity, mute/solo, retrigger/overlap and eight choke groups. Chokes use a short fade. Knobs support Shift-drag and typed exact values. **Slice** divides the selected trimmed region evenly across pads 1–4/8/16, replacing those pads; Undo restores the previous kit. This is even slicing, not transient detection.

Tracker FX 01/02/03 automate global Length, End fade and Output. The kit has a stereo mixer channel and the existing insert chain; individual pad outputs and per-pad effect chains are not part of this version. Tape Drums projects retain their original instrument.

Run `npm run test:kit` for the desktop/audio test, and `python3 scripts/prepare-drum-library.py` to rebuild the local default catalogue. Packaging includes the sample folder as an external Electron resource.
