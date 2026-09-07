# Session 030 — Fix MCQ option overlap

## Scope

Prevent wrapped MCQ option text from overlapping adjacent options.

## Completed

- Prevented option and custom-answer rows from shrinking to a single-line height.
- Added a stable `2rem` minimum control height while preserving natural growth for wrapped Markdown.
- Made the rendered option text a visible block with inherited line height and visible overflow.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.

## Files

- `kaiako/styles.css` — MCQ option sizing and wrapping rules.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and verify MCQ options with one or more wrapped lines at narrow pane widths.
