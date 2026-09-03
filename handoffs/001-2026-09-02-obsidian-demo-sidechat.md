# Session 001 — Obsidian demo sidechat

**Status:** done  
**When:** 2026-09-02  
**Branch:** `cus_config` (`learn/`)  
**Queue:** read this after any older completed sessions in [HANDOFF.md](../HANDOFF.md). This is currently the only completed item.

## Ask

Build a demo Obsidian plugin on this branch: a side chat with a prompt box, Send, and Upload. Clicking either button should show the user input in the chat pane **and** in the open markdown note.

Earlier in the same session (research only, no code until the demo ask):

1. What can Obsidian extensions change about layout?
2. Lookup the public plugin API, not this repo.
3. Can a plugin add a chat-style prompt on the note viewer?

## What shipped

A local community plugin **Demo Sidechat** (`demo-sidechat`) at `obsidian-demo-chat/`.

It registers a custom `ItemView` (`demo-sidechat-view`) and opens it in the right sidebar (ribbon icon, command **Open demo chat**, and auto-open on layout ready).

| Control | Chat pane | Open markdown note |
|---------|-----------|--------------------|
| **Send** (or Enter) | Bubble with the typed text | Appends `**You:** …` |
| **Upload** | Bubble with filename; image preview when the file is an image | Copies the file into the vault via `getAvailablePathForAttachment`, then appends `**You uploaded:** name` plus `![[name]]` or `[[name]]`. Text still in the box is prepended as `**You:** …` |

If no markdown tab is open, the plugin creates/opens `Demo Chat.md` and writes there. Source mode uses the editor; reading view uses `vault.process`.

## Layout (from the API lookup)

Obsidian has no first-class “dock a chat overlay on the markdown viewer” hook. The supported pattern (used here) is a custom pane next to the note. Overlaying the reading view would be a post-processor or unofficial DOM injection; this demo does not do that.

## Install state

Built with `npm run build` in `obsidian-demo-chat/`.

Linked into the personal vault (not in git):

- `~/Documents/Obsidian Vault/.obsidian/plugins/demo-sidechat/` → symlinks to `manifest.json`, `main.js`, `styles.css`
- `community-plugins.json` includes `"demo-sidechat"`

Reload Obsidian (`Cmd+R`) after pulls. If Restricted mode is on: Settings → Community plugins → turn on, then enable **Demo Sidechat**.

## Source map

- `obsidian-demo-chat/src/main.ts` — plugin, view register, ribbon, command, sidebar open
- `obsidian-demo-chat/src/chat-view.ts` — chat UI, Send, Upload
- `obsidian-demo-chat/src/note-writer.ts` — find/create target note, append markdown
- `obsidian-demo-chat/styles.css` — theme-variable layout for the pane

## Not done

- No LLM / real chat backend (echo demo only)
- Plugin files in the vault are local symlinks; other machines need a rebuild + install
- This session was not committed
