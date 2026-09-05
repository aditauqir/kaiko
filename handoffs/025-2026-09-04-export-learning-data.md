# Session 025 — Export learning data and track active session time

## Scope

Add Tuning → Export data and persist session interaction time for CSV reporting. Remove the visible Base Jump level/value beside the slider.

## Completed

- Base Jump keeps only the low/medium/high labels under the slider; the separate selected-value text and dynamic numeric tooltip are removed.
- Added Tuning → Export data with an Export CSV button.
- CSV includes a combined `summary` row and one row per session.
- Exported fields include topic, goal, phase, timestamps, active seconds/minutes, learner/assistant turns, diagnostic item totals, accuracy, average item difficulty, baseline/knowledge score, theta, standard error, teaching entry, Base Jump level, and all-session average score.
- The combined knowledge score is the arithmetic average of available session scores.
- Added a per-session active clock. User activity and active Pi responses count; idle time is capped at two minutes after the last signal and resumes on the next interaction. Settings/archive/top-bar clicks do not start learning activity.
- Activity is persisted in session frontmatter and mirrored into plugin config before export.

## Verification

- `npm run build` passed in `kaiako/` (`tsc --noEmit --skipLibCheck` plus production esbuild).
- `git diff --check` passed.

## Files

- `kaiako/src/session-activity.ts` — two-minute idle-aware active-time tracker.
- `kaiako/src/export-data.ts` — CSV aggregation, escaping, and browser download.
- `kaiako/src/kaiako-view.ts` — activity event wiring, persistence, and export flush before Settings opens.
- `kaiako/src/settings-modal.ts` — Base Jump cleanup and Export data tab/button.
- `kaiako/src/config.ts` / `kaiako/src/note-writer.ts` — persisted activity fields.
- `kaiako/styles.css` — slider layout without the selected-value column.
- `kaiako/main.js` — rebuilt plugin bundle.

## Remaining

- Reload Obsidian, use a session, wait longer than two minutes without interaction, then interact again and export from Settings → Tuning → Export data. Confirm the CSV has a summary row plus session rows and that the idle gap is absent from `active_seconds`.
