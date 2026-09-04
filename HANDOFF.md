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
