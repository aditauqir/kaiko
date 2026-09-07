# 051 — Smoke test MCQ repair, project description, and Kaiko 1.0.0 release packaging

**Date**: 2026-09-07  
**Branch**: `feature`  
**Remote**: `https://github.com/aditauqir/kaiko.git`  
**Status**: Complete  

---

## 1. Objectives

1. Diagnose and fix the broken smoke test MCQ so questions display reliably.
2. Provide `.gitignore` covering OS metadata, caches, build artifacts, and test vaults.
3. Generate comprehensive `project_desc` (and `project_desc.md`) detailing the architecture, psychometrics, and engineering metrics for resume drafting.
4. Overhaul `README.md` with installation guides for both GitHub Releases (`https://github.com/aditauqir/kaiko/releases/tag/Kaiko-1.0.0`) and manual build from source (`https://github.com/aditauqir/kaiko.git`).
5. Package the Obsidian extension as `Kaiko-1.0.0.zip` in `releases/`.

---

## 2. Root Cause Analysis: Smoke Test MCQ

1. **Goal Extraction Discard Loop**:
   - `kaiako/src/goal.ts` had hardcoded `goal.length >= 8` and matched `test` under `WEAK` regex. When users entered `"smoke test"`, `"test me"`, or short topics like `"docker"` (6 chars), `"python"` (6 chars), or `"rust"` (4 chars), `extractGoal` returned `null` and `hasStoredGoal` returned `false`.
   - `kaiako/src/kaiako-view.ts` had a check `if (mcq && phase === "need_goal")` that stripped the MCQ, discarded it, and forced Pi to rerun with `"(No goal is stored. Ask for the learning goal now. Do not quiz.)"`. As a result, MCQs were completely suppressed.
2. **MCQ Parser Strictness**:
   - `kaiako/src/mcq.ts` previously failed to parse clean Markdown MCQs when the LLM omitted the explicit `"Question:"` label, formatted options as `- **A.**` or `(A)`, or placed answer markers in varied formats.

---

## 3. Implementation Details

- **`kaiako/src/goal.ts`**:
  - Added `TEST_REQUEST` regex recognizing `"smoke test"`, `"run a smoke test"`, `"quiz me"`, `"diagnostic"`, etc.
  - Lowered minimum goal length from 8 to 2 characters to support standard programming topics ("docker", "python", "rust", "c++", "git", "sql", "ai").
  - Updated `hasStoredGoal` to `goal.trim().length >= 2`.
- **`kaiako/src/mcq.ts`**:
  - Overhauled option matching (`matchOptionLine`) to support all common variants (`- A.`, `- **A.**`, `(A)`, `[A]`, `1.`, `a:`).
  - Added `cleanStemText` and `extractGlobalCorrect`.
  - Added clean Markdown fallback in `splitMcq` to detect unfenced MCQs without requiring fences or strict labels.
- **`kaiako/src/kaiako-view.ts`**:
  - In `finishAssistantTurn()`, removed the `need_goal` MCQ discard loop. When an MCQ is received, it infers the goal from session metadata/title, updates `phase` to `"diagnostic"`, saves frontmatter, and mounts the interactive approval card.
- **`.gitignore`**:
  - Created `.gitignore` in `learn/` and workspace root covering `.DS_Store`, `node_modules/`, `dist/`, build artifacts, `.env`, `.obsidian/`, and test vaults.
- **`project_desc` & `project_desc.md`**:
  - Created complete resume documentation with executive summaries, recruiter pitches, role-tailored bullet points (AI/ML, Full-Stack, Systems), psychometric formulas (Rasch 1PL, Newton-Raphson MAP, Fisher Information), and STAR interview stories.
- **`README.md`**:
  - Overhauled documentation highlighting the IRT Rasch 1PL engine, three-phase pedagogical loop, GitHub origin (`https://github.com/aditauqir/kaiko.git`), and dual installation instructions:
    - Method 1: GitHub Releases tab (`https://github.com/aditauqir/kaiko/releases/tag/Kaiko-1.0.0`) via `Kaiko-1.0.0.zip`.
    - Method 2: Manual clone from source and build.
- **`releases/` & Plugin Packaging**:
  - Updated `manifest.json` and `package.json` to plugin ID `kaiko` version `1.0.0`.
  - Built production bundle with esbuild.
  - Packaged `Kaiko-1.0.0.zip` containing `main.js`, `manifest.json`, and `styles.css`.

---

## 4. Verification

- Ran bundled test suite verifying:
  - Goal extraction for `"smoke test"`, `"run a smoke test"`, `"smoke test on docker"`, `"quiz me on rust"`, `"teach me python"`, etc.
  - Accurate MCQ splitting across HTML comment blocks, code fences, and clean unfenced Markdown.
  - All test cases passed with 100% accuracy.
- Ran `npm run build` in `kaiako/` — zero TypeScript compiler warnings or errors.
- Ran `npm run package` in `kaiako/` — verified `releases/Kaiko-1.0.0.zip` integrity and contents.
- Ran `git diff --check` — zero trailing whitespace or formatting issues.
