# Session 033 — Responsive MCQ sidebar width

## Scope

Make the MCQ card size to the available Kaiako sidebar width.

## Completed

- Removed the fixed `20rem` MCQ width cap.
- Set the card to fill the available MCQ root width while keeping `min-width: 0` and `max-width: 100%`.
- Preserved the existing strict wrapped-option layout.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.

## Files

- `kaiako/styles.css` — makes the MCQ card responsive to its sidebar container.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and resize the sidebar to verify the card expands and contracts with it.
