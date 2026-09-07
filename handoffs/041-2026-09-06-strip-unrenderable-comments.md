# Session 041 — Strip unrenderable comments and ensure 100% Obsidian Markdown renderability

## Scope

1. Prevent internal HTML comments and control markers (`<!-- correct: B -->`, `<!-- kaiako-mcq -->`, `<!-- /kaiako-mcq -->`, `<!-- kaiako-topic: ... -->`, `<!-- answer: ... -->`, etc.) from ever leaking into Obsidian vault notes or visible rendered markdown.
2. Ensure whatever the assistant emits is 100% renderable, clean Markdown in Obsidian reading and live preview modes.
3. Robustly parse MCQs even if the agent puts `<!-- correct: B -->` outside the block, before the question, or omits the `<!-- kaiako-mcq -->` fence entirely.
4. Clean up and migrate existing notes in the vault so any already-persisted `<!-- correct: B -->` or unrenderable comments are automatically removed upon opening/loading.

## Completed

- In `kaiako/src/mcq.ts`:
  - Added and exported `stripUnrenderableComments(markdown: string)`:
    - Strips `kaiako-mcq` code fences and block markers.
    - Strips all HTML comments outside legitimate code blocks (protecting multi-backtick, tilde, and inline code blocks, including in-progress streamed blocks).
    - Normalizes empty/whitespace-only lines and collapses excess newlines down to clean single-blank-line paragraph separations.
  - Enhanced `splitMcq`:
    - Extracts global correct answer markers (`<!-- correct: [A-D] -->` or `Answer: [A-D]`) anywhere in the raw turn.
    - Detects fenced blocks (`FENCE` and `MARKED_BLOCK`), applies global correct answer if not found inside, and returns prose passed through `stripUnrenderableComments`.
    - Added fallback detection for clean Markdown questions emitted without fences (`QUESTION_START`), parsing the MCQ and returning the preceding prose sanitized.
    - Ensures `prose` is always free of unrenderable control markers.
  - Enhanced `parseCleanMarkdown`:
    - Scans lines *before* `questionIndex` as well as after `questionIndex` for `<!-- correct: [A-D] -->` and `Answer: [A-D]`.
  - Enhanced `normalizeMcq`:
    - Sanitizes `stem` and `option.text` with `stripUnrenderableComments` so options never retain leaked comments.
  - Enhanced `formatMcqQuestion`:
    - Guards against duplicate `Question:` prefixes.
  - Updated `stripMcqFences` and `normalizeMcqMarkdown`:
    - Now utilize `stripUnrenderableComments` for thorough sanitization.
- In `kaiako/src/note-writer.ts`:
  - `appendToSession`: Sanitizes markdown via `stripUnrenderableComments` before writing to disk, ensuring no unrenderable comments can ever enter vault note files.
  - `serializeSessionTurns`: Sanitizes each turn via `stripUnrenderableComments` before serialization.
- In `kaiako/src/kaiako-view.ts`:
  - `finishAssistantTurn`: Wraps `toWrite` with `stripUnrenderableComments`.
  - `fillMessages`: Sanitizes assistant and user turns with `stripUnrenderableComments` and `splitMcq`. If turns changed (e.g. existing note had `<!-- correct: B -->`), `replaceSessionTurns` automatically cleans the file on disk.
  - `buildResumeContext`: Sanitizes history turns with `stripUnrenderableComments` to prevent feeding leaked comments back to the LLM.
- In `kaiako/src/harness-prompt.ts`:
  - Clarified diagnostic MCQ prompt instructions to explicitly place `<!-- correct: B -->` on the final line inside `<!-- kaiako-mcq -->` ... `<!-- /kaiako-mcq -->`, never in prose or before the question.
- Rebuilt `kaiako/main.js` bundle via `npm run build`.

## Verification

- Created scratch test scripts `test-strip-comments.mjs` and `test-split-mcq.mjs` validating:
  - Stripping `<!-- correct: B -->` from prose while retaining markdown text.
  - Preserving legitimate HTML comments inside code blocks (```html <!-- comment --> ```) and inline code.
  - Parsing MCQs where `<!-- correct: B -->` appears before the fence or before the question.
  - Parsing clean Markdown MCQs where the model omitted fences entirely.
  - Streaming partial comment cleanup.
- `npm run build` completed with 0 errors.
- `git diff --check` passed with 0 warnings/errors.
- Stayed on branch `feature`.

## Files

- `kaiako/src/mcq.ts`
- `kaiako/src/note-writer.ts`
- `kaiako/src/kaiako-view.ts`
- `kaiako/src/harness-prompt.ts`
- `kaiako/main.js`
- `HANDOFF.md`
