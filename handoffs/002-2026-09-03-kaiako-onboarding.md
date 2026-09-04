# Session 002 — Kaiako onboarding shell + LaTeX

**Status:** done  
**When:** 2026-09-03  
**Branch:** `feature` (`learn/`)  
**Queue:** read [001](001-2026-09-02-obsidian-demo-sidechat.md) first, then this file.

## Ask

1. Merge demo work to `main`, delete irrelevant branches, create `feature`
2. Rename sidebar project to **Kaiako**; README title/description/font
3. Onboarding + chat shell UI (providers, name/pronouns, data folder, pi detect/toggle, save, chat chrome)
4. Flow blend backgrounds for onboarding/chat; fade animations; persist config locally
5. Buttons mostly no-op except saving config / folder pick / session file create
6. Research pi harness cross-platform startup with API keys
7. Confirm LaTeX support (imperative)

## Git

- Committed demo + handoff on `cus_config`, fast-forwarded into `main`, deleted `cus_config`, created `feature`
- Renamed `obsidian-demo-chat/` → `kaiako/`

## What shipped on `feature`

Plugin id `kaiako` with onboarding → chat shell, LT Superior Serif, local `data.json` config, MarkdownRenderer chat bubbles (LaTeX), session notes under `Kaiako/`.

## LaTeX

- **Obsidian notes:** native MathJax — `$inline$` and `$$` blocks (`$$` on own lines for Reading view)
- **Kaiako sidebar:** `MarkdownRenderer.render` so the same syntax renders in chat bubbles
- No separate KaTeX dependency required

## Pi harness (research)

- Install: `npm i -g --ignore-scripts @earendil-works/pi-coding-agent` or `curl -fsSL https://pi.dev/install.sh | bash`
- Needs Node; expects a bash-capable shell (**Windows: WSL or Git Bash**, not raw `cmd`)
- macOS/Linux: straightforward global npm/`pi` on PATH
- Auth: `/login` or API keys in `~/.pi/agent` — can use the same provider keys Kaiako stores, but Kaiako does not start pi yet
- Cross-platform without issues: **not fully** — Node+npm is portable; Windows native cmd is the weak point; desktop wrappers exist but are separate from the CLI harness
- Kaiako today: detect `pi --version` / `which|where pi`; Install button is notice-only; auto-start toggle is saved only

## Qwen Cloud

Alibaba Cloud Model Studio / DashScope, OpenAI-compatible (`compatible-mode/v1`). Region-bound API keys.

## Not done

- Real provider API calls / cost metering
- Automated pi install or process auto-start
- Push `main`/`feature` to origin (local only unless asked)
