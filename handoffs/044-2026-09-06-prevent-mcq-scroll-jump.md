# 044: Prevent Scroll Jump When Clicking MCQ Options

## Summary
Prevented the chat messages container and editor pane from jumping to the top when an option in the MCQ card is clicked.

## Root Causes Identified
1. **Chat Scroll Collapse in `fillMessages`**:
   - `fillMessages` calls `messages.empty()`, clearing all message nodes. The browser clamps `messages.scrollTop` to 0.
   - When turns finished rendering asynchronously, `fillMessages` had no code restoring or setting scroll to bottom unless `pendingMcq` was present. After answering an MCQ, `pendingMcq` was cleared, leaving `messages.scrollTop = 0` (the top of the chat).
2. **Focus-Fallback Scroll Reset**:
   - When an option button was clicked, it gained `:focus`. Calling `box.remove()` removed the focused element from the DOM. Chromium blurs to `document.body`, which can trigger a viewport/scroll container jump to (0, 0).
3. **Editor Focus Steal & Reload in `appendToSession`**:
   - `appendToSession` called `app.workspace.getLeaf(false).openFile(file)` whenever `getActiveFile() !== file.path`. Because clicking inside the sidebar leaves `getActiveFile()` as `null`, this check was always true, causing Obsidian to reopen/activate the file in the editor leaf and scroll line 1 into view.

## Changes Made
1. **Prevent Editor Hijacking (`kaiako/src/note-writer.ts`)**:
   - In `appendToSession`: Checks if the session note is already open in any markdown leaf (`app.workspace.getLeavesOfType("markdown")`). If already open, avoids calling `openFile`.
   - If not open anywhere, opens it with `{ active: false }` to avoid stealing focus or resetting scroll.

2. **Event & Focus Protection (`kaiako/src/approval-card.ts`)**:
   - Added `event.preventDefault()` and `event.stopPropagation()` to option button clicks, Skip, Answer, and Dismiss handlers.
   - Explicitly blurs any focused element within the card before invoking `onSubmit`.

3. **Scroll Pinned to Bottom (`kaiako/src/kaiako-view.ts`)**:
   - Added robust `scrollToBottom(el: HTMLElement)` method that applies immediate scroll, `requestAnimationFrame`, and a 50ms fallback to guarantee the container remains scrolled to bottom after asynchronous Markdown and math rendering reflows.
   - In `fillMessages`: Calls `this.scrollToBottom(messages)` at the end of turn rendering.
   - In `answerMcq`: Blurs any active element in `box` before `box.remove()`, and calls `this.scrollToBottom(messages)` after `fillMessages`.
   - In `restartTurn`, `handleSend`, and `finishAssistantTurn`: Enforces `this.scrollToBottom(messages)` at completion.

4. **Streaming Auto-Scroll (`kaiako/src/streaming-text.ts`, `kaiako/src/kaiako-view.ts`)**:
   - Added `onTick` callback option to `mountStreamReveal`.
   - In `runPiTurn`: Hooks `onTick` and `onText` to `this.scrollToBottom(messages)` so the view stays pinned to the bottom as the AI response streams in following an MCQ selection.

## Verification
- Built with `npm run build` (`tsc --noEmit --skipLibCheck && node esbuild.config.mjs production`) with 0 errors.
- Checked `git diff --check` passed cleanly.
