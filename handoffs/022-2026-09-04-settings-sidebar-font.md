# Session 022 — Restore settings sidebar typography

## Scope

Restored the settings sidebar typography hierarchy shown in the reference: serif section labels and the existing UI font for navigation items.

## Completed

- Explicitly set settings navigation item labels to `--kaiako-font-ui`.
- Preserved `--kaiako-font-heading` for `Account`, `Data`, and `Tuning` group labels.
- Kept the existing responsive section-heading sizing and sidebar layout unchanged.

## Verification

- `npm run build` passed in `kaiako/` (`tsc --noEmit --skipLibCheck` plus production esbuild).
- `git diff --check` passed.

## Files

- `kaiako/styles.css` — scoped settings sidebar font hierarchy.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and open Kaiako Settings to visually confirm the sidebar matches the reference.
