# 045: Prevent Scroll Jump When Sending a Message

## Summary
Eliminated the visual jump to the top of the chat history when a user sends a message in the Kaiako sidebar, by replacing naive whole-container DOM wiping (`messages.empty()`) with smart incremental turn reconciliation.

## Root Causes Identified
1. **DOM Destruction on Every Send / Update (`messages.empty()`)**:
   - In `fillMessages()`, the function began with `messages.empty()`, wiping all child turn elements from `.kaiako-messages`.
   - When all children are removed, `.kaiako-messages`'s `scrollHeight` collapses to `clientHeight`, which forces the browser engine to synchronously clamp `messages.scrollTop` to `0`.
   - `fillMessages` then proceeded through an asynchronous `for` loop, calling `await MarkdownRenderer.render(...)` sequentially for turns `0` to `N`. During these asynchronous ticks, the viewport was scrolled to `0`, making the user visibly watch the chat jump to the very top and slowly re-populate downwards before `scrollToBottom` was reached.
2. **Double Wiping on AI Response**:
   - Both when sending the message (`handleSend`) and when the AI assistant finished streaming (`finishAssistantTurn`), `fillMessages` was called, triggering the same DOM wipe and jump cycle.

## Changes Made
1. **Incremental Reconciliation in `fillMessages` (`kaiako/src/kaiako-view.ts`)**:
   - Retained session-level tracking via `messages.dataset.sessionId`. Only when switching to a different session is `messages.empty()` called.
   - For an active session, existing turns (0 through N-1) are preserved intact in the DOM. Each turn is tagged with `dataset.turnIndex`, `dataset.turnRole`, `dataset.turnMd`, and `dataset.liked`.
   - If an existing turn's content and role match, it is skipped without DOM manipulation or Markdown re-rendering. If only the `liked` state changed, the like button is toggled without rebuilding the node.
   - If a turn was modified, `existingEl.replaceWith(newWrap)` updates only that specific turn.
   - Newly appended turns (e.g. the sent user message or completed assistant response) are rendered and inserted before any trailing `.kaiako-mcq-root` or `.kaiako-stream`.
   - Any excess turns (e.g. when restarting from an earlier turn) are pruned from the end.
   - When the assistant turn finishes, any active streaming bubble (`.kaiako-stream`) is cleanly swapped for the finalized rendered turn.
2. **Dedicated `renderTurn` Helper (`kaiako/src/kaiako-view.ts`)**:
   - Extracted single-turn rendering logic into `private async renderTurn(...)`, isolating math sanitization, question/result styling classes, action bar mounting, and data attributes.
3. **MCQ Node Preservation (`kaiako/src/kaiako-view.ts`)**:
   - Attached `dataset.mcqId` to `.kaiako-mcq-root` during `mountMcq`. In `fillMessages`, if the pending MCQ is unchanged, the card is retained in place rather than torn down and rebuilt.
4. **Prompt Bar Send Handler Protection (`kaiako/src/prompt-bar.ts`)**:
   - Added `event.preventDefault()` to the `sendBtn` click handler to avoid potential focus-scrolling side effects.

## Verification
- Built cleanly with `npm run build` (`tsc --noEmit --skipLibCheck && node esbuild.config.mjs production`) with 0 errors.
- Verified `git diff --check` with 0 whitespace issues.
