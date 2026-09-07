# Session 029 — Keep MCQ notes clean

## Scope

Ensure Obsidian session notes show only the MCQ question/result/correct answer while preserving interactive MCQ recovery inside Kaiako.

## Completed

- Added compact `Question`, `Result`, and `Correct answer` persistence.
- Added hidden `kaiako_pending_mcq` frontmatter for unanswered card recovery.
- `fillMessages` migrates legacy full MCQs (answered and unanswered) and restores pending interactive cards.
- Answering an MCQ clears pending metadata and writes only the compact outcome.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.

## Files

- `kaiako/src/mcq.ts` — compact MCQ note formatting.
- `kaiako/src/kaiako-view.ts` — migration, pending state, and interactive restoration.
- `kaiako/src/note-writer.ts` — hidden pending MCQ frontmatter parsing.
- `kaiako/src/config.ts` — pending MCQ session metadata.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian and verify a new and existing diagnostic MCQ in the note.
