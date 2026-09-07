# 043: Smoke Test Question Deduplication & Vertical Spacing

## Summary
Resolved duplicated questions appearing in smoke tests / diagnostic quizzes, added comfortable vertical spacing between paragraphs and turns, and styled individual question, result, and answer items with distinct vertical breathing room.

## Changes Made
1. **Deduplicate Questions & Normalize Spacing (`kaiako/src/mcq.ts`)**:
   - Implemented `normalizeMcqSpacing(markdown: string)` to ensure clean double-newline (`\n\n`) separation between `Question:`, `Result:`, and `Correct answer:` items.
   - Enhanced `deduplicateQuestions(markdown: string)` to normalize spacing and eliminate consecutive identical `Question:` lines while preserving distinct questions and newline prefixes.
   - Updated `formatMcqResult(item: McqItem, correct: boolean)` to output `Result:` and `Correct answer:` separated by double newlines.
   - Updated `formatMcqRecord` to use `formatMcqResult`.

2. **Session Persistence Deduplication (`kaiako/src/note-writer.ts`)**:
   - `appendToSession`: runs `deduplicateQuestions` on combined session content so appending never creates duplicate questions.
   - `serializeSessionTurns`: runs `deduplicateQuestions` when serializing turns.

3. **Sidebar View & Auto-Migration (`kaiako/src/kaiako-view.ts`)**:
   - `answerMcq`: checks whether the session note already ends with or contains the question line; if so, only appends `formatMcqResult`, eliminating the root cause of duplicate questions.
   - `fillMessages`: normalizes turns through `deduplicateQuestions` so opening existing notes with duplicates automatically cleans them up and writes the clean version back to disk.
   - `fillMessages`: replaces all instances of `pendingQuestion` before rendering the turn markdown.
   - `fillMessages`: tags `<p>` elements with `.kaiako-question-item`, `.kaiako-result-item` (`.is-correct` / `.is-incorrect`), and `.kaiako-answer-item`.

4. **Typography & Layout Spacing (`kaiako/styles.css`)**:
   - `.kaiako-messages`: increased `gap` from `0.15rem` (2.4px) to `1.35rem` (21.6px) and added `padding: 0.6rem 0.65rem 1.25rem`.
   - `.kaiako-turn`: increased `line-height` to `1.6` and added `margin-block: 0.35rem`.
   - `.kaiako-turn--user`: increased `margin-block: 0.65rem 0.85rem`.
   - `.kaiako-md p`, `.kaiako-bubble p`: increased `margin` from `0.2rem 0` (3.2px) to `0.65rem 0` (10.4px) and set `line-height: 1.6`.
   - `.kaiako-question-item`: added `font-weight: 600`, `margin-top: 1.45rem !important`, and `margin-bottom: 0.55rem !important`.
   - `.kaiako-result-item`: added `font-weight: 600`, emerald green for correct, soft red for incorrect.
   - `.kaiako-answer-item`: added `margin-bottom: 1.35rem !important` and comfortable muted contrast.
   - Added corresponding styles for `.kaiako-shell.kaiako-locked` dark theme.

## Verification
- Built with `npm run build` (`tsc --noEmit --skipLibCheck && node esbuild.config.mjs production`) with 0 errors.
- Verified unit regex logic in Node with sample smoke test questions from the screenshot.
- Verified `git diff --check` passed cleanly.
