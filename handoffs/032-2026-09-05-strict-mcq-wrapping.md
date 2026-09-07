# Session 032 — Strict MCQ wrapping

## Scope

Guarantee that wrapped MCQ option text never overlaps adjacent options.

## Completed

- Switched option rows to an explicit two-column grid for the radio indicator and text.
- Disabled flex shrinking and native height/max-height constraints.
- Allowed each Markdown-rendered text block to grow naturally with visible overflow.
- Increased line height and responsive row separation for wrapped options.
- Preserved the flex layout for the custom-answer row.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.

## Files

- `kaiako/styles.css` — strict MCQ row sizing, grid layout, and wrapping rules.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and verify long MCQ options at narrow pane widths.
