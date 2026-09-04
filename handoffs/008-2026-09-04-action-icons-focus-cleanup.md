# Session 008 — Action icon + Focus cleanup

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → this file.

## Ask

Remove CSS tooltip hooks and button backgrounds from the Like/Copy/Restart turn actions, and make the supplied image the only Focus-mode background treatment.

## Shipped

- Turn action buttons now retain accessible `aria-label` values but no longer receive the generic `kaiako-tip` class or `data-tooltip` attributes.
- Turn action buttons and their hover/focus/active states use transparent backgrounds with no box shadows, while keeping the existing icon hit target and visual sizing.
- Focus mode clears the normal chat gradient, hides the noise layer, and leaves the supplied pixelated + blurred image as the only visual background layer, with a dark fallback if the asset cannot load.
- Composer Web search and Send tooltips remain unchanged because they are separate controls from the requested turn-action icons.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- Existing unrelated worktree changes were preserved; no commit was created.

## Files

- `kaiako/src/kaiako-view.ts` — removed tooltip hooks from Like/Copy/Restart buttons.
- `kaiako/styles.css` — removed turn-action fills and suppressed alternate Focus background layers.
- `kaiako/main.js` — rebuilt plugin bundle.
