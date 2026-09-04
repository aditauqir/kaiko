---
name: asd-ste100-markdown
description: Create and revise Markdown files in an agent-optimized form of ASD-STE100 Simplified Technical English. Use whenever Codex creates a new .md file or substantially rewrites Markdown, including SKILL.md, README.md, AGENTS.md, plugin documentation, technical documentation, runbooks, guides, and reference files. Preserve required schemas, code, commands, identifiers, links, quotations, legal text, and product terminology.
---

# ASD-STE100 Markdown

## Objective

Create Markdown that humans and agents can read, interpret, and execute correctly.

Apply the principles of ASD-STE100 Simplified Technical English, Issue 9, to technical Markdown. Issue 9 was current when this skill was created. Optimize the structure for agent use without changing the technical meaning.

Treat this skill as an independent writing aid. Do not claim formal ASD-STE100 compliance unless the text is checked against the complete official standard and controlled dictionary.

## Apply Requirements in This Order

1. Follow the user's explicit requirements.
2. Follow the required file schema and project instructions.
3. Preserve technical and factual accuracy.
4. Apply the controlled-language rules in this skill.
5. Apply optional style preferences.

If two requirements conflict, follow the higher requirement. Mention a material exception only when it affects the delivered document.

## Preserve Exact Content

Do not simplify or translate these items:

- Code and code comments
- Commands and command output
- Identifiers, API names, and configuration keys
- File paths, URLs, and version numbers
- YAML frontmatter keys and required values
- Quoted text and legal text
- Product names, trademarks, and approved project terms
- Normative keywords when a specification defines them

Edit prose around these items to make the instructions clear.

## Use the Writing Workflow

1. Identify the document type, audience, purpose, and required result.
2. Collect the required facts, constraints, inputs, and outputs.
3. Create a short outline with descriptive headings.
4. Draft the content with the controlled-language rules.
5. Add agent-useful structure only when it improves execution.
6. Check the Markdown syntax and all exact-content items.
7. Complete the self-check before delivery.

Do not add a compliance statement or a process report to the document unless the user requests it.

## Control Words and Terms

- Use one term for one concept.
- Use the same term each time that you refer to the same item.
- Use common words with their common meanings.
- Use approved project terms as technical nouns or technical verbs.
- Select short and specific technical terms.
- Avoid idioms, slang, humor, jargon, and decorative language.
- Avoid contractions.
- Avoid vague words such as `thing`, `stuff`, `somehow`, and `usually`.
- Avoid unnecessary synonyms.
- Use American English spelling unless the project requires a different form.
- Define an abbreviation at its first use unless the audience already knows it.
- Do not replace an exact technical term only to make the vocabulary simpler.

## Control Sentences

- Use the active voice for instructions.
- Start an instruction with an imperative verb.
- Put a condition before the action that depends on it.
- Write one action in each procedural sentence.
- Write one main idea in each descriptive sentence.
- Use short sentences. Target 20 words or fewer for instructions and 25 words or fewer for descriptions.
- Split a long sentence when the split does not change its meaning.
- Make each pronoun reference explicit.
- Replace an ambiguous `this`, `that`, `it`, or `they` with the applicable noun.
- Use positive instructions unless a prohibition is necessary for safety or correctness.
- Use `must` for a requirement and `can` for a capability.
- Use `may` only for permission.
- Avoid `should` when the reader can interpret it as either optional or required.
- Preserve defined normative words such as `MUST`, `SHOULD`, and `MAY` in standards-based documents.
- Avoid long noun clusters. Preserve established technical names even when they are long.

## Structure Markdown

- Use one level-1 heading unless the required format specifies a different structure.
- Use descriptive headings that state the section purpose.
- Keep heading levels in sequence.
- Put one topic in each paragraph.
- Use a bulleted list for parallel items.
- Use a numbered list only for sequence or priority.
- Put one action or concept in each list item.
- Use a table only when readers must compare repeated fields or exact mappings.
- Use fenced code blocks with a language identifier when known.
- Keep code, commands, and machine-readable examples exact.
- Use descriptive link text.
- Add useful alt text to informative images.
- Keep notes, warnings, and examples separate from required actions.
- Do not use emphasis as a substitute for structure.
- Do not add sections that do not help the reader complete the task.

## Optimize for Agent Use

Add these elements when they are applicable:

- State the goal and the final result.
- State required inputs, outputs, preconditions, and permissions.
- Put actions in execution order.
- Separate requirements, recommendations, examples, and exceptions.
- State decision conditions explicitly.
- Name the actor when more than one actor can do an action.
- Give exact paths, commands, values, and expected results.
- Add validation steps and acceptance criteria.
- Add recovery or rollback steps for risky operations.
- State failure behavior and stop conditions.
- Remove hidden assumptions and vague cross-references.

Do not add empty template sections. Do not duplicate information to make the document appear complete.

## Adapt to the File Type

### SKILL.md

- Keep the YAML frontmatter valid.
- Put all trigger conditions in the `description` field.
- Write the body in the imperative form.
- Keep the workflow concise and executable.
- Reference bundled resources only when the task needs them.
- Include validation instructions.
- Do not create an additional README for a skill unless the user requires it.

### README.md

- State the purpose and supported scope first.
- Add prerequisites before installation or setup.
- Provide the shortest valid quick start.
- Separate usage, configuration, validation, and troubleshooting.
- State destructive or irreversible effects before the related action.

### Plugin Documentation

- State the plugin scope and trigger conditions.
- State dependencies, permissions, and connections.
- Identify each tool and its permitted purpose.
- State validation, failure behavior, and security limits.
- Keep setup actions in execution order.

### Technical Guides and Runbooks

- Identify the audience and prerequisites.
- State the expected result before the procedure.
- Put one action in each numbered step.
- State the expected result after a critical step.
- Add recovery instructions when an action can fail or cause data loss.

## Complete the Self-Check

Confirm all applicable statements:

- The document preserves the requested meaning.
- The document follows the required schema.
- Each concept has one consistent term.
- Each instruction identifies a clear action.
- Each condition appears before its dependent action.
- Sentence length meets the target or has a technical reason to exceed it.
- Pronoun references are unambiguous.
- Code, commands, identifiers, links, quotations, and legal text are exact.
- Headings and lists show the execution structure.
- Validation and failure behavior are present when needed.
- The document does not make an unsupported compliance claim.

For contractual or regulated compliance, check the [official ASD-STE100 website](https://www.asd-ste100.org/) for the current issue. Use the complete standard and an appropriate formal review.

ASD-STE100 Simplified Technical English is owned by ASD, Brussels, Belgium. European Union Trade Mark No. 017966390.
