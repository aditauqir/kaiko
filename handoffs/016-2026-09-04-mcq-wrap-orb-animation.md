# Session 016 — MCQ wrapping and orb animation

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → this file.

## Ask

Fix horizontally clipped MCQ text, restore animated thinking orbs using the supplied ThinkingOrb behavior, and keep the orb pill floating above the composer while MCQ content stays above lower layers.

## Shipped

- Added explicit flex sizing, normal whitespace, and overflow wrapping to MCQ option text and rendered paragraphs.
- Made the orb canvas use the 20px inline scale from the supplied API shape.
- Made the agent-planning shape continuously rotate and pulse instead of changing only at discrete shape phases.
- Added a CSS canvas drift fallback for visible orb motion.
- Made the orb pill an absolute floating layer above the composer.
- Raised MCQ roots above the composer stacking layer.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- No commit was created.

## Files

- `kaiako/src/thinking-orb.ts` — animation loop hardening, 20px scale, and continuous shaping motion.
- `kaiako/styles.css` — MCQ wrapping, orb layering, and motion fallback.
- `kaiako/main.js` — rebuilt plugin bundle.
