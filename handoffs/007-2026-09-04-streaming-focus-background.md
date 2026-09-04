# Session 007 — Streaming reveal + Focus background

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → this file.

## Ask

Make the AI chat use the supplied typewriter-style `StreamingText` animation and replace the Focus mode background with the supplied blurred, pixelated image treatment.

## Shipped

- Each Pi turn now owns a dedicated stream reveal instance. Pi text deltas are routed to that instance, and the completed-response fallback syncs into the same instance when a provider emits no deltas.
- The live response uses a paragraph with `aria-live="polite"`, a 2-character / 9ms reveal cadence, and the existing caret animation.
- Focus mode (`lockedIn`) now uses `assets/focus-background.png`, a 256px-wide derivative of the supplied image, with `image-rendering: pixelated`, CSS Gaussian blur, opacity, and slow background drift.
- Stream errors cancel and remove the live response instead of leaving a stale caret behind.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- The active Obsidian vault is `/Users/aditauqir/Documents/Obsidian Vault`; its Kaiako plugin files are symlinked to this workspace. The rebuilt source was loaded by the bundle, but the already-running Obsidian process retained the prior CSS in its live view during the visual check. Re-enable Kaiako or fully restart Obsidian to inspect the new Focus background.

## Files

- `kaiako/src/kaiako-view.ts` — binds Pi turn events to the correct stream reveal and handles stream errors.
- `kaiako/src/streaming-text.ts` — paragraph/live-region typewriter reveal and final text sync.
- `kaiako/styles.css` — Focus background image, pixelated sampling, blur, drift animation, and stream paragraph styling.
- `kaiako/assets/focus-background.png` — downsampled derivative of the supplied image.
