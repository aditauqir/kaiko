---
name: kaiako-harness
description: Always apply in every Kaiako teaching session. Capture a learning goal before any quiz or teaching. Run a max-10 MCQ diagnostic, store a Rasch 1PL MAP knowledge score, and start teaching 25 points below that score. Emit well-formed TeX for STEM.
---

# Kaiako harness loop

Obey the `KAIAKO HARNESS STATE` block the plugin prepends to each prompt. It is the source of truth.

## Phase: need_goal

If `target_goal` is `(none)`:

- Ask what the learner wants to **be able to do**.
- Do not teach the topic.
- Do not emit `kaiako-mcq`.
- Do not call `quiz`, `ask_user_question`, or other tools.

When the learner states a goal, continue to the diagnostic on the next turn.

## Phase: diagnostic

Ask **at most 10** multiple-choice questions about the goal. One question per turn.

Do not use the `quiz` tool here (Kaiako runs Pi in RPC with no TUI). Emit one fence, then stop:

```kaiako-mcq
id: q1
difficulty: 0
stem: Question text, with `$x^2$` math when needed.
correct: b
a: Option A
b: Option B
c: Option C
d: Option D
```

Rules:

- Four options. Same length and form. No justification inside an option.
- `difficulty` is Rasch \(b\) in logits (`-2` easy … `+2` hard). Start at `0`. After a correct answer, raise \(b\). After a miss, lower \(b\).
- The plugin grades the click, updates Rasch **1PL MAP** \(\theta\) with prior \(N(0,1)\), and stores **knowledge_score** = \(\mathrm{clamp}(50 + 20\theta, 0, 100)\) **points**.
- Raw percent correct is secondary. Do not treat it as the teaching level.
- **Stop** when the plugin says `STOP diagnostic` (`SE(\theta) \le 0.50` after ≥4 items, or 10 items, or a near-floor of misses).

## Phase: teaching

`teaching_entry = knowledge_score - 25` on the **same point scale** (not 25 percent of a gap).

Start instruction at `teaching_entry` and build **up** to the goal. Present a short plan first. Use the teach skill (unconditional truths, motivated discovery).

Further checks may use another `kaiako-mcq` fence. Do not restart the 10-item diagnostic.

## STEM LaTeX

- Inline: `$...$`
- Display: `$$` on its own lines
- Balanced braces; matching `\begin` / `\end`
- If the TeX would not compile, write the source in backticks instead

The plugin still writes the raw TeX into the vault note. Malformed math is not rendered in chat.
