# Session 011 — MCQ ApprovalCard treatment

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → this file.

## Ask

Use the supplied React ApprovalCard element for MCQs or similar interactions only.

## Shipped

- Translated the supplied React reference into a native Obsidian DOM component in `approval-card.ts`.
- MCQs now use the compact card treatment with a close/reopen action, radio selection, custom-answer input, `Skip` and `Answer` footer actions, and a `1 / 1` question counter for Kaiako’s current single-question wire format.
- Single-choice options preserve the existing auto-submit behavior after a short selection pause; custom answers submit on Enter or with the Answer button.
- Normal AI prose, streaming reveal, and other chat content continue using their existing renderers.
- Added light/dark Focus-mode styling and reduced-motion handling for the MCQ card.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- Existing unrelated worktree changes were preserved; no commit was created.

## Files

- `kaiako/src/approval-card.ts` — native ApprovalCard-style MCQ component.
- `kaiako/src/kaiako-view.ts` — mounts the card only for parsed MCQs.
- `kaiako/styles.css` — card layout, option states, actions, dark mode, and motion handling.
- `kaiako/main.js` — rebuilt plugin bundle.
