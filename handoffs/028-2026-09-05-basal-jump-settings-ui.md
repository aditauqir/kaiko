# Session 028 — Redesign Base Jump settings UI

## Scope

Match the Base Jump pane to the supplied reference and make sidebar group labels the same size as tab names while retaining the serif group-label font.

## Completed

- Added a dedicated Base Jump heading class with a responsive `clamp(2rem, 4vw, 2.75rem)` serif title.
- Added responsive spacing before the sensitivity row, widened the slider control, and kept the slider/labels arranged horizontally beside the description on larger panes.
- Added a narrow-pane breakpoint that stacks the slider below the description.
- Kept the low/medium/high labels below the slider and removed the selected value display/tooltip from the prior implementation.
- Split sidebar group-label sizing from content headings. Account/Data/Tuning retain LT Superior Serif but now use `var(--font-ui-small, 0.9rem)`, matching tab-name sizing.

## Verification

- `npm run build` passed in `kaiako/` (`tsc --noEmit --skipLibCheck` plus production esbuild).
- `git diff --check` passed.

## Files

- `kaiako/src/settings-modal.ts` — adds the Base Jump heading hook.
- `kaiako/styles.css` — Base Jump layout/typography and sidebar label sizing.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and compare Settings → Tuning → Base Jump with the supplied reference at wide and narrow window sizes.
