# Renoise integration

Generant includes a Renoise 3.5 / API 6.2 tool at `integrations/renoise/com.mxjxn.GenerantOsc.xrnx` and an installable package at `dist/Generant-Osc-Renoise-1.0.xrnx` after running:

```sh
./scripts/package-renoise.sh
```

Install the package in Renoise, then open **Tools → Generant OSC → Open panel**.

## Ports

- Generant receives commands on `127.0.0.1:57142`.
- OSC Score Bridge receives visual messages on `127.0.0.1:57141`.

Both destinations and the host can be changed in the Renoise panel. Generant listens only on localhost by default.

## Automatic transport

When **Send tempo, play, and stop** is enabled, Renoise sends the current tempo immediately before Play, then sends Play or Stop whenever its transport changes. Generant must be stopped before accepting a tempo change.

When **Queue selected sequence as song position** is enabled, selecting Renoise sequence 1 queues Generant song position 0, sequence 2 queues position 1, and so on. The two arrangements therefore need corresponding positions.

## Visual cues

Enter any non-reserved OSC address and send a number, string, or no arguments. **Pulse 1 → 0** sends `1`, waits for the configured release time, then sends `0`. With OSC Score Bridge listening in Blender, a pulse such as `/visual/kick` updates `Rack OSC Score["osc:/visual/kick"]` live.

The first version sends cues live. Recording Renoise cues into the bridge's JSON score format is a separate step.

## Generant commands

The Renoise tool currently uses:

```text
/generant/v1/transport/play
/generant/v1/transport/stop
/generant/v1/transport/toggle
/generant/v1/transport/tempo <bpm>
/generant/v1/song/position/select <zero-based index>
/generant/v1/song/position/queue <zero-based index>
/generant/v1/pattern/select <pattern id or exact name>
/generant/v1/pattern/queue <pattern id or exact name>
/generant/v1/device/param <device id or exact name> <parameter id> <value>
```

Pattern and song-position queue commands wait for Generant's next pattern boundary when Generant is already playing. Select commands change the editor selection immediately. Device parameter values use the parameter's native unit and are checked by the Generant project model.
