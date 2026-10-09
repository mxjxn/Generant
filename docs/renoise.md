# Renoise integration

The Renoise tool is maintained separately at [mxjxn/generant-renoise](https://github.com/mxjxn/generant-renoise). That repository contains the installable `.xrnx`, source, and its own documentation.

## Ports

- Generant receives commands on `127.0.0.1:57142`.
- OSC Score Bridge receives visual messages on `127.0.0.1:57141`.

Both destinations and the host can be changed in the Renoise panel. Generant listens only on localhost by default.

## Automatic transport

When **Send tempo, play, and stop** is enabled, Renoise sends the current tempo immediately before Play, then sends Play or Stop whenever its transport changes. Generant must be stopped before accepting a tempo change.

When **Queue selected sequence as song position** is enabled, selecting Renoise sequence 1 queues Generant song position 0, sequence 2 queues position 1, and so on. The two arrangements therefore need corresponding positions.

## Tracker events and score export

The tool reads two-character mapping IDs and hexadecimal values from effect columns on `[OSC]` tracks. It also reads automation envelopes associated with those mappings. Events can be sent live or exported in the same `rack-osc-score` JSON format that Generant and OSC Score Bridge use.

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
