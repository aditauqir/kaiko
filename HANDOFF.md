# Master handoff

**Agents: start here.** This file is a FIFO queue, not a recap.

1. Read **Completed** from the top down (oldest first). Open each linked session before acting.
2. Then take the head of **Ready** (oldest waiting task). Do not skip ahead.
3. After finishing work, write a new `handoffs/NNN-YYYY-MM-DD-slug.md`, append it to the tail of **Completed**, and remove it from **Ready**. Never reorder old rows.

New work is always enqueued at the tail. The next job is always the head of **Ready**.

## Completed (FIFO — read first, oldest at top)

| Seq | When | Session | Result |
|-----|------|---------|--------|
| 001 | 2026-09-02 | [Obsidian demo sidechat](handoffs/001-2026-09-02-obsidian-demo-sidechat.md) | Demo plugin: right-sidebar chat, Send + Upload writing into notes. |
| 002 | 2026-09-03 | [Kaiako onboarding + LaTeX](handoffs/002-2026-09-03-kaiako-onboarding.md) | Renamed to Kaiako on `feature`; onboarding/chat shell; config save; MathJax via notes + MarkdownRenderer; pi research noted. |
| 003 | 2026-09-03 | [Chat chrome (Pi wrap pending)](handoffs/003-2026-09-03-chat-chrome.md) | Settings tabs, hashed sessions, glass archive, prompt bar, lock-in, yaml data folder. Pi process wrap waiting on approval. |
| 004 | 2026-09-03 | [Pi wrap + composer](handoffs/004-2026-09-03-pi-wrap.md) | `pi --mode rpc` send path; lock-in dark contrast; globe/formula status; circular send follows Obsidian theme. |
| 005 | 2026-09-03 | [Composer, onboarding, skills](handoffs/005-2026-09-03-composer-onboarding-skills.md) | Chat bar = bot icon + input + white send; skills copied into Pi dir; onboarding is OpenAI/Claude/Qwen Cloud + skip. |
| 006 | 2026-09-03 | [Settings + composer polish](handoffs/006-2026-09-03-settings-composer-polish.md) | Combined User info tab, visible provider choices for API keys, inset settings navigation, explicit Lucide SVG styling, and growing composer textarea. |
| 007 | 2026-09-04 | [Streaming reveal + Focus background](handoffs/007-2026-09-04-streaming-focus-background.md) | AI turns use the typewriter reveal with final-text fallback; Focus mode uses the supplied pixelated/blurred image background. |
| 008 | 2026-09-04 | [Action icon + Focus cleanup](handoffs/008-2026-09-04-action-icons-focus-cleanup.md) | Removed turn-action tooltip hooks and fills; Focus mode now suppresses the alternate gradient/noise layers so the supplied image is the only visual background. |
| 009 | 2026-09-04 | [Circular Send control](handoffs/009-2026-09-04-circular-send-control.md) | Locked the composer Send button to equal dimensions, a 1:1 aspect ratio, and a 50% radius across ready, hover, focus, and active states. |
| 010 | 2026-09-04 | [Archive + settings flash fix](handoffs/010-2026-09-04-archive-settings-flash-fix.md) | Removed the replaying Focus dissolve, updated Archive in place, and deferred parent chat refreshes until Settings closes. |
| 011 | 2026-09-04 | [MCQ ApprovalCard treatment](handoffs/011-2026-09-04-mcq-approval-card.md) | Added a native ApprovalCard-style MCQ surface with scoped radio selection, custom answer, dismiss/reopen, and footer actions; normal AI prose is unchanged. |
| 012 | 2026-09-04 | [Centered phase orbs](handoffs/012-2026-09-04-phase-orbs.md) | Centered the orb above the composer and mapped goal setting, smoke testing, and teaching phases to their respective orb visuals and labels. |
| 013 | 2026-09-04 | [Popup easing](handoffs/013-2026-09-04-popup-easing.md) | Applied the requested cubic-bezier easing to Archive, prompt menus, the thinking orb entrance, and MCQ entrance animations. |
| 014 | 2026-09-04 | [Focus toggle, topic length, and MCQ submit](handoffs/014-2026-09-04-focus-toggle-topic-mcq.md) | Removed the Focus toggle, made the Focus background permanent in chat, capped topics at three words, and made listed MCQ options submit immediately. |
| 015 | 2026-09-04 | [Streaming surface and Archive dismissal](handoffs/015-2026-09-04-streaming-surface-archive-dismiss.md) | Removed the streaming bubble background and added outside-click dismissal for the Archive popup without rebuilding the chat pane. |
| 016 | 2026-09-04 | [MCQ wrapping and orb animation](handoffs/016-2026-09-04-mcq-wrap-orb-animation.md) | Fixed clipped MCQ option text, restored continuous orb motion, floated the orb above the composer, and raised MCQ content above lower layers. |
| 017 | 2026-09-04 | [Heading typography and settings alignment](handoffs/017-2026-09-04-heading-settings-alignment.md) | Applied LT Superior Serif and larger H1–H6 sizing, aligned settings search/content tops, and made the sidebar divider full-height. |
| 018 | 2026-09-04 | [Clean MCQs and Base Jump tuning](handoffs/018-2026-09-04-clean-mcq-base-jump.md) | Replaced raw MCQ code-block persistence with clean Markdown markers, removed score visuals, and added Tuning → Base Jump sensitivity control. |
| 019 | 2026-09-04 | [Existing session heading repair](handoffs/019-2026-09-04-existing-session-headings.md) | Normalized legacy session titles and made scaffold removal title-independent, removing duplicate headings without changing session paths. |
| 020 | 2026-09-04 | [AI-generated topics and MCQ layout repair](handoffs/020-2026-09-04-ai-topics-mcq-layout.md) | AI now supplies hidden three-word topics; empty legacy turn shells are skipped; MCQ Markdown, bold-marker cleanup, and wrapped-option layout are repaired. |
| 021 | 2026-09-04 | [Hide Kaiako session properties](handoffs/021-2026-09-04-hide-session-properties.md) | Hides the Obsidian Properties panel for Kaiako notes with a scoped class while preserving internal frontmatter and existing session paths. |
| 022 | 2026-09-04 | [Restore settings sidebar typography](handoffs/022-2026-09-04-settings-sidebar-font.md) | Explicitly restores UI-font navigation labels while retaining serif Account/Data/Tuning section headings. |
| 023 | 2026-09-04 | [Remove redundant API key heading](handoffs/023-2026-09-04-remove-api-key-heading.md) | Removes the unnecessary Add an API key heading so Provider options is the first aligned section in API Keys settings. |
| 024 | 2026-09-04 | [Resume Pi from active session](handoffs/024-2026-09-04-pi-session-resume.md) | Binds Pi to the active Kaiako session and supplies the persisted transcript so restarts and reopened sessions continue where the learner stopped. |
| 025 | 2026-09-04 | [Export learning data](handoffs/025-2026-09-04-export-learning-data.md) | Adds the Tuning export CSV tab, combined session score averages, and two-minute idle-aware active session timing; removes the Base Jump value beside the slider. |
| 026 | 2026-09-04 | [Align settings heading and search](handoffs/026-2026-09-04-settings-heading-search-alignment.md) | Resets native top-margin offsets so the first Settings heading and search input share the same responsive top inset and horizontal axis. |

## Ready (FIFO — next task is the first row)

_Empty. Enqueue the next ask at the bottom of this table._

| Seq | Enqueued | Session / ask | Notes |
|-----|----------|---------------|-------|
|     |          |               |        |

## Protocol

- Seq numbers are monotonic (`001`, `002`, …). Do not reuse.
- One session file per queue item. Link it from this master; do not dump the write-up here.
- If a Ready item is blocked, leave it at the head and note the blocker in that session file. Do not pull a later item unless the user says to skip.
- Branch for current work: `feature` in `learn/`.
