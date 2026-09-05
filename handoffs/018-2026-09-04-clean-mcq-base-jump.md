# Session 018 — Clean MCQs and Base Jump tuning

**Status:** done
**When:** 2026-09-04
**Branch:** `feature`
**Queue:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → this file.

## Ask

Render MCQs as clean Markdown instead of raw code blocks, remove visible knowledge-score/teaching-entry chips, and add a Tuning → Base Jump setting with Low/Medium/High control over the teaching starting point.

## Shipped

- Added invisible `kaiako-mcq` control markers around clean Markdown MCQs; legacy fenced blocks remain parseable and are normalized when existing sessions load.
- Prevented MCQ-only assistant responses from persisting raw protocol text and persist clean Markdown question records instead.
- Removed the chat's knowledge score and “teach from” visual chip while keeping internal diagnostic state.
- Added Settings → Tuning → Base Jump with a three-position Sensitivity slider labeled Low, Medium, and High.
- Applied Base Jump offsets of 10, 25, and 40 points below the diagnosed score to estimation and Pi teaching prompts.
- Added the requested `cubic-bezier(0.25, 0.1, 0.25, 1)` easing to the new tuning control.

## Verification

- `npm run build` passed in `kaiako/`.
- `git diff --check` passed.
- No commit was created.

## Files

- `kaiako/src/mcq.ts` — clean Markdown MCQ protocol, parser, formatter, and legacy normalization.
- `kaiako/src/kaiako-view.ts` — note persistence, score visual removal, and Base Jump wiring.
- `kaiako/src/config.ts` — persisted Base Jump setting.
- `kaiako/src/knowledge.ts` — configurable teaching offset.
- `kaiako/src/harness-prompt.ts` — clean MCQ output and Base Jump instructions for Pi.
- `kaiako/src/settings-modal.ts` — Tuning tab and slider.
- `kaiako/styles.css` — tuning control layout and easing.
- `kaiako/src/main.ts` — onboarding reset default.
- `kaiako/main.js` — rebuilt plugin bundle.
