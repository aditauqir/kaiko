# Kaiako — Adaptive Learning Extension for Obsidian

**Kaiako** (Māori for *teacher* or *instructor*) is an Obsidian extension developed by Zirn Labs that transforms your vault into an interactive, adaptive personal tutor.

Powered by a local [Pi](https://github.com/earendil-works/pi-coding-agent) coding agent harness and psychometric Item Response Theory (IRT), Kaiako diagnoses your current understanding through calibrated multiple-choice questions, estimates your knowledge level, and scaffolds personalized instruction directly into your Obsidian notes.

---

## Table of Contents

- [Overview](#overview)
- [How It Works: The Three-Phase Learning Loop](#how-it-works-the-three-phase-learning-loop)
  - [1. Goal Capture (`need_goal`)](#1-goal-capture-need_goal)
  - [2. Adaptive Diagnostic (`diagnostic`)](#2-adaptive-diagnostic-diagnostic)
  - [3. Scaffolded Instruction (`teaching`)](#3-scaffolded-instruction-teaching)
- [Psychometric Knowledge Engine](#psychometric-knowledge-engine)
- [Key Features](#key-features)
  - [Interactive MCQ Approval Cards](#interactive-mcq-approval-cards)
  - [Ambient Thinking Orb](#ambient-thinking-orb)
  - [Live Typewriter Reveal and Focus Mode](#live-typewriter-reveal-and-focus-mode)
  - [Clean Vault Note Logging](#clean-vault-note-logging)
  - [Active Study Clock and Inactivity Detection](#active-study-clock-and-inactivity-detection)
  - [Stateful Session Resumption](#stateful-session-resumption)
  - [Visual Subagents (Mermaid and SVG)](#visual-subagents-mermaid-and-svg)
  - [Psychometric CSV Data Export](#psychometric-csv-data-export)
- [Supported Model Providers](#supported-model-providers)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
  - [1. Build the Obsidian Plugin](#1-build-the-obsidian-plugin)
  - [2. Link into Your Obsidian Vault](#2-link-into-your-obsidian-vault)
  - [3. Install the Pi Agent CLI](#3-install-the-pi-agent-cli)
  - [4. Complete the Onboarding Wizard](#4-complete-the-onboarding-wizard)
- [Configuration Reference](#configuration-reference)
- [Companion Extensions and Skills](#companion-extensions-and-skills)
- [Development and Handoff Protocol](#development-and-handoff-protocol)
- [License](#license)

---

## Overview

Traditional AI study assistants either lecture without assessing current knowledge or deliver generic quizzes detached from note-taking workflows. Kaiako bridges this gap:

- **Sidebar Companion**: Operates as a native Obsidian right-sidebar view with custom typography (LT Superior Serif), rich LaTeX rendering, and smooth animations.
- **Psychometrically Calibrated**: Applies Rasch 1PL Item Response Theory with Maximum A Posteriori (MAP) ability estimation to measure knowledge on a 0 to 100 point scale.
- **Base Jump Pedagogical Entry**: Starts instruction below your tested ability ceiling to establish unshakeable foundational principles before building upward.
- **Vault First**: Automatically creates and updates Markdown notes in your vault (`Kaiako/<Topic>-<ID>.md`) containing the conversation transcript, clean diagnostic results, and frontmatter metadata.
- **Local Agent Execution**: Communicates via JSON-RPC with the `pi` coding agent daemon, executing subagents, web search, and specialized skills locally.

---

## How It Works: The Three-Phase Learning Loop

Kaiako coordinates every learning session through a structured three-phase pedagogical harness:

```
┌───────────────────────────────────────────────────────────┐
│                 1. Goal Capture (need_goal)               │
│  Learner defines target capability → Agent confirms goal  │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│               2. Adaptive Diagnostic (diagnostic)         │
│  Interactive MCQs (max 10) → Rasch 1PL MAP theta update   │
│  Stops on SE(θ) ≤ 0.50, near-floor misses, or 10 items    │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│               3. Scaffolded Instruction (teaching)        │
│  Teaching entry = Knowledge score − Base Jump offset      │
│  Unconditional truths first → Motivated discovery upward  │
└───────────────────────────────────────────────────────────┘
```

### 1. Goal Capture (`need_goal`)
Before any instruction or quizzing begins, Kaiako asks the learner what specific capability they want to develop. The system enforces this rule strictly: no lectures, no multiple-choice questions, and no tool calls occur until a concrete learning goal is confirmed.

### 2. Adaptive Diagnostic (`diagnostic`)
Once a goal is established, Kaiako launches a Computerized Adaptive Test (CAT):
- Emits clean, single-question multiple-choice prompts targeting estimated ability.
- Adjusts question difficulty dynamically in logit units based on previous correctness.
- Computes an ability estimate ($\theta$) and maps it to a 0 to 100 knowledge score.
- Stops adaptively when statistical uncertainty drops below the target threshold.

### 3. Scaffolded Instruction (`teaching`)
Rather than teaching at the learner's maximum diagnostic limit, Kaiako applies a **Base Jump** offset. Instruction starts at a calibrated baseline below the measured score:
- **Low sensitivity**: 10 points below diagnosed score.
- **Medium sensitivity (default)**: 25 points below diagnosed score.
- **High sensitivity**: 40 points below diagnosed score.

Instruction follows the core principles in `skills/teach`: lock in unconditional truths first (foundations that require no caveats), construct a connected mental dependency graph, and guide the learner to motivated conceptual breakthroughs.

---

## Psychometric Knowledge Engine

Kaiako implements a formal Item Response Theory (IRT) engine (`kaiako/src/knowledge.ts`):

- **Model**: Rasch One-Parameter Logistic (1PL) model:
  $$P(U_{ni} = 1 \mid \theta_n, b_i) = \frac{1}{1 + e^{-(\theta_n - b_i)}}$$
  where $\theta_n$ represents learner ability and $b_i$ represents item difficulty in logits (clamped between $-2.5$ and $+2.5$).
- **Estimation**: Newton–Raphson Maximum A Posteriori (MAP) estimation with a standard normal prior $\theta \sim \mathcal{N}(0, 1)$. This maintains finite, stable ability estimates even for all-correct or all-miss sequences.
- **Standard Error**: Calculated as $\text{SE}(\theta) = \frac{1}{\sqrt{\mathcal{I}(\theta)}}$ using Fisher test information.
- **Stopping Criteria**:
  - **SE Stop**: $\text{SE}(\theta) \le 0.50$ after at least 4 items.
  - **Floor Stop**: Learner misses at least 3 items with $\theta \le -1.2$ logits.
  - **Ceiling Stop**: Maximum of 10 diagnostic items reached.
- **Score Conversion**: Ability $\theta$ translates to points using:
  $$\text{knowledge\_score} = \operatorname{clamp}(50 + 20\theta, 0, 100)$$

---

## Key Features

### Interactive MCQ Approval Cards
Diagnostic questions render as interactive cards (`kaiako/src/approval-card.ts`) directly inside the sidebar conversation:
- Single-select radio buttons that submit immediately upon choice.
- Custom text input field ("Something else...") for alternative learner explanations.
- Skip and "I don't know" button to signal lack of knowledge without guessing.
- Dismiss and reopen button to collapse cards while reviewing previous notes.
- Strict two-column CSS grid that responds smoothly to sidebar resizing without text clipping.

### Ambient Thinking Orb
A floating, centered canvas element (`kaiako/src/thinking-orb.ts`) hovers above the composer:
- Visual color signatures and animations for each session phase: **Goal Setting** (warm tone), **Smoke Testing / Diagnostic** (violet/blue), and **Teaching** (emerald/amber).
- Real-time pulse during model thinking and tool execution.
- Smooth cubic-bezier transitions matching the interface typography.

### Live Typewriter Reveal and Focus Mode
- Assistant responses stream smoothly with a typewriter effect (`kaiako/src/streaming-text.ts`), falling back cleanly if streaming is interrupted.
- Chat background features a distraction-free, blurred gradient focus texture.
- Lock-in high-contrast mode for clear readability in both light and dark Obsidian themes.

### Clean Vault Note Logging
Every conversation automatically synchronizes to a vault note (`Kaiako/<Topic>-<ID>.md`):
- Titles are automatically generated from conversation context and capped at three words.
- Diagnostic MCQs persist cleanly as Markdown records (`Question:`, `Result: Correct/Incorrect`, `Correct answer:`), eliminating cluttered code blocks.
- Unanswered questions retain recovery data in hidden frontmatter (`kaiako_pending_mcq`) so interactive cards reload seamlessly across Obsidian restarts.

### Active Study Clock and Inactivity Detection
- Tracks real learner engagement time in seconds and minutes.
- Features an automatic 2-minute idle detection mechanism (`kaiako/src/session-activity.ts`). When the learner stops interacting for more than 120 seconds, the active timer pauses until the next interaction.
- Frontmatter metadata and exported reports record accurate, undistorted study times.

### Stateful Session Resumption
When you reopen an existing session or switch between notes:
- The plugin identifies the active session ID and launches or rebinds the Pi process with `--session-id <id>`.
- Persisted note transcripts are injected as bounded resume context (`<kaiako-resume-context>`), preventing the AI tutor from repeating completed diagnostic or instructional steps.

### Visual Subagents (Mermaid and SVG)
When an explanation requires visual intuition:
- Pi invokes specialized background subagents (`mermaid-maker` or `svg-maker`) via `skills/visualize`.
- The subagent writes diagram code, renders it to PNG via headless Chrome or `rsvg-convert`, visually inspects the image, and embeds the verified illustration directly into the note.

### Psychometric CSV Data Export
The Settings modal includes a **Tuning → Export data** panel (`kaiako/src/export-data.ts`):
- Downloads a research-grade CSV containing an aggregate `summary` row and individual rows for every session.
- Exported fields include: `session_id`, `topic`, `goal`, `phase`, `created_at`, `last_interaction_at`, `active_seconds`, `active_minutes`, `learner_turns`, `assistant_turns`, `diagnostic_items`, `correct_items`, `diagnostic_accuracy`, `average_item_difficulty`, `baseline_score`, `knowledge_score`, `knowledge_theta`, `knowledge_se`, `teaching_entry_score`, `base_jump_level`, and `all_sessions_average_score`.

---

## Supported Model Providers

Kaiako includes built-in provider profiles with live API key status validation:

| Provider | Default Model | Environment Variable | Notes |
|----------|---------------|----------------------|-------|
| **Anthropic Claude** | `claude-3-7-sonnet-latest` | `ANTHROPIC_API_KEY` | Native Pi agent support |
| **OpenAI** | `gpt-4o` | `OPENAI_API_KEY` | Tool-calling and reasoning support |
| **Google Gemini** | `gemini-2.5-flash` | `GEMINI_API_KEY` | Fast streaming inference |
| **Qwen Cloud** | `qwen-plus` | `DASHSCOPE_API_KEY` | Alibaba Cloud DashScope compatible mode |
| **DeepSeek** | `deepseek-chat` | `DEEPSEEK_API_KEY` | DeepSeek API compatibility |
| **OpenRouter** | `anthropic/claude-3.5-sonnet` | `OPENROUTER_API_KEY` | Multi-model routing |

---

## Repository Structure

```
learn/
├── README.md                      # Primary project documentation
├── HANDOFF.md                     # FIFO task queue and session handoff registry
├── handoffs/                      # Monotonic session records (001–033+)
│   ├── 001-2026-09-02-...md
│   └── 033-2026-09-05-...md
│
├── kaiako/                        # Obsidian plugin source code
│   ├── manifest.json              # Plugin manifest (ID: "kaiako")
│   ├── package.json               # Build scripts and dependencies
│   ├── esbuild.config.mjs         # Production & development bundler
│   ├── styles.css                 # Sidebar, MCQ card, and settings styles
│   ├── assets/fonts/              # LT Superior Serif font bundle
│   └── src/
│       ├── main.ts                # Plugin lifecycle, commands, ribbon icon
│       ├── kaiako-view.ts         # Sidebar ItemView, chat flow, turn rendering
│       ├── approval-card.ts       # Interactive MCQ DOM component
│       ├── mcq.ts                 # Markdown MCQ parsing, formatting, validation
│       ├── knowledge.ts           # Rasch 1PL IRT model and MAP ability estimator
│       ├── goal.ts                # Goal extraction from learner input
│       ├── harness-prompt.ts      # Agent prompt synthesis across phases
│       ├── pi.ts                  # Child process lifecycle for pi --mode rpc
│       ├── session-activity.ts    # 2-minute idle-aware active study timer
│       ├── export-data.ts         # CSV analytics export engine
│       ├── settings-modal.ts      # Multi-tab settings UI
│       ├── note-writer.ts         # Vault note synchronization & frontmatter
│       ├── config.ts              # Plugin state types and defaults
│       ├── thinking-orb.ts        # Phase-based animated orb canvas
│       ├── providers.ts           # Provider configurations and key handling
│       ├── api-key-check.ts       # Live API key verification network checks
│       ├── skills-sync.ts         # Skill and agent directory sync into Pi
│       ├── streaming-text.ts      # Typewriter streaming reveal controller
│       ├── folder.ts              # Data directory selector
│       ├── yaml-store.ts          # External YAML configuration mirror
│       └── cli-path.ts            # Node, npm, and binary path resolver
│
├── extensions/                    # Pi agent companion extensions
│   ├── quiz.ts                    # Graded interactive quiz tool for terminal/Pi
│   ├── ask-user-question.ts       # Preference and clarification collector
│   ├── md-log.ts                  # Real-time Markdown transcript logger
│   └── visual-tools/              # Mermaid and SVG authoring tool suite
│
├── skills/                        # Curated Pi skills (synced to harness)
│   ├── teach/                     # Core dependency-graph pedagogical method
│   ├── visualize/                 # Autonomous diagram direction
│   ├── harness/                   # Kaiako 3-phase prompt harness specification
│   └── my_skill/                  # Writing style standards (STOP_SLOP, ASD-STE100)
│
└── agents/                        # Autonomous visual maker subagents
    ├── mermaid-maker.md           # Diagram authoring & rendering agent
    ├── svg-maker.md               # Spatial & geometric illustration agent
    └── researcher.md              # Research and documentation subagent
```

---

## Prerequisites

- **Node.js**: Version 18.0.0 or higher.
- **Obsidian**: Version 1.8.0 or higher (macOS, Linux, or Windows via WSL/Git Bash).
- **Pi Coding Agent**: Global installation of `@earendil-works/pi-coding-agent`. Can be installed automatically through the plugin settings.
- **API Key**: At least one valid API key from a supported provider.

---

## Installation and Setup

### 1. Build the Obsidian Plugin

Clone this repository and build the production bundle:

```bash
cd learn/kaiako
npm install
npm run build
```

This compiles TypeScript and generates `main.js` using esbuild.

### 2. Link into Your Obsidian Vault

Create a `kaiako` folder inside your vault's plugin directory and link or copy the compiled files:

```bash
# Path to your Obsidian vault plugin folder
export VAULT_PLUGINS="/path/to/YourVault/.obsidian/plugins/kaiako"
mkdir -p "$VAULT_PLUGINS"

# Symlink or copy manifest, bundle, and styles
ln -s "$(pwd)/manifest.json" "$VAULT_PLUGINS/manifest.json"
ln -s "$(pwd)/main.js" "$VAULT_PLUGINS/main.js"
ln -s "$(pwd)/styles.css" "$VAULT_PLUGINS/styles.css"
```

1. Open Obsidian.
2. Navigate to **Settings → Community plugins**.
3. Disable **Restricted mode** if enabled.
4. Enable **Kaiako** in the installed plugins list.

### 3. Install the Pi Agent CLI

Kaiako utilizes the Pi coding agent harness. Install it globally:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

*Note: You can also click the **Install Pi harness** button inside the Kaiako settings or onboarding screen.*

### 4. Complete the Onboarding Wizard

When you open Kaiako for the first time by clicking the graduation cap icon in the left ribbon:
1. **Choose Provider**: Select your preferred AI provider (Anthropic, OpenAI, Gemini, etc.).
2. **Enter API Key**: Paste your API key (verified on input).
3. **Learner Identity**: Enter your name, pronouns (such as `they/them` or `she/her`), and background information.
4. **Data Folder**: Select a dedicated folder where Pi skills, agent logs, and runtime data will be stored.
5. **Start Learning**: The onboarding wizard prepares the harness and opens your first session.

---

## Configuration Reference

Access configuration by clicking the gear icon at the top of the Kaiako pane or opening Obsidian Settings:

- **Account**:
  - **API Keys**: Manage keys across multiple providers, switch active inference models, and run key connectivity tests.
  - **User Info**: Edit your name, pronouns, and personalized background notes.
- **Data**:
  - **Sessions**: Browse all stored sessions, view timestamps, and delete old transcripts.
  - **Folder**: View or migrate the active Kaiako runtime data folder.
  - **Pi**: Inspect Pi harness status, toggle auto-start on Obsidian launch, and enable web search integration.
- **Tuning**:
  - **Base Jump**: Adjust instructional starting sensitivity:
    - **Low**: Instruction begins 10 points below diagnosed ability.
    - **Medium (Default)**: Instruction begins 25 points below diagnosed ability.
    - **High**: Instruction begins 40 points below diagnosed ability.
  - **Export Data**: Export comprehensive learning records and study time metrics as a CSV file.

---

## Companion Extensions and Skills

The `learn/` workspace contains companion tools that synchronize into the Pi environment:

- **`extensions/quiz.ts`**: A terminal-grade multiple-choice quiz engine with instant grading, option shuffling, and distinct "I don't know" tracking.
- **`extensions/ask-user-question.ts`**: Interactive terminal component for user clarification and design decisions.
- **`extensions/md-log.ts`**: Live Markdown mirror that streams terminal agent sessions into readable notes.
- **`extensions/visual-tools/`**: Exposes `write_mermaid`, `render_mermaid`, `write_svg`, and `render_svg` tools to maker subagents.
- **`skills/teach/`**: Pedagogical guide enforcing unconditional truth sequencing and dependency-graph understanding over rote memorization.
- **`skills/visualize/`**: Decision guide for briefing visual maker subagents.
- **`skills/my_skill/STOP_SLOP.md`**: Text pruning rules that eliminate artificial AI writing tropes and passive phrasing.

---

## Development and Handoff Protocol

This repository follows a strict FIFO queue workflow documented in [HANDOFF.md](file:///Users/aditauqir/Code/zirn_reprise/learn/HANDOFF.md):

1. Read **Completed** rows from top to bottom before starting work.
2. Pull the next task from the head of the **Ready** table.
3. Keep feature work on the `feature` branch.
4. When work is completed:
   - Run verification (`npm run build` in `kaiako/`).
   - Create a new record in `handoffs/NNN-YYYY-MM-DD-slug.md`.
   - Append the record to the tail of **Completed** in `HANDOFF.md`.
   - Remove the completed item from **Ready**.

---

## License
Code is licensed under the [0-BSD License](file:///Users/aditauqir/Code/zirn_reprise/learn/kaiako/package.json).
Developed by **Zirn Labs**.
