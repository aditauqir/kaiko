# Session 019 — Existing session heading repair

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018 → this file.

## Ask

Fix the duplicated oversized topic heading shown in existing sessions.

## Shipped

- Normalize loaded session titles to the existing three-word topic limit.
- Make `readSessionBody` remove the scaffold by stable session ID rather than exact current title.
- Preserve existing session note paths and all stored diagnostic data.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- No commit was created.

## Files

- `kaiako/src/config.ts` — normalizes session titles during config merging.
- `kaiako/src/note-writer.ts` — strips legacy note scaffolds with title-independent matching.
- `kaiako/main.js` — rebuilt plugin bundle.
