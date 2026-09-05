# Session 026 — Align settings heading and search field

## Scope

Align the first Settings content heading with the Settings search field so their top edges share the same horizontal axis.

## Completed

- Reset the first content heading's block-start margin explicitly.
- Reset the search wrapper and input block-start margins explicitly.
- Preserved the shared responsive `--kaiako-settings-top-inset` used by both columns.

## Verification

- `npm run build` passed in `kaiako/` (`tsc --noEmit --skipLibCheck` plus production esbuild).
- `git diff --check` passed.

## Files

- `kaiako/styles.css` — removes native top-margin offsets from the first Settings heading and search input.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and open Kaiako Settings. Confirm the first heading and search field top borders/text line up horizontally.
