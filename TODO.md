# Generant — product roadmap and working backlog

Updated: 2026-10-08. Current build: Sideways Bloom example 0.10.1.

## Composition example — 0.10.1

- [x] Sideways Bloom: 64-bar / 160 BPM footwork song, six devices, PR changes and embedded drum samples.
- [x] File → Open Example submenu for all demos; opening a demo remains silent until Play.
- [ ] User musical review of the arrangement and instrument sound.

## Preset recall — 0.10.0

- [x] Device-local program slots and immutable preset snapshots saved in project.
- [x] PR tracker command, scheduled same-engine recall, seek resolution and FX/CV precedence.
- [x] Routed MIDI Program Change and undoable code API.
- [x] Audio/UI, MIDI routing and serialization regression checks.
- [ ] Record program changes, preset morphing, Bank Select, cross-engine switching and preset-bank management/export.

## Project lifecycle — 0.9.1

- [x] Empty startup, explicit File demos, New/Empty project and persistent user default project.
- [x] Delete any device, including legacy starter devices, with all-pattern cleanup and undo.
- [x] Per-position deletion, toolbar action and fresh empty position when deleting the last occurrence.
- [x] Empty-rack add-device workflow, session/default persistence and desktop regression coverage.
- [ ] Multiple Tape Drums and Motion instances (currently singleton storage/engine).

## Song sequencer — 0.9.0

- [x] Whole-song pattern pool, ordered references, New/Repeat/Clone/Make unique, position removal and reordering.
- [x] Compact device matrix, independent edit/play positions, Follow, Song/Pattern modes, range looping and boundary-queued launch.
- [x] Variable pattern rows, cross-pattern note/OFF continuity and release tails at natural song end.
- [x] Pattern OSC plus occurrence-specific cues; shared resolved playback/export timeline.
- [x] Schema v3 migration, undo and save/reopen coverage; desktop audio/OSC integration checks.
- [ ] User composition pass to refine navigation, density and pattern management.
- [ ] Song-mode live recording across changing pattern targets; automation recording.
- [ ] Per-track aliases, rectangular selection/copy/paste, and bulk arrangement editing.
- [ ] Agent-facing transaction API and audio/AV rendering using the resolved song timeline.

## Four FM pass — 0.5.0

- [x] Four operators with independent tuning, ratio/fixed-Hz mode, envelopes, output and modulator gain; full cyclic modulation matrix.
- [x] Instrument patch selector, factory sounds, project patch library and JSON import/export; undoable loading preserves notes/routes.
- [x] Eight assignable CV inputs, destination-unit signed depth, polarity, smoothing, internal per-note sources and external Motion cable.
- [x] Multiple CV contributions sum; disconnected inputs return to base; modulation ranges shown without overwriting base controls.
- [x] Legacy engine/project migration and appended stable tracker indexes.
- [ ] User audition of the engine and matrix/CV workflow before expanding it.
- [ ] Macros, more modulation devices, mono/legato/glide, operator waveforms, oversampling, richer envelope graphs and global preset browser.

## Tracker pass — 0.4.0

- [x] Device-scoped Note / Vel / FX editor, polyphonic note columns, OFF entries instead of a duration column.
- [x] Stable hexadecimal FX index maps, 00–FF values, Hold/Linear/Smooth interpolation through loop boundaries, per-device Read FX.
- [x] Separate compact selected-device FX reference and persistent ? contextual help dock; no floating native title tooltips.
- [x] Shared tracker/piano notes with exact off-grid timing; individual cell editing and undo.
- [x] Synth/effect parameter playback and normalized named OSC control sequences; Stop restores base controls.
- [ ] User review of typing, column density, reference readability, and automation editing before more editor features.
- [ ] Rectangular selection, copy/paste/transpose, configurable edit step and computer-keyboard note input.
- [ ] Graphical curve lane and automation recording, with explicit base/automation/CV precedence indicators.
- [ ] Freely timed pitched drum events, independent pattern banks and arrangement.

## Purpose

Build a complete music-production application with the immediacy of a hardware rack, expressive sequencing, fluid code/UI interaction, and synchronized visual performance. Reason and Ableton are the long-term quality and capability benchmarks. Feature count alone is not success: each milestone must support making and finishing music comfortably.

Our first proving grounds are ambient composition, footwork/jungle rhythm programming, and daily audiovisual pieces. This is a staged backlog, not a promise that all features or architectural choices are already settled. There are no delivery-date estimates yet.

## How we work through this document

- `[x]` means implemented and verified; `[ ]` means outstanding. Discussed designs remain unchecked until implemented.
- Work on one milestone at a time. Record decisions, outstanding issues, and validation before marking its exit criteria complete.
- Break the active milestone into small changes that leave a usable application after each pass.
- Review meaningful workflow changes together with a playable example before expanding their scope.
- Preserve existing projects through explicit migrations and backups. Keep personal samples out of distributable content.
- Maintain one project state, one audio-engine owner, and one undo history across every view and window.
- Test audible behavior and interactions, including save/reopen and recovery, rather than only matching implementation details.
- Record deferred ideas here rather than adding unrelated features to the active milestone.

## Current baseline

- [x] Electron application with bundled SuperSonic audio engine; silent startup.
- [x] Glass Keys, four-pad Tape Drums, Motion CV, and Contour distortion.
- [x] Piano-roll editing, drum steps, and a single repeating project loop.
- [x] Knobs/faders with Shift fine adjustment, reset, exact entry, and gesture-level undo.
- [x] Volume/modulation ADSRs, audition Hold/Release, and Retrigger.
- [x] Per-pad sample controls, waveform trim, mute/solo, and meters.
- [x] Patch JSON editing, validation, save/open, undo/redo, and embedded samples.
- [x] Limited audio/CV connections and timestamped OSC output for Blender preview.
- [x] Model, interaction, DSP, and packaged OSC checks for the existing implementation.

0.3 adds separate workspaces, track/device/channel identities, additional Keys and Contour instances, independent note clips, channel strips, and shared insert routing. Current limits: eight instrument channels, one drum kit and Motion source, one insert per channel, one shared loop length, mono sample import, no sends/groups, arrangement, MIDI, recording, audio export, Matrix banks, or detachable windows. macOS configuration exists but has not been validated.

## Product decisions to carry forward

### Three workspaces

| Workspace | Responsibility | Selection context |
| --- | --- | --- |
| Sequencer | Tracks, clips, notes, drum patterns, arrangement, automation | Track and clip |
| Rack | Instruments, effects, CV devices, macros, front/rear patching | Device |
| Mixer | Channel gain/pan, inserts, sends, buses, master, meters | Channel |

The top-level workspace switcher is distinct from the global transport. Rack front/back switching lives inside Rack. Each workspace remembers its own selection and scroll position. Explicit “Show device,” “Show track,” and “Show channel” actions connect related objects without unexpectedly changing other views.

Track/clip type determines its editor: notes open a piano roll; a drum-pattern clip opens the drum grid; automation opens curves; audio eventually opens a waveform editor. No unrelated editor tabs attached to a selected synth.

Matrix is an independent rack sequencer with A–D banks and patterns 1–8. Its note/gate/curve outputs can drive other rack devices. The main sequencer can schedule its pattern changes; Matrix can also operate outside song playback.

An instrument's Audio Out menu and the rear patch bay are two views of the same routing data. Mixer inserts and sends reference rack effect instances. Editing an effect from the mixer opens that same instance.

### Signal and control rules

- Audio, continuous CV, pitch, and gate/event connections need explicit types and units. Define conversions rather than assuming all signals mean the same thing.
- Preserve a documented normalized 0–1 continuous-CV contract, with signed depth, range, polarity, and smoothing at the destination. Define pitch units and gate/retrigger semantics separately before implementing Matrix.
- Internal audio needs headroom for mixing and processing. Keep finite-value checks and a final protected output; do not silently saturate every internal connection.
- A parameter has a base value and inspectable modulation. Specify how automation, macros, CV, and MIDI interact; changing the UI must never silently erase modulation.
- Both code and UI use the same validated commands and parameter identities. Code edits participate in undo, persistence, and live-engine updates.
- Distinguish note-off/release, transport stop, independent-device run state, and a global Panic action that always silences everything.

## Milestone 0 — trustworthy daily use

Goal: safely open, edit, save, close, and recover one project.

- [ ] Reproduce the old windows refusing normal close. Inspect the unsaved-project handler and Electron close lifecycle; the cause is not yet confirmed.
- [x] Provide native Save / Discard / Cancel on close; automated lifecycle checks cover cancellation and save/reopen.
- [x] Define second-launch behavior: focus the existing project by default. Intentional additional project windows remain future work.
- [ ] Autosave recoverable snapshots and offer recovery after an unexpected exit.
- [ ] Show application version, active project path, unsaved state, and actionable audio errors.
- [ ] Verify graceful shutdown of audio, scheduler, OSC, and child windows.
- [ ] Establish basic CPU/audio-load and dropout diagnostics.

Exit: edit and close normally; recover after forced termination; reopen the saved project without losing notes, samples, parameters, or routing.

## Milestone 1 — coherent workspace UX

Goal: clearly separate composing, sound design, and mixing.

- [ ] Review a simple layout prototype for Sequencer, Rack, and Mixer, including small/tiled windows.
- [x] Create a workspace switcher and shared transport with clear visual grouping.
- [x] Move the device browser, instrument workshop, and front/rear controls into Rack.
- [x] Move sequencing into Sequencer; introduce track selection and the correct editor for each track.
- [x] Separate track/clip, device, and mixer-channel selection in view state (one clip per track currently).
- [x] Provide explicit navigation between a track, its instrument, and its mixer channel.
- [x] Keep patch/code editing available in a clearly labeled inspector or drawer.
- [ ] Remember workspace selection, panel sizes, zoom, and scroll position.
- [ ] Establish consistent shortcuts, focus indication, tooltips, accessible control labels, and scalable text.
- [x] Add the initial Mixer view with real channel controls and insert assignment.

Exit: select Keys and edit notes; select Drums and edit steps; adjust either instrument in Rack; return to the same clip and edit position. No ambiguous editor switching or duplicate navigation controls.

## Milestone 2 — extensible project and engine model

Goal: support multiple instruments, tracks, clips, and channels without hard-coded identities or buses.

- [ ] Introduce stable IDs for device instances, tracks, clips, channels, ports, and parameter targets.
- [ ] Separate persistent musical data from temporary UI state and engine handles.
- [x] Version the project schema; migrate existing `.rack.json` projects, including separate inserts for old dual-target Contour settings.
- [ ] Add device create, duplicate, rename, reorder, and delete commands with undo and reference cleanup.
- [ ] Add a parameter registry: units, ranges, defaults, scaling, modulation eligibility, and live-versus-next-note behavior.
- [ ] Allocate audio/control buses and node order from a validated routing graph.
- [ ] Reject unsupported cycles clearly; design explicit delayed-feedback devices later.
- [ ] Introduce engine lifecycle ownership independent of the visible workspace, preparing for detachable windows.
- [ ] Apply routing and structural edits atomically without stuck notes or partially updated graphs.
- [ ] Define asset references and migration away from large base64-only project files.

Dependency: this work can support Milestone 1 in small increments; complete it before general mixer routing or multiple Matrix instances.

Exit: create two Glass Keys instances with independent notes, parameters, and outputs; duplicate one; rename both; save/reopen; undo deletion with connections restored.

## Milestone 3 — mixer, patch bay, and effects routing

- [ ] Instrument Audio Out menu: existing channel, new channel, bus, master, or disconnected.
- [ ] Synchronize Audio Out menus, rear cables, and mixer routing from one graph.
- [x] Basic channel strips with gain, pan, mute/solo, peak meters, and linked instrument names.
- [ ] Add pre-fader clipping indication and user-assigned channel colors.
- [ ] Ordered insert chains referencing editable rack effects; bypass and reorder without losing settings.
- [x] Allow independent Contour instances shared between their Rack controls and Mixer insert assignment (one insert slot per channel currently).
- [ ] Auxiliary sends, return channels, pre/post-fader choice, and group buses.
- [ ] Define solo behavior across sends, groups, and returns; retain a working Panic action.
- [ ] Optional per-pad drum outputs and a shared drum bus.
- [ ] Add core EQ/filter, delay, reverb, compressor, and utility gain/width devices in separate reviewable passes.
- [ ] Design sidechain inputs and latency accounting; show unsupported routes explicitly.
- [ ] Loudness-conscious bypass comparison, useful meter scales, and adequate summing headroom.

Exit: route drums through Contour to a drum bus; send drums and keys to one reverb; adjust the return; save/reopen with equivalent sound and routing.

## Milestone 4 — modulation and Matrix

- [ ] Document the parameter-combination order and display base and effective values.
- [ ] Generalize Motion with free/synced rate, phase/reset, polarity, and destination scaling.
- [ ] Typed rear ports, visible cable paths, connection inspection, and helpful incompatible-port feedback.
- [ ] Matrix A–D × 1–8 pattern banks with copy/paste, duplicate, clear, and rename.
- [ ] Editable step count, resolution, gate length, ties, velocity/accent, note values, and curve values.
- [ ] Separate exact note editing from continuous curve drawing; reuse piano-roll conventions where useful.
- [ ] Note, gate/retrigger, curve, and accent outputs with documented units.
- [ ] Song-synced, free-running, externally triggered, and one-shot clock modes.
- [ ] Define start phase, restart/resume, pattern-change quantization, and behavior when transport stops.
- [ ] Schedule Matrix pattern changes from the main sequencer.
- [ ] Modulation utilities: scaling, offset, inversion, smoothing, mixing, and sample-and-hold as needed.
- [ ] Inspect a parameter's incoming modulation and audition its range without losing its base setting.

Exit: Matrix drives a repeating filter curve on Glass Keys while another source plays its notes; pattern changes land on the chosen boundary; independent playback and Panic behave predictably.

## Milestone 5 — composition, arrangement, and automation

- [ ] Multiple clips per track and a song timeline with move/copy/trim/loop operations.
- [ ] Clip loop length independent of song loop length; clear beat/bar rulers and snapping.
- [ ] Piano-roll refinements: audition, quantize, swing, humanize, velocity lanes, chord editing, and legato tools.
- [ ] Drum probability, microtiming, ratchets, accents, and per-step parameter changes.
- [ ] Automation lanes using the shared parameter registry, including curves and precise point editing.
- [ ] Define read/touch/latch/write and manual override behavior before exposing recording modes.
- [ ] Markers, arrangement loop regions, tempo/time-signature handling, and long release tails across boundaries.
- [ ] Session-style clip launching and scenes, with quantized launch/stop and a visible return-to-arrangement state.
- [ ] Record a clip-launch performance into the arrangement.

Exit: compose and revise a complete piece with several sections, automation, transitions, and deliberate loop boundaries; save/reopen and reproduce playback.

## Milestone 6 — macros, MIDI, and performance

- [ ] Macro controller device with multiple targets per control, target ranges, polarity, curves, and useful labels.
- [ ] Macro mapping editor with live range preview and removal/undo.
- [ ] MIDI input discovery, hotplug, channel filtering, note routing, sustain, pitch bend, and modulation wheel.
- [ ] MIDI learn for exposed parameters and macros; absolute/relative modes, pickup, and range mapping.
- [ ] Separate project mappings from reusable controller profiles.
- [ ] Record MIDI into clips with count-in, metronome, overdub, quantization options, and latency calibration.
- [ ] MIDI output and hardware clock/start/stop; explicitly prevent feedback loops.
- [ ] Evaluate MPE, external synchronization, and controller feedback after basic MIDI works reliably.

Exit: play and record a synth from a keyboard, map a knob to a multi-target macro, reconnect the controller, and restore mappings from the project/profile.

## Milestone 7 — recording, samples, and finishing music

Prioritize basic stereo WAV export as an early independent slice once engine ownership is stable; do not wait for every item above.

- [ ] Stereo render/export with sample rate, bit depth, normalization choice, and explicit tail handling.
- [ ] Loop export with reproducible start state; choose whether tails wrap into the beginning or extend the file.
- [ ] Stem export with documented insert/send/master processing choices.
- [ ] Audio device selection, buffer/latency controls where supported, and clear capability reporting.
- [ ] Audio tracks, input monitoring, recording, punch-in, and take management.
- [ ] Stereo sample preservation, larger assets, streaming strategy, missing-file repair, and collect-and-save.
- [ ] Sample browser with search, tagging, preview, and useful drum-kit loading.
- [ ] Sampler zones, slicing, envelopes, looping, round-robin/velocity layers, and resampling.
- [ ] Nondestructive audio clip editing, fades, crossfades, time stretching, and warp markers.
- [ ] Freeze/flatten, bounce-in-place, and practical CPU management.
- [ ] Verify render reproducibility, random seeds, tempo changes, and effects tails.

Exit: create a piece from MIDI and recorded/imported audio, reopen it on another machine with collected assets, and export a full mix and aligned stems.

## Milestone 8 — code, custom devices, and visual scoring

- [ ] Structured code editor with validation errors, change preview, and undoable apply.
- [ ] Safe live parameter/pattern changes with clear scheduling boundaries and UI reflection.
- [ ] Define custom-device packages: compiled SynthDefs, parameter/port metadata, UI face, assets, version, and compatibility.
- [ ] SynthDef authoring/build workflow with useful compiler errors and versioned presets.
- [ ] Define hot replacement for existing versus new voices; recover cleanly from a failed compile/load.
- [ ] Separate trusted local code from imported device capabilities and resource limits.
- [ ] Persistent OSC destination configuration and protocol/capability status; distinguish sending from acknowledged connection.
- [ ] User-mappable musical events, envelopes, macros, and analysis signals for Blender.
- [ ] Export timestamped control/event scores alongside audio for repeatable offline visual baking.
- [ ] Loop duration/frame-rate helper and render alignment checks for daily videos.
- [ ] Reproducible audiovisual take metadata: project revision, tempo, duration, random seed, audio file, and score file.
- [ ] Evaluate Renoise exchange and bidirectional OSC/MIDI sequencing as a separate interoperability slice.

Exit: edit a device through code and knobs without state disagreement; export one audio take plus a score that reproduces the intended Blender timing.

## Milestone 9 — detachable windows and platform quality

- [ ] Detach/reattach Sequencer, Rack, and Mixer onto one shared project and engine.
- [ ] Synchronize selection links, commands, undo, dialogs, and project dirty state across windows.
- [ ] Closing a detached view does not destroy the project or audio engine; quitting the project is explicit.
- [ ] Restore layouts where the window manager permits, and recover off-screen windows after monitor changes.
- [ ] Validate Ubuntu/Hyprland and macOS windowing, shortcuts, focus, audio, MIDI, dialogs, and file paths.
- [ ] Test Retina/scaled displays, keyboard-only workflows, screen-reader labels, and reduced motion.
- [ ] Reproducible packages, release notes, signing/notarization where required, and upgrade/recovery tests.

Dependency: can move earlier after Milestones 1–2 if multiple windows become the main workflow blocker.

Exit: use three views across monitors, close/reopen individual views, then reopen the entire project on each supported platform without duplicate playback or lost edits.

## Milestone 10 — competitive production platform

These require separate technical investigations and measured prototypes before committing implementation scope.

- [ ] Profile large projects: voice counts, device counts, automation density, memory, load time, dropouts, and UI responsiveness.
- [ ] Evaluate whether the current AudioWorklet/WASM engine meets recording, routing, offline rendering, and latency goals; document when a native audio backend would be needed.
- [ ] Investigate third-party plugin hosting, process isolation, plugin scanning, crash recovery, and licensing/platform constraints. Do not assume VST3/AU/CLAP can run in the current browser engine.
- [ ] Full latency compensation across inserts, sends, parallel routes, recording, and export.
- [ ] Advanced recording/comping, editing, controller integration, and large-library workflows.
- [ ] Device/preset browser, searchable command palette, tutorials, contextual help, and polished first-run experience.
- [ ] Portable third-party device development kit and documented project/interchange formats.
- [ ] Licensing and attribution review for engine dependencies, bundled devices, samples, and distributions.
- [ ] Compare complete real-world tasks against Reason/Ableton: time to sketch, sound design, arrange, perform, mix, recover, and deliver.

Exit: musicians can finish substantial projects reliably without routinely leaving the app to overcome core workflow gaps. Define concrete project benchmarks and acceptance thresholds before calling this production-ready.

## First implementation queue

1. Investigate and resolve normal window closing and unsaved-project handling.
2. Review the three-workspace layout and navigation behavior with a small mockup.
3. Separate Rack and Sequencer in the existing app; make editor selection follow the track.
4. Introduce stable track/device/channel identities and migrate the current demo projects.
5. Build real mixer channels and Audio Out routing; convert Contour to an effect instance.
6. Review that complete composing → sound design → mixing workflow before starting Matrix.

## Decisions to resolve when their milestone starts

- Track model: one primary instrument per track initially; what should multi-instrument and layered tracks look like later?
- Drum clips: when should a user intentionally switch between a step grid and pitched drum notes?
- Modulation: exact base/automation/macro/CV precedence, clipping rules, and unipolar versus centered interpretation.
- Clock: what survives song Stop, and how is an independently running device clearly indicated?
- Effects: distinguish one shared send instance from separate copied inserts; prevent accidental multi-channel state sharing.
- Assets: project folder, packed archive, or both; autosave retention and missing-file recovery.
- Live coding: project-data expressions first, pattern language next, or direct SC authoring through an optional local service?
- Deployment: macOS/Linux first; decide Windows support and distribution requirements explicitly.

## Work log

| Date | Outcome | Next review |
| --- | --- | --- |
| 2026-10-08 | Roadmap drafted from the workspace discussion and current 0.2 implementation. No roadmap features implemented by this document. | Close/recovery behavior and three-workspace layout |
| 2026-10-08 | 0.3 studio milestone: three workspaces, independent Keys tracks, mixer strips, Contour insert instances, v2 migration, native close handling, and recovery snapshots. Model/UI/audio and desktop save/reopen checks added. The broader numbered milestones above remain partially complete. | User review of composing → sound design → mixing; sends/buses and Matrix remain next-stage work |
| 2026-10-08 | 0.3.1 utility rack: compact top bar and name-only sidebar, persistent vertical device panels, Add versus Duplicate, rear cable rendering, mixer patch bay, explicitly labeled/shaped CV IN/OUT, and signed connection depth. Removed presentational headers and project information blocks. | Review rack density, port readability, and patching interactions |

| 2026-10-08 | 0.4 tracker: device-specific Note/OFF, hex Vel/FX, FX reference, persistent contextual help, loop interpolation and named OSC control. Core, browser/audio, native save/reopen and UDP checks cover the new state and scheduling. | Review tracker workflow before block operations and graphical curve editing |


| 2026-10-08 | 0.5.1 tracker keyboard: Normal/Insert modes, two-octave piano, Caps Lock OFF, edit step, quantized live note overdubbing, and held-note cleanup. | Review composing by keyboard; block editing, tied loop recording and MIDI remain future work. |

## Agent-driven audiovisual score — current pass 0.8.0

- [x] Standalone sequencer OSC tracks, independent of synths and mixer channels.
- [x] Typed custom address messages, one-shot cues, held state, looping numeric curves, validation and undo.
- [x] Shared score scheduling/export semantics, visual-only playback and audio-synchronized event scheduling.
- [x] Bundled installed-version Blender bridge, silent cue dispatch, camera routing, JSON score bake, trigger counters and numeric/string state.
- [x] Real UDP and isolated headless Blender regression checks.
- [ ] Shared application command API with revision-checked transactions and capability discovery.
- [ ] SDK and MCP facade over that same command API.
- [ ] Audio render jobs and combined export of synth note/envelope streams and standalone OSC tracks.
- [ ] Multi-section arrangement, visual render job orchestration, video muxing and artifact delivery.
- [ ] General OSC clip/curve drawing, CC mapping, and visual mapping authoring inside Generant.

This pass implements independent cues and the companion bridge; it does not complete the describe→music→video agent workflow. Source: `integrations/osc_score_bridge` (based on installed 1.1, now 1.2); the older sibling plugin checkout remains untouched.
