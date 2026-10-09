# Generant OSC for Renoise

This Renoise 3.5 tool sends OSC to:

- Generant on `127.0.0.1:57142`
- OSC Score Bridge in Blender on `127.0.0.1:57141`

Open it from **Tools → Generant OSC → Open panel**.

With transport sync enabled, Renoise sends tempo before play, sends stop, and can queue the selected Renoise sequence as the corresponding zero-based Generant song position. The panel also sends arbitrary numeric, string, or empty OSC cues to Blender. **Pulse** sends `1` followed by `0` after the selected release time.

Generant must be running to receive its commands. Blender must have OSC Score Bridge listening to receive visual cues.
