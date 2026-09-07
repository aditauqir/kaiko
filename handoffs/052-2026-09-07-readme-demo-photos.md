# 052 — Integrate demo screenshot images into README.md

**Date**: 2026-09-07  
**Branch**: `feature`  
**Remote**: `https://github.com/aditauqir/kaiko.git`  
**Status**: Complete  

---

## 1. Objectives

1. Copy user-provided Obsidian demo screenshots into `assets/`:
   - `assets/demo-instruction-view.png` (hero demonstration of sidebar instruction and vault note synchronization).
   - `assets/demo-goal-capture.png` (initial goal capture with LT Superior Serif typography and personalized greeting).
   - `assets/demo-adaptive-diagnostic.png` (Computerized Adaptive Diagnostic in action showing question-by-question scoring).
   - `assets/demo-harness-settings.png` (Pi agent harness settings modal).
2. Embed the demo screenshots into relevant sections of `README.md` for visual walkthrough.
3. Update repository structure tree in `README.md` to document the new `assets/` files.

---

## 2. Changes

- **`assets/`**:
  - `demo-instruction-view.png`: Added as hero banner showing instruction on RISC-V with live Markdown note generation side-by-side.
  - `demo-goal-capture.png`: Embedded under Goal Capture (`need_goal`).
  - `demo-adaptive-diagnostic.png`: Embedded under Adaptive Diagnostic (`diagnostic`).
  - `demo-harness-settings.png`: Embedded under Configuration Reference.
- **`README.md`**:
  - Embedded the 4 screenshots with responsive HTML/Markdown tags and descriptive alt text.
  - Updated repository tree to list demo screenshots.

---

## 3. Verification

- `git diff --check` passed with 0 errors.
- Image files exist and are verified in `assets/`.
