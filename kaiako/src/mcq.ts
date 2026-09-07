export interface McqOption {
	id: string;
	text: string;
}

export interface McqItem {
	id: string;
	difficulty: number;
	stem: string;
	options: McqOption[];
	correct: string;
}

const FENCE = /```(?:kaiako-)?mcq\s*([\s\S]*?)```/i;
const FENCE_GLOBAL = /```(?:kaiako-)?mcq\s*([\s\S]*?)```/gi;
const MARKED_BLOCK = /<!--\s*kaiako-mcq\s*-->\s*([\s\S]*?)\s*<!--\s*\/kaiako-mcq\s*-->/i;
const GLOBAL_CORRECT = /(?:<!--\s*(?:correct|answer)\s*:\s*(?:option\s+)?(?:\*\*|\()?([a-dA-D]|[1-4])(?:\*\*|\))?\s*-->|(?:\*\*|#)?\s*(?:correct(?:\s*answer)?|answer)\s*(?::\*\*|(?:\*\*)?:|[-:])\s*(?:option\s+)?(?:\*\*|\()?([a-dA-D]|[1-4])(?:\*\*|\)?|\.))/i;

/**
 * Matches options formatted in any common style:
 * - A. / - A) / - A: / - A -
 * - **A.** / - **A)** / - **A**: / - **A**
 * **A.** / **A)** / **A**: / **A**
 * (A) / - (A) / [A] / - [A]
 * A. / A) / A: / A -
 * Numbered: 1. / - 1. / 1) / **1.** / **1)**
 * YAML: a: text
 */
function matchOptionLine(line: string): McqOption | null {
	const trimmed = line.trim();
	if (!trimmed || GLOBAL_CORRECT.test(trimmed)) return null;

	const m = trimmed.match(
		/^(?:[-*+]\s+)?(?:(?:\*\*|\()?\s*([a-dA-D]|[1-4])\s*(?:\*\*|\))?[.)\-:]?|(?:\*\*|\()\s*([a-dA-D]|[1-4])\s*[.)\-:]?\s*(?:\*\*|\))|(?:\*\*)?([a-dA-D]|[1-4])(?:\*\*)?\s*[.)\-:]?|\[([a-dA-D]|[1-4])\])\s+(.+)$/i,
	);
	if (m) {
		let rawId = (m[1] || m[2] || m[3] || m[4] || "").toLowerCase();
		if (rawId === "1") rawId = "a";
		else if (rawId === "2") rawId = "b";
		else if (rawId === "3") rawId = "c";
		else if (rawId === "4") rawId = "d";
		const text = (m[5] || "").replace(/^\*\*\s*/, "").replace(/\s*\*\*$/, "").trim();
		if (text) return { id: rawId, text };
	}

	const yamlMatch = trimmed.match(/^([a-dA-D])\s*:\s*(.+)$/);
	if (yamlMatch && yamlMatch[1] && yamlMatch[2]) {
		return { id: yamlMatch[1].toLowerCase(), text: yamlMatch[2].trim() };
	}

	return null;
}

function cleanStemText(stem: string): string {
	return stem
		.replace(/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:smoke\s*test(?:\s+question)?|diagnostic(?:\s+question)?|question(?:\s*\d+)?)(?:\*\*)?[:.]?(?:\*\*)?\s*/i, "")
		.replace(/^\s*\d+[.)]\s+/, "")
		.trim();
}

/**
 * Strips internal control comments and markers from markdown so the result
 * is always 100% renderable in Obsidian without invisible/blank gaps or raw comments.
 * Preserves comments inside code blocks (fenced ```...``` or ~~~...~~~ or inline `...`).
 */
export function stripUnrenderableComments(markdown: string): string {
	if (!markdown) return "";
	// 1. Remove kaiako-mcq fences (both markdown code fences and HTML comment markers)
	let cleaned = markdown
		.replace(/```(?:kaiako-)?mcq[\s\S]*?(```|$)/gi, "")
		.replace(/<!--\s*kaiako-mcq\s*-->[\s\S]*?(?:<!--\s*\/kaiako-mcq\s*-->|$)/gi, "");

	// 2. Remove all HTML comments outside of legitimate code blocks.
	// Supports multi-backtick blocks, tilde blocks, and inline code.
	cleaned = cleaned.replace(
		/(```+[\s\S]*?(?:```+|$)|~~~+[\s\S]*?(?:~~~+|$)|`[^`\n]*`)|<!--[\s\S]*?(?:-->|$)/gi,
		(match, code) => (code ? code : ""),
	);

	// 3. Clean whitespace-only lines and collapse excess blank lines (max 1 blank line between blocks)
	return cleaned
		.split("\n")
		.map((line) => (line.trim().length === 0 ? "" : line))
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function extractGlobalCorrect(text: string): string {
	const match = text.match(GLOBAL_CORRECT);
	let cid = (match?.[1] || match?.[2] || "").toLowerCase();
	if (cid === "1") cid = "a";
	else if (cid === "2") cid = "b";
	else if (cid === "3") cid = "c";
	else if (cid === "4") cid = "d";
	return cid;
}

export function splitMcq(markdown: string): { prose: string; mcq: McqItem | null } {
	const globalCorrect = extractGlobalCorrect(markdown);

	const match = markdown.match(FENCE);
	if (match) {
		let mcq = parseMcqBlock(match[1] ?? "");
		if (mcq && globalCorrect && (!mcq.correct || mcq.correct === mcq.options[0]?.id)) {
			if (mcq.options.some((o) => o.id === globalCorrect)) mcq.correct = globalCorrect;
		}
		const prose = stripUnrenderableComments(markdown.replace(FENCE, ""));
		return { prose, mcq };
	}

	const marked = markdown.match(MARKED_BLOCK);
	if (marked) {
		let mcq = parseMcqBlock(marked[1] ?? "");
		if (mcq && globalCorrect && (!mcq.correct || mcq.correct === mcq.options[0]?.id)) {
			if (mcq.options.some((o) => o.id === globalCorrect)) mcq.correct = globalCorrect;
		}
		const prose = stripUnrenderableComments(markdown.replace(MARKED_BLOCK, ""));
		return { prose, mcq };
	}

	// Fallback: Check if clean Markdown MCQ was generated without fences
	const lines = markdown.split("\n");
	let firstOpt = -1;
	for (let i = 0; i < lines.length; i += 1) {
		if (matchOptionLine(lines[i] ?? "")) {
			firstOpt = i;
			break;
		}
	}

	if (firstOpt >= 0) {
		let qStart = firstOpt;
		while (qStart > 0 && (lines[qStart - 1] ?? "").trim().length > 0) {
			qStart -= 1;
		}
		const candidate = lines.slice(qStart).join("\n");
		let mcq = parseMcqBlock(candidate);
		if (mcq) {
			if (globalCorrect && (!mcq.correct || mcq.correct === mcq.options[0]?.id)) {
				if (mcq.options.some((o) => o.id === globalCorrect)) mcq.correct = globalCorrect;
			}
			const prose = stripUnrenderableComments(lines.slice(0, qStart).join("\n"));
			return { prose, mcq };
		}
	}

	return { prose: stripUnrenderableComments(markdown), mcq: null };
}

export function stripMcqFences(markdown: string): string {
	const withoutFences = markdown
		.replace(/```(?:kaiako-)?mcq[\s\S]*?(```|$)/gi, "")
		.replace(MARKED_BLOCK, "")
		.replace(/<!--\s*kaiako-mcq\s*-->[\s\S]*$/i, "");
	return stripUnrenderableComments(withoutFences);
}

export function normalizeMcqMarkdown(markdown: string): string {
	const normalized = markdown.replace(FENCE_GLOBAL, (full, raw: string) => {
		const item = parseMcqBlock(raw ?? "");
		return item ? formatMcqPrompt(item) : full;
	});
	return stripUnrenderableComments(normalized);
}

export function parseMcqBlock(raw: string): McqItem | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("{")) {
		try {
			return normalizeMcq(JSON.parse(trimmed) as Record<string, unknown>);
		} catch {
			/* fall through */
		}
	}
	const clean = parseCleanMarkdown(trimmed);
	if (clean) return clean;
	return parseMcqLines(trimmed);
}

function parseCleanMarkdown(raw: string): McqItem | null {
	const lines = raw.split("\n");
	const stemLines: string[] = [];
	const options: McqOption[] = [];
	let currentOption: McqOption | null = null;
	let correct = "";
	let difficulty = 0;
	let id = `q-${Date.now()}`;

	for (let i = 0; i < lines.length; i += 1) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;

		// Check correct answer marker
		const cMatch = line.match(GLOBAL_CORRECT);
		if (cMatch) {
			let cid = (cMatch[1] || cMatch[2] || "").toLowerCase();
			if (cid === "1") cid = "a";
			else if (cid === "2") cid = "b";
			else if (cid === "3") cid = "c";
			else if (cid === "4") cid = "d";
			if (cid) correct = cid;
			continue;
		}

		// Check YAML metadata: id, difficulty, stem/question
		const diffMatch = line.match(/^(?:difficulty|item_difficulty)\s*:\s*([+-]?\d+(?:\.\d+)?)/i);
		if (diffMatch?.[1] && options.length === 0) {
			difficulty = parseFloat(diffMatch[1]);
			continue;
		}
		const idMatch = line.match(/^id\s*:\s*(\S+)/i);
		if (idMatch?.[1] && options.length === 0) {
			id = idMatch[1];
			continue;
		}
		const yamlStemMatch = line.match(/^(?:stem|question)\s*:\s*(.+)$/i);
		if (yamlStemMatch?.[1] && options.length === 0) {
			stemLines.push(yamlStemMatch[1]);
			continue;
		}

		// Check option
		const opt = matchOptionLine(line);
		if (opt) {
			currentOption = opt;
			options.push(opt);
			continue;
		}

		if (options.length === 0) {
			// Lines before options belong to stem
			stemLines.push(line);
		} else if (currentOption) {
			// Continuation line for current option
			currentOption.text += ` ${line}`;
		}
	}

	if (options.length < 2) return null;

	const rawStem = stemLines.join(" ").trim();
	const stem = cleanStemText(rawStem) || "Select the correct option:";
	if (!correct || !options.some((o) => o.id === correct)) {
		correct = options[0]?.id || "a";
	}

	return normalizeMcq({
		id,
		difficulty,
		stem,
		options,
		correct,
	});
}

function parseMcqLines(raw: string): McqItem | null {
	const data: Record<string, string> = {};
	const options: McqOption[] = [];
	const questionLines: string[] = [];
	let foldingQuestion = false;
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		if (foldingQuestion) {
			if (/^(?:options|answer|correct|rationale)\s*:/i.test(trimmed) || /^-?\s*[a-dA-D]\s*[:).=-]\s+/i.test(trimmed)) {
				foldingQuestion = false;
			} else {
				questionLines.push(trimmed);
				continue;
			}
		}
		const question = trimmed.match(/^question\s*:\s*(.*)$/i);
		if (question?.[1]) {
			const value = question[1].trim();
			if (/^(?:>-?|\|[-+]?)$/.test(value)) foldingQuestion = true;
			else data.question = value;
			continue;
		}
		const option = matchOptionLine(trimmed);
		if (option) {
			options.push(option);
			continue;
		}
		const kv = trimmed.match(/^([A-Za-z_]+)\s*:\s*(.+)$/);
		if (kv?.[1] && kv[2]) data[kv[1].toLowerCase()] = kv[2].trim();
	}
	if (questionLines.length > 0) data.question = questionLines.join(" ");
	return normalizeMcq({ ...data, options });
}

function normalizeMcq(raw: Record<string, unknown>): McqItem | null {
	const stem = repairInlineMarkdown(stripUnrenderableComments(String(raw.stem ?? raw.question ?? "")).trim());
	if (!stem) return null;
	const options = normalizeOptions(raw.options);
	if (options.length < 2) return null;
	const rawCorrect = String(raw.correct ?? raw.correctAnswer ?? options[0]?.id ?? "").trim().toLowerCase();
	const correct = options.some((opt) => opt.id === rawCorrect) ? rawCorrect : options[0]?.id ?? "a";
	const difficulty = Number(raw.difficulty ?? raw.b ?? 0);
	return {
		id: String(raw.id ?? `q-${Date.now()}`),
		difficulty: Number.isFinite(difficulty) ? difficulty : 0,
		stem,
		options: options.map((option) => ({
			...option,
			text: repairInlineMarkdown(stripUnrenderableComments(option.text)),
		})),
		correct,
	};
}

function repairInlineMarkdown(text: string): string {
	const markers = text.match(/\*\*/g)?.length ?? 0;
	return markers % 2 === 0 ? text : text.replace(/\*\*/g, "");
}

function normalizeOptions(value: unknown): McqOption[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item, index) => {
			if (typeof item === "string") {
				return { id: String.fromCharCode(97 + index), text: item };
			}
			if (item && typeof item === "object") {
				const rec = item as Record<string, unknown>;
				const text = String(rec.text ?? rec.label ?? rec.value ?? "").trim();
				if (!text) return null;
				return {
					id: String(rec.id ?? rec.value ?? String.fromCharCode(97 + index)).toLowerCase(),
					text,
				};
			}
			return null;
		})
		.filter((item): item is McqOption => item !== null);
}

export function formatMcqPrompt(item: McqItem): string {
	const lines = ["<!-- kaiako-mcq -->", `**Question:** ${item.stem}`, ""];
	for (const option of item.options) lines.push(`- ${option.id.toUpperCase()}. ${option.text}`);
	lines.push("", `<!-- correct: ${item.correct.toUpperCase()} -->`, "<!-- /kaiako-mcq -->");
	return lines.join("\n");
}

export function formatMcqQuestion(item: McqItem): string {
	const stem = item.stem.trim();
	return /^Question:\s*/i.test(stem) ? stem : `Question: ${stem}`;
}

export function formatMcqResult(item: McqItem, correct: boolean): string {
	const answer = item.options.find((option) => option.id === item.correct);
	const correctAnswer = answer ? `${answer.id.toUpperCase()}. ${answer.text}` : item.correct.toUpperCase();
	return [
		`Result: ${correct ? "Correct" : "Incorrect"}`,
		"",
		`Correct answer: ${correctAnswer}`,
	].join("\n");
}

export function formatMcqRecord(item: McqItem, _chosen: string, _dontKnow: boolean, correct: boolean): string {
	return [
		formatMcqQuestion(item),
		"",
		formatMcqResult(item, correct),
	].join("\n");
}

export function normalizeMcqSpacing(markdown: string): string {
	if (!markdown) return "";
	return markdown
		.replace(/([^\n])\n\s*(?:#{1,6}\s*)?(?:\*\*)?Question(?:\*\*)?:?(?:\*\*)?\s+/gi, "$1\n\nQuestion: ")
		.replace(/([^\n])\n\s*(?:\*\*)?Result:\s*/gi, "$1\n\nResult: ")
		.replace(/([^\n])\n\s*(?:\*\*)?Correct answer:\s*/gi, "$1\n\nCorrect answer: ");
}

/**
 * Deduplicates any consecutive duplicate Question lines in markdown
 * and ensures clean double-newline spacing between questions, results, and answers.
 */
export function deduplicateQuestions(markdown: string): string {
	if (!markdown) return "";
	const normalized = normalizeMcqSpacing(markdown);
	return normalized.replace(
		/((?:^|\n+)\s*(?:#{1,6}\s*)?(?:\*\*)?Question(?:\*\*)?:?(?:\*\*)?[^\n]+)(\s*\n+\s*(?:#{1,6}\s*)?(?:\*\*)?Question(?:\*\*)?:?(?:\*\*)?[^\n]+)+/gi,
		(full) => {
			const prefixMatch = full.match(/^\n+/);
			const prefix = prefixMatch ? prefixMatch[0] : "";
			const lines = full.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
			const seen = new Set<string>();
			const unique: string[] = [];
			for (const line of lines) {
				const norm = line
					.replace(/^\s*(?:#{1,6}\s*)?(?:\*\*)?Question(?:\*\*)?:?(?:\*\*)?\s*/i, "")
					.replace(/\s+/g, " ")
					.trim()
					.toLowerCase();
				if (!seen.has(norm)) {
					seen.add(norm);
					unique.push(line);
				}
			}
			return prefix + unique.join("\n\n");
		},
	);
}
