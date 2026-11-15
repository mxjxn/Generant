# Render & Share

Generant can bounce a **song** or **pattern** to audio, write a **timeline sidecar JSON**, and encode a short **shareable MP4** visualizer for social platforms that reject raw WAV/MP3 uploads.

Blender / ComfyUI remain the path for polished video. This pipeline is meant to finish in minutes.

## What you get

| Artifact | Description |
|----------|-------------|
| `.wav` | Stereo PCM16 bounce (48 kHz when bounced through SuperSonic) |
| `.mp3` / `.aac` | Optional ffmpeg re-encode from the WAV |
| `.timeline.json` | Tempo, segments, pattern changes, notes per track, drums, OSC events |
| `.mp4` | H.264 + AAC visualizer driven by audio features + timeline events |
| `.ppm` | A few preview frames written next to the MP4 |

### Aspects

- `vertical` — 1080×1920 (9:16)
- `square` — 1080×1080 (1:1)
- `landscape` — 1920×1080 (16:9)

### Styles

- `pulse` — concentric energy rings + note sparks
- `ribbons` — band-energy ribbons
- `lattice` — pitch grid that lights with notes
- `bars` — neon spectrum bars

### Overlays (title / artist / cover)

Optional text overlays and cover art, with safe margins for social UI (Reels/Shorts chrome).

| Option | Values | Notes |
|--------|--------|-------|
| Title / artist | free text (≤80) | Defaults from project name / `artist` / `meta.artist` |
| Overlay | on/off | `--no-overlay` / remote `overlay=0` |
| Placement | `auto`, `top-left`, `top`, `bottom-left`, `bottom`, `safe` | `auto` → top-left (9:16/1:1) or bottom-left (16:9) |
| Cover mode | `auto`, `frame`, `backdrop`, `off` | `auto` → backdrop for pulse/ribbons, frame for lattice/bars |
| Cover path | image file | PNG/JPG/WebP; framed inset or blurred/tinted full-bleed backdrop |

## Dependencies

### ffmpeg

Video and MP3/AAC encoding require **ffmpeg** with `libx264` and `aac` (and `libmp3lame` for MP3).

Detection order:

1. `FFMPEG_PATH` or `GENERANT_FFMPEG`
2. `ffmpeg` on `PATH`
3. `/usr/bin/ffmpeg`, `/usr/local/bin/ffmpeg`, `/opt/homebrew/bin/ffmpeg`

ffmpeg is **not** bundled with Generant. Install it with your OS package manager (`apt install ffmpeg`, `brew install ffmpeg`, etc.). Probe from the CLI:

```bash
node scripts/render.mjs probe
```

### SuperSonic bounce vs preview synth

| Path | Audio quality | Needs |
|------|---------------|-------|
| UI / remote API / `--via-remote` | Realtime SuperSonic mix | Running Generant desktop app |
| CLI `--preview` (default offline) | Lightweight oscillator sketch from the timeline | Node only |

OfflineAudioContext cannot drive WASM scsynth, so engine bounces are **realtime** (play once, capture after the output guard). A short release **tail** (default 1.5 s) is appended after transport ends.

## Render queue

Multiple jobs (song / pattern / video) can be enqueued and processed in order:

- **One SuperSonic bounce at a time** (realtime capture cannot overlap)
- **Up to two ffmpeg encodes** may run in parallel after their bounces finish
- Per-job failures cancel only that job; the rest of the queue continues
- The queue is a **renderer singleton** — closing the Render & Share dialog does not clear it

UI shows status, progress, Cancel, and Reveal for finished paths. Output folder is remembered for the session.

## UI

- **File → Render & Share…** (or `Ctrl/Cmd+Shift+R`)
- Song arranger → **Render song…**
- Native menu **File → Render Song / Render Pattern**

Fields: source, audio format, style, aspect, title/artist, overlay on/off, placement, cover mode + file picker, then **Enqueue**. The queue list stays live while the dialog is open and survives close/reopen.

## CLI

```bash
# Song → preview WAV + vertical pulse MP4 with overlays
node scripts/render.mjs song demos/Sideways\ Bloom.rack.json \
  --out /tmp/bloom --max-seconds 8 --style pulse --aspect vertical \
  --title "Sideways Bloom" --artist Generant --placement auto

# Cover as framed art
node scripts/render.mjs song path/to.rack.json --cover art.png --cover-mode frame --aspect square

# Pattern + bars, no text overlay
node scripts/render.mjs pattern path/to.rack.json --pattern "Pattern 00" --style bars --no-overlay

# Video from an existing bounce
node scripts/render.mjs video --wav mix.wav --timeline mix.timeline.json --out /tmp/share --style ribbons --aspect landscape

# Ask a running Generant instance to bounce for real
node scripts/render.mjs song path/to.rack.json --via-remote --out /tmp/engine-bounce

# Enqueue without waiting (returns jobId; progress/complete arrive as render/* events)
node scripts/render.mjs song path/to.rack.json --via-remote --queue --out /tmp/engine-bounce
```

npm script:

```bash
npm run render -- song demos/Sideways\ Bloom.rack.json --out /tmp/bloom --max-seconds 4
```

## Remote API (WebSocket `127.0.0.1:57143`)

Preferred for agents (Telegram bots, etc.) because replies include progress and result paths. UDP OSC on `57142` accepts the same addresses but cannot return the file path.

### Blocking render (waits for completion)

```text
/generant/v1/render/song    [format, style, aspect, title, artist, videoFlag, maxSeconds, outDir, pattern, overlay, placement, coverPath, coverMode]
/generant/v1/render/pattern [… same …]
/generant/v1/render/video   [… same …]
```

Args may be omitted (defaults: `wav`, `pulse`, `vertical`, project title/artist, video on, overlay on, placement `auto`, cover mode `auto`).

### Queue (stack jobs; get each path as it finishes)

```text
/generant/v1/render/queue/add    [mode?, format, style, aspect, title, artist, videoFlag, maxSeconds, outDir, pattern, overlay, placement, coverPath, coverMode]
/generant/v1/render/queue/list
/generant/v1/render/queue/cancel [jobId]
/generant/v1/render/queue/clear
```

`queue/add` replies immediately with `{jobId, queued:true}`. Progress and completion are broadcast to all WS clients:

```json
{"event":"render/progress","jobId":"rj-…","progress":0.4,"message":"Bouncing…","status":"bouncing"}
{"event":"render/complete","jobId":"rj-…","result":{"ok":true,"dir":"…","files":{"wav":"…","video":"…"}}}
{"event":"render/failed","jobId":"rj-…","error":"…"}
```

WebSocket enqueue example:

```json
{"id":1,"address":"/generant/v1/render/queue/add","args":["song","wav","pulse","square","Sideways Bloom","Generant",1,12,"/tmp/generant-out"]}
```

Blocking render progress (tied to request id):

```json
{"id":1,"event":"progress","progress":0.4,"message":"Bouncing 40%"}
```

Final blocking reply:

```json
{"id":1,"ok":true,"result":{"ok":true,"jobId":"rj-…","dir":"/tmp/generant-out/...","files":{"wav":"...","timeline":"...","video":"..."}}}
```

## Timeline sidecar shape

```json
{
  "format": "generant-render-timeline",
  "version": 1,
  "name": "Sideways Bloom",
  "mode": "song",
  "bpm": 160,
  "durationSeconds": 96,
  "segments": [{"patternId":"…","startSeconds":0,"section":"A"}],
  "patternChanges": [{"seconds":0,"patternName":"Pattern 00"}],
  "tracks": [{"deviceId":"keys","notes":[{"seconds":0.5,"pitch":60,"durationSeconds":0.25}]}],
  "drums": [{"seconds":0,"pad":0,"velocity":0.8}],
  "oscEvents": []
}
```

## Architecture

```
shared/render.mjs         timeline, WAV, preview synth, options, safe margins
shared/render-queue.mjs   serial bounce + overlapping encode jobs
shared/visualizer.mjs     software frames + text/cover overlays
app/ffmpeg.mjs            ffmpeg discovery + encode + cover load
app/render-export.mjs     main-process write bundle / pick / reveal
public/capture-processor.js  AudioWorklet PCM tap
public/audio.mjs          Engine.render() realtime bounce
public/render-host.mjs    singleton queue wired to engine + desktop
public/render-panel.mjs   UI dialog + live queue
scripts/render.mjs        CLI
```

## Sample outputs

Preview frames and short MP4s (CLI preview synth, not SuperSonic) live in [`docs/assets/render/samples/`](assets/render/samples/):

- `song-vertical-pulse.png` / `.mp4` — 9:16 pulse style
- `pattern-square-bars.png` / `.mp4` — 1:1 bars style
- `song-landscape-ribbons.png` — 16:9 ribbons still
- `overlay-vertical-pulse.png` / `.mp4` — title/artist + backdrop cover (9:16)
- `overlay-square-frame.png` / `.mp4` — framed cover + text (1:1)
- `overlay-landscape-ribbons.png` — text placement bottom-left (16:9)

Regenerate with:

```bash
npm run render -- song demos/Sideways\ Bloom.rack.json --out /tmp/out --max-seconds 4 --style pulse --aspect vertical --title "Sideways Bloom" --artist Generant
```

## Tests

```bash
npm test
node --test tests/render.test.mjs
```

`tests/render.test.mjs` covers timeline export, WAV roundtrip, remote command parsing (including queue + overlays), visualizer overlays/cover, the render queue pump, and a short ffmpeg MP4 encode when ffmpeg is installed.
