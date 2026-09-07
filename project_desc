# Kaiko (Kaiako) — Comprehensive Project Description & Resume Guide

> **Repository**: [https://github.com/aditauqir/kaiko.git](https://github.com/aditauqir/kaiko.git)<br>
> **Upstream Origin**: Forked from [https://github.com/amosblomqvist/learn.git](https://github.com/amosblomqvist/learn.git) by [Eero Alvar](https://github.com/amosblomqvist)<br>
> **Release Target**: `Kaiko-1.0.0` (Obsidian Community Plugin)  
> **Tech Stack**: TypeScript, Node.js, Electron (Obsidian API), Item Response Theory (Rasch 1PL), Newton–Raphson Numerical Optimization, JSON-RPC, esbuild, CSS3 (Glassmorphism & Custom Fluid Typography)

---

## 1. Executive Summary & Elevator Pitches

### One-Liner
> **Kaiko** is an autonomous, psychometrically-calibrated adaptive learning companion for Obsidian that diagnoses conceptual understanding via Computerized Adaptive Testing (CAT) and scaffolds personalized instruction directly into local Markdown notes.

### Two-Sentence Pitch
> Traditional AI study tools either lecture without diagnostic assessment or deliver disconnected quizzes. Kaiko bridges this gap by integrating a local AI coding agent daemon with a formal Rasch 1-Parameter Logistic Item Response Theory (IRT) engine, dynamically calibrating multiple-choice diagnostics and generating structured knowledge graphs directly inside the user's Obsidian vault.

### 30-Second Elevator Pitch (For Recruiter / Hiring Manager Phone Screen)
> "I built Kaiko, an open-source adaptive learning extension for Obsidian. Instead of just wrapping an LLM chat, I engineered a full psychometric knowledge engine from scratch using the Rasch 1PL Item Response Theory model and Newton-Raphson optimization to calculate a learner's latent ability ($\theta$). The plugin communicates via JSON-RPC over stdio with a local autonomous agent daemon that generates dynamic diagnostics, executes web search tools, and coordinates visual diagramming subagents (Mermaid/SVG). It scaffolds instruction starting at a calibrated baseline below their diagnosed ceiling to lock in foundational concepts, writing persistent, structured Markdown notes with zero data loss."

---

## 2. Technical Highlights & Engineering Metrics

- **Psychometric Engine**: Implemented Rasch 1PL Item Response Theory with Bayesian Maximum A Posteriori (MAP) estimation under a standard normal prior $\theta \sim \mathcal{N}(0, 1)$, resolving mathematical divergence issues inherent in standard Maximum Likelihood Estimation (MLE) for zero/perfect scores.
- **Dynamic Stopping Conditions**: Integrated Computerized Adaptive Testing (CAT) stopping logic driven by Fisher Information standard error thresholds ($SE(\theta) \le 0.50$ after $\ge 4$ items), near-floor failure boundaries, and a 10-item test ceiling.
- **Local Agent IPC**: Architected bidirectional JSON-RPC IPC over stdio to control a local `pi` coding agent daemon, supporting streaming token reveals, tool-call approvals, and subagent delegation.
- **Sub-Millisecond CLI Caching**: Eliminated 2–4 second macOS interactive login shell (`zsh -lic`) evaluation latency by implementing a negative-lookup cache for PATH resolution.
- **Vault-Native Markdown Engine**: Engineered incremental note reconciliation, extracting and updating YAML frontmatter, diagnostic telemetry, and sanitized LaTeX/code blocks with zero data loss.
- **Custom Modern UI**: Designed a bespoke desktop interface utilizing CSS glassmorphism (`backdrop-filter: blur()`), custom typography (LT Superior Serif), an ambient HTML5 Canvas thinking orb, and layout-stable bottom-pinning scroll algorithms.

---

## 3. Resume Bullet Points (Ready to Copy/Paste)

### Option A: AI / Machine Learning & Agent Systems Engineer Focus
- **Architected and built Kaiko**, an adaptive learning companion for Obsidian, orchestrating local AI agent harnesses via **bidirectional JSON-RPC IPC** for real-time tool calling, autonomous web search, and visual diagram generation.
- **Developed a formal psychometric knowledge engine** implementing the **Rasch 1PL Item Response Theory (IRT)** model and **Newton–Raphson numerical optimization** for Bayesian Maximum A Posteriori (MAP) ability estimation.
- **Engineered Computerized Adaptive Testing (CAT)** algorithms with dynamic difficulty calibration and variable-length stopping rules based on Fisher Information standard error thresholds ($SE(\theta) \le 0.50$).
- **Integrated multi-provider LLM support** (Anthropic Claude, OpenAI, Google Gemini, DeepSeek, OpenRouter) with token usage tracking, streaming typewriter reveal, and client-side spend limits.

### Option B: Full-Stack / Software Engineer Focus
- **Engineered an open-source Obsidian desktop extension** in TypeScript and Electron, serving as an interactive personal tutor with vault-native note synchronization and psychometric assessment.
- **Eliminated a 2–4s UI freeze** caused by macOS login shell evaluation by designing a memoized binary resolution cache with negative hit retention and event-driven invalidation.
- **Built resilient bidirectional synchronization** between active UI state and Obsidian vault notes, parsing and serializing YAML frontmatter, MCQ telemetry, and diagnostic logs with zero data loss.
- **Designed a high-performance, layout-stable UI** using modern CSS glassmorphism, responsive typography, interactive quiz approval cards, and smooth scroll bottom-pinning algorithms.

### Option C: Systems & Desktop Applications Engineer Focus
- **Designed a resilient process management layer** in Node.js/Electron, supervising child processes across macOS, Linux, and Windows with graceful shutdown, IPC buffering, and PATH auto-discovery.
- **Implemented an active study telemetry system** tracking focused learning time, detecting idle timeouts (120s inactivity cutoff), and batch-persisting session metadata to disk.
- **Constructed an automated psychometric CSV export pipeline** computing session durations, theta logits, standard errors, and accuracy metrics for longitudinal learning analytics.
- **Automated release packaging and distribution** via esbuild and GitHub Actions, delivering production artifacts (`Kaiko-1.0.0.zip`) targeting Obsidian v1.8+.

---

## 4. Technologies & Skills Matrix

| Category | Technologies & Competencies |
| :--- | :--- |
| **Languages** | TypeScript, JavaScript (ESNext/CommonJS), Node.js, HTML5, CSS3, Shell (Zsh/Bash) |
| **Architecture & Systems** | Desktop Extension Development (Obsidian API, Electron), IPC (JSON-RPC over stdio), Process Supervision, Daemon Lifecycle Management, Child Process Spawning |
| **Algorithms & Mathematics** | Item Response Theory (Rasch 1PL), Bayesian Maximum A Posteriori (MAP) Estimation, Newton–Raphson Method, Fisher Information, Numerical Optimization, CAT Stopping Rules |
| **AI & LLM Integration** | Autonomous Agent Harnesses, Tool Calling, System Prompt Engineering, Streaming Token Reveal, Multi-Provider Architecture (Claude, GPT-4o, Gemini, DeepSeek) |
| **Frontend & UI Engineering** | Canvas 2D Context (Animated Thinking Orb), CSS Glassmorphism (`backdrop-filter`), Responsive Flexbox/Grid, Keyboard Navigation, Accessibility (`aria-live`, role alerts) |
| **Data & Storage** | Obsidian Vault API, YAML Frontmatter Serialization, JSON Storage, CSV Export Generation, State Reconciliation |
| **Tooling & Build** | esbuild, TypeScript Compiler (`tsc`), Git, GitHub Releases, npm |

---

## 5. System Architecture Breakdown

### 5.1 The Three-Phase Pedagogical Harness
Kaiko coordinates learning sessions through a strict, finite-state pedagogical loop:
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

1. **Goal Capture (`need_goal`)**: Enforces explicit alignment before any quizzing or lecture begins. Prevents unsolicited AI monologues.
2. **Adaptive Diagnostic (`diagnostic`)**: Issues single, calibrated multiple-choice questions targeting the learner's estimated latent ability. Updates ability estimate ($\theta$) on every answer.
3. **Scaffolded Instruction (`teaching`)**: Applies the **Base Jump** offset (10, 25, or 40 points below diagnosed ability) to start instruction with foundational principles before building up to advanced concepts.

### 5.2 Mathematical Formulation (Rasch 1PL MAP)

The probability of a correct response ($u_i = 1$) given ability $\theta$ and item difficulty $b_i$:
$$P(u_i = 1 \mid \theta, b_i) = \frac{1}{1 + e^{-(\theta - b_i)}}$$

To estimate $\theta$ with a prior $\theta \sim \mathcal{N}(0, 1)$, we maximize the log-posterior:
$$\log p(\theta \mid \mathbf{u}) = \sum_{i=1}^n \left[ u_i (\theta - b_i) - \ln(1 + e^{\theta - b_i}) \right] - \frac{\theta^2}{2} + C$$

**Gradient**:
$$g(\theta) = -\theta + \sum_{i=1}^n (u_i - P_i(\theta))$$

**Fisher Information / Second Derivative**:
$$I(\theta) = 1 + \sum_{i=1}^n P_i(\theta)(1 - P_i(\theta))$$

**Newton–Raphson Update**:
$$\theta^{(t+1)} = \theta^{(t)} + \frac{g(\theta^{(t)})}{I(\theta^{(t)})}$$

Iterates until $|\Delta \theta| < 10^{-5}$ (typically $\le 4$ iterations). Standard Error is computed as:
$$SE(\theta) = \frac{1}{\sqrt{I(\theta)}}$$

Score transformation:
$$\text{Knowledge Score} = \text{clamp}_{[0, 100]}\left(50 + 20 \times \theta\right)$$

---

## 6. Technical Interview STAR Stories

### Story 1: Designing and Implementing the Psychometric Engine
- **Situation**: Most educational AI chatbots either quiz users with static questions or provide subjective, uncalibrated praise without measuring actual mastery.
- **Task**: Design an adaptive diagnostic testing engine that accurately estimates learner ability in under 10 questions and determines an objective baseline for instruction.
- **Action**: Researched and implemented the Rasch 1-Parameter Logistic (1PL) model from psychometric literature. Wrote a custom Newton-Raphson solver with a Bayesian standard normal prior to prevent divergence on perfect or zero scores. Configured Computerized Adaptive Testing (CAT) stopping conditions based on Fisher Information standard error ($SE(\theta) \le 0.50$) and near-floor failure rules.
- **Result**: Reduced diagnostic time to an average of 4–6 questions while achieving statistical confidence, enabling instruction to start at a precise, calibrated ability offset ("Base Jump").

### Story 2: Debugging Subprocess Latency & Layout Stability in Electron
- **Situation**: When users unlinked the local agent harness or loaded the extension, the UI exhibited a multi-second freeze followed by a flash exposing the unblurred chat before the offline overlay appeared.
- **Task**: Eliminate the multi-second delay and visual glitch to achieve instant, frame-1 overlay rendering.
- **Action**: Profiled the process lifecycle and discovered that when the CLI binary was missing, path resolution fell back to spawning an interactive macOS login shell (`/bin/zsh -lic`), blocking the Electron UI thread for 2–4 seconds because negative results were never cached. Modified the path resolver to memoize `null` lookups, made harness status synchronously available in plugin configuration, implemented real-time view state notification across active leaves, and removed an initial CSS fade-in animation that started at `opacity: 0`.
- **Result**: Reduced detection time from 3,000ms+ to 0ms (instant in-memory check), completely eliminating UI flicker and delivering a steady, glitch-free user experience.

---

## 7. Portfolio Summary Snippet
```markdown
### Kaiko — Adaptive AI Learning Extension for Obsidian
**GitHub**: https://github.com/aditauqir/kaiko
- Engineered an adaptive learning desktop companion in TypeScript/Electron integrating Item Response Theory (Rasch 1PL) and autonomous AI coding agents.
- Implemented Bayesian Maximum A Posteriori (MAP) estimation using Newton–Raphson optimization to calculate latent ability and dynamically calibrate diagnostic difficulties.
- Built bidirectional JSON-RPC IPC over stdio to control local agent daemons, supporting tool execution, web search auto-approval, and visual subagents (Mermaid/SVG).
- Engineered persistent vault note synchronization, active study clock tracking, and psychometric CSV exports with zero data loss.
```
