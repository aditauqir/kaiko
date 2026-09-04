# Session 005 — Composer, onboarding, Pi skills

**Status:** done  
**When:** 2026-09-03  
**Branch:** `feature`  
**Queue:** 001 → 002 → 003 → 004 → this file.

## Ask

Simplify the chat bar to icon + input + send, install workspace skills into the Pi harness, and cut onboarding to OpenAI / Claude / Qwen Cloud plus skip.

## Chat bar

- Removed model picker and formula/sigma from the composer
- Left control is a lucide `bot` skills/tools status icon (highlights oyster `#d4d4d4` while Pi tool calls run)
- Send is a white circle with a black up arrow
- Gradient chat: composer `rgba(0,0,0,0.55)` capsule
- Lock-in (solid Obsidian background): solid `#000` with `#d4d4d4` border
- Restart onboarding lives in Settings → API keys (“Restart onboarding”), not on the send button

## Pi skills

On data-folder sync / `pi.ensure`, copy from `learn/skills/` into `{dataFolder}/skills` and `{dataFolder}/pi/skills` (`PI_CODING_AGENT_DIR`):

- `teach`, `visualize`
- `stop-slop` and `asd-ste100-markdown` (from `my_skill/` markdown)
- extensions + agents from `learn/skills/.pi` (and `learn/extensions` as fallback)

## Onboarding

- Three providers with letter marks (O / C / Q)
- Skip copy: **skip this (set up later)** plus a right arrow
- Skip still continues through name/pronouns/folder; API key is optional when skipped
