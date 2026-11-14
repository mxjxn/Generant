# LAYOUT PROPOSAL — the sequencer is home, the rack is reachable

Status: PLAN ONLY — no code until mxjxn picks a phase. GO pauses per roadmap convention.
Date: 2026-11-14. Origin: bank-strip placement discussion (ReBirth pattern-on-device vs Generant central sequencing).

## Problem

Generant's workspaces are exclusive full-page views (`changeWorkspace`/`renderWorkspace`
hide/show `pages.*`). Consequences:

- While the sequencer plays, the devices are invisible. You perform bank swaps from the
  sequencer (strip lives there now) but any knob work means leaving the view the music is
  on — the opposite of ReBirth, where the machine sat in front of you while the sequencer ran.
- Transport (header) is the only persistent element.
- Renoise/ReBirth/FL all keep sequencer + devices visible simultaneously. That is the feel
  being asked for.

## Principle

1. The sequencer view is home. Everything performance-relevant must be reachable from it.
2. The rack stays synthesis-only (patching, params, presets) — no sequencing UI on devices.
3. Any persistent region must not break tracker scroll heights, which are computed off
   viewport (`calc(100vh - 210px/250px)` plus `body:has(#contextHelp…)` variants).

## Option A — persistent device dock (RECOMMENDED, phased)

A collapsible horizontal dock along the bottom of the window (above the footer), visible in
every workspace. It hosts the *selected device only*, not the whole rack.

### Phase A1 — compact dock (the 80% for small cost)

Dock contents (no workshop instance, all data project-backed):

- Device name + type badge + "open in rack ↗" button.
- Bank lane strip (existing `bankStrip` module, retargeted by getter) — pattern chips,
  queue/FIRE. Same shared `laneSwap` state as the sequencer strip; or the sequencer strip
  is *replaced* by the dock strip (one surface, not two — decision point D2).
- Preset/program recall (read-only dropdown using existing `factoryPatches`/preset bank).
- A one-octave audition keyboard row (engine already has `preview`/`hold` per device via
  `scopedEngine`).

Files touched: `index.html` (dock region), `style.css` (dock + height vars), `app.mjs`
(dock controller, selection follow), `studio-shell.mjs` (build dock), tracker height
constants switch from hardcoded `calc(100vh - NNN px)` to a CSS var that includes dock
height. Estimate: one session (~2-3 h), low risk, fully reversible.

### Phase A2 — real device panel in the dock

The dock hosts the selected device's actual front panel (knobs, envelopes). Two mechanisms:

- (a) Reparent the device's `.rack-unit` panel node into the dock while the rack workspace
  is elsewhere. Shadow DOM survives reparenting; rackStack `panels` map still owns it.
  Single source of truth, but DOM lifecycle gets tricky (rackStack rebuilds on device
  delete; focus/scroll side effects).
- (b) A second `workshop()` instance bound to the same `scopedStore/scopedEngine` device
  view. Params are project-backed so two views stay in sync through `store.onchange` →
  `update()` chains; costs duplicate DOM + double update calls. Simpler to reason about.

Recommend (b) first. Estimate: half a session after A1; decision point D4 (does A1 alone
already satisfy the need?).

### What A1/A2 do NOT do

- No multi-device view in the dock (that's what the rack workspace is for).
- No CV patching outside the rack (rear view stays there).

## Option B — full split layout (rack column, always open)

Main area = current workspace content (sequencer/mixer/samples/…); right column = the rack,
persistent. Nav buttons switch the main area only; the rack column is a second `rackStack`
(or a reparented one).

- Pros: the true ReBirth/Renoise layout; rack always visible without a dock's space tax.
- Cons/blast radius: this is core layout — `index.html` structure, workspace nav semantics,
  every viewport-height calc, responsive breakpoints (`@media(max-width:1100px)`), rack
  width (rack units are wide; a column wants a narrow rack variant or horizontal scroll),
  Electron menu/resize wiring. Multi-session project; needs a mockup pass first.
- Cheaper variant: split only in the sequencer workspace (sequencer = home principle) —
  rack column appears when you're sequencing, other workspaces stay full-page. Still
  touches all the same height math but leaves mixer/samples alone.

## Option C — second Electron window — NOT RECOMMENDED

Window focus stealing, state sync across windows (two renderers, one store — would need
BroadcastChannel or IPC mirroring), small-screen behavior. Park unless multi-monitor
performance rigs become a real use case.

## Decision points (mxjxn)

- D1: Option A dock vs Option B split as the destination. (A can lead to B later; they're
  compatible — dock first, promote to column if it earns it.)
- D2: does the dock strip REPLACE the sequencer-track strip (one bank surface, always
  visible) or do both exist? Recommendation: replace — one surface, dock is persistent,
  two surfaces = two places to look.
- D3: dock position — bottom (my default; tracker scrolls end just above it) vs right rail
  (touches fewer height calcs but narrows the tracker grid).
- D4: after A1 ships, decide whether A2 (real knobs in the dock) is wanted at all.
- D5: audition keyboard row in dock now, later, or never (it needs the engine's audio
  boot; headless testing can't hear it — same carried limit as clip player).

## Sequencing of work

1. A1 compact dock (one session, reversible).
2. Live with it; then D2/D4 verdicts.
3. If ReBirth-feel still missing → B variant design pass with a mockup before any layout code.
