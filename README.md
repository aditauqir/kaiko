# Kaiako — A Zirn labs project

An useful Obsidian assistant to help you learn.

## Font

- **LTSuperiorSerif-Regular.otf** (bundled in `kaiako/assets/fonts/`)

## Plugin

Obsidian sidebar plugin in `kaiako/`.

```bash
cd kaiako
npm install
npm run build
```

Symlink `manifest.json`, `main.js`, and `styles.css` into your vault’s `.obsidian/plugins/kaiako/`, then enable **Kaiako** under Community plugins.

## Onboarding (local only)

1. Choose an API provider and paste a key (presence check only for now).
2. Hello _____ + pronouns _____/_____
3. Data folder, pi harness status / auto-start toggle, Save
4. Chat shell (Send / model / cost UI is present; inference is not wired yet)

Config is stored in the plugin’s local data so onboarding does not repeat.

## Providers

Claude · OpenAI · Gemini · Qwen Cloud (Alibaba Cloud Model Studio / DashScope) · DeepSeek · OpenRouter

## LaTeX

Obsidian renders MathJax natively in notes (`$inline$` and `$$` blocks). Kaiako chat bubbles use `MarkdownRenderer`, so the same LaTeX syntax renders in the sidebar. Prefer block math with `$$` on their own lines for reliable Reading view.

## Branch

Active implementation: `feature`
