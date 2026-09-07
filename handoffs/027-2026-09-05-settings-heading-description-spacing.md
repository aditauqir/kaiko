# Session 027 — Add Settings heading/description spacing

## Scope

Add a small responsive gap between Settings section headings and their descriptions.

## Completed

- Added scoped top padding to `.setting-item-heading .setting-item-description`.
- The gap is bounded with `clamp(0.25rem, 0.6vh, 0.45rem)` and does not affect ordinary setting rows.

## Verification

- `npm run build` passed in `kaiako/` (`tsc --noEmit --skipLibCheck` plus production esbuild).
- `git diff --check` passed.

## Files

- `kaiako/styles.css` — adds the heading/description gap.
- `kaiako/main.js` — rebuilt plugin bundle.
