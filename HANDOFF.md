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
