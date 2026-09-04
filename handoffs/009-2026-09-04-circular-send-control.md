# Session 009 — Circular Send control

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → this file.

## Ask

Make the composer Send control a true circle.

## Shipped

- Added a high-specificity sizing lock for the Send button: `1.75rem` inline and block dimensions, `1 / 1` aspect ratio, and `50%` border radius.
- Applied the same geometry to ready, hover, focus-visible, focus, and active states so Obsidian CTA rules cannot stretch it into a pill.
- Preserved the existing white send surface, black arrow, and accessible Send label.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- Existing unrelated worktree changes were preserved; no commit was created.

## Files

- `kaiako/styles.css` — locked Send-button dimensions and circular states.
- `kaiako/main.js` — rebuilt plugin bundle.
