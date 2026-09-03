# Master handoff

**Agents: start here.** This file is a FIFO queue, not a recap.

1. Read **Completed** from the top down (oldest first). Open each linked session before acting.
2. Then take the head of **Ready** (oldest waiting task). Do not skip ahead.
3. After finishing work, write a new `handoffs/NNN-YYYY-MM-DD-slug.md`, append it to the tail of **Completed**, and remove it from **Ready**. Never reorder old rows.

New work is always enqueued at the tail. The next job is always the head of **Ready**.

## Completed (FIFO — read first, oldest at top)

| Seq | When | Session | Result |
|-----|------|---------|--------|
| 001 | 2026-09-02 | [Obsidian demo sidechat](handoffs/001-2026-09-02-obsidian-demo-sidechat.md) | Demo plugin: right-sidebar chat, Send + Upload write into the pane and the open markdown note. Installed in `Obsidian Vault`. |

## Ready (FIFO — next task is the first row)

_Empty. Enqueue the next ask at the bottom of this table._

| Seq | Enqueued | Session / ask | Notes |
|-----|----------|---------------|-------|
|     |          |               |        |

## Protocol

- Seq numbers are monotonic (`001`, `002`, …). Do not reuse.
- One session file per queue item. Link it from this master; do not dump the write-up here.
- If a Ready item is blocked, leave it at the head and note the blocker in that session file. Do not pull a later item unless the user says to skip.
- Branch for current work: `cus_config` in `learn/`.
