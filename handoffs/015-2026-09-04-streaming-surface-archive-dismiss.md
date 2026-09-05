# Session 015 — Streaming surface and Archive dismissal

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → this file.

## Ask

Remove the visible background from the typing animation and close the Archive list when clicking anywhere outside it.

## Shipped

- Removed the streaming AI bubble fill, border, radius, padding, and shadow; only the text and caret remain.
- Added a view-level pointer listener that closes Archive on outside clicks.
- Archive trigger clicks and clicks inside the Archive popup remain open/functional.
- The dismissal removes only the popup and does not rebuild the chat pane.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- No commit was created.

## Files

- `kaiako/src/kaiako-view.ts` — outside-click Archive dismissal.
- `kaiako/styles.css` — transparent streaming surface.
- `kaiako/main.js` — rebuilt plugin bundle.
