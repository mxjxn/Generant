# Instruments, effects, and CV

Generant devices are stored in the project model and rendered by SuperSonic SynthDefs. A project can contain instrument devices, effect devices, CV sources, CV utilities, and mixer channels.

## Instruments

The current library includes Four FM, Envelope Wavetable, VCO, Granular Clouds, Drum Rack, Tape Drums, Glass Keys, and Motion. Drum Rack uses project or library samples. Wavetable assets are project-owned and can be shared by multiple devices.

Add devices from the Rack, Sequencer, or Mixer. Selecting an instrument exposes its editor and track. Deleting a device removes its track, channel, connections, and musical data as one undoable operation.

## Effects and routing

Effects are inserted on a mixer channel. The Rack front shows device controls; the back shows audio and CV sockets. Audio routes to a mixer channel and then to the master output. Each channel has an ordered insert chain.

Available utilities include Gain / Trim, VCA, Multimode Filter, FreeVerb, GVerb Hall, Chorus, Phaser, Stereo Delay, Contour, LFO, Envelope, and CV Scale / Mix.

## CV contract

CV values are normalized to 0..1. Bipolar modulation is represented around 0.5; destinations expose signed depth where appropriate. Cable amount and destination depth multiply together. CV cycles are rejected. Modulators include free-running or tempo-synced LFOs, triggered/held/looping envelopes, gates, and scale/mix utilities.

## Building a custom instrument

1. Add or edit a SynthDef in sc/.
2. Compile it with the SuperSonic-compatible toolchain.
3. Add the generated .scsyndef to public/synthdefs/.
4. Define its device parameters and defaults in shared/.
5. Add the editor controls in public/.
6. Add model and audio tests before exposing it in the Add Device menu.

Keep parameter ranges normalized at the device boundary and clamp or shape values inside the SynthDef before they reach audio output.
