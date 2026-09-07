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

const FENCE = /```kaiako-mcq\s*([\s\S]*?)```/i;
const FENCE_GLOBAL = /```kaiako-mcq\s*([\s\S]*?)```/gi;
const MARKED_BLOCK = /<!--\s*kaiako-mcq\s*-->\s*([\s\S]*?)\s*<!--\s*\/kaiako-mcq\s*-->/i;
const GLOBAL_CORRECT = /<!--\s*(?:correct|answer)\s*:\s*([a-dA-D])\s*-->/i;
const QUESTION_START = /(?:^|\n)(?:[ \t]*<!--\s*(?:correct|answer)\s*:\s*[a-dA-D]\s*-->[ \t]*\n)?\s*(?:#{1,6}\s*)?(?:\*\*)?Question:?(?:\*\*)?\s+/i;

/**
 * Strips internal control comments and markers from markdown so the result
 * is always 100% renderable in Obsidian without invisible/blank gaps or raw comments.
 * Preserves comments inside code blocks (fenced ```...``` or ~~~...~~~ or inline `...`).
 */
export function stripUnrenderableComments(markdown: string): string {
	if (!markdown) return "";
	// 1. Remove kaiako-mcq fences (both markdown code fences and HTML comment markers)
	let cleaned = markdown
		.replace(/```kaiako-mcq[\s\S]*?(```|$)/gi, "")
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

export function splitMcq(markdown: string): { prose: string; mcq: McqItem | null } {
	const globalCorrectMatch = markdown.match(GLOBAL_CORRECT);
	const globalCorrect = globalCorrectMatch?.[1]?.toLowerCase();

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
	const qMatch = markdown.match(QUESTION_START);
	if (qMatch && qMatch.index != null) {
		const matchStart = qMatch.index + (qMatch[0].startsWith("\n") ? 1 : 0);
		const candidate = markdown.slice(matchStart);
		let mcq = parseMcqBlock(candidate);
		if (mcq) {
			if (globalCorrect && (!mcq.correct || mcq.correct === mcq.options[0]?.id)) {
				if (mcq.options.some((o) => o.id === globalCorrect)) mcq.correct = globalCorrect;
			}
			const prose = stripUnrenderableComments(markdown.slice(0, matchStart));
			return { prose, mcq };
		}
	}

	return { prose: stripUnrenderableComments(markdown), mcq: null };
}

export function stripMcqFences(markdown: string): string {
	const withoutFences = markdown
		.replace(/```kaiako-mcq[\s\S]*?(```|$)/gi, "")
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
	let questionIndex = -1;
	let stem = "";
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const match = line.match(/^\s*(?:#{1,6}\s*)?(?:\*\*)?Question:?(?:\*\*)?\s*(.*)$/i);
		if (match) {
			questionIndex = index;
			stem = match[1]?.trim() ?? "";
			break;
		}
	}
	if (questionIndex === -1) return null;

	const stemLines = stem ? [stem] : [];
	const options: McqOption[] = [];
	let correct = "";
	let current: McqOption | null = null;

	// Check lines before questionIndex for correct marker placed above the question
	for (let index = 0; index < questionIndex; index += 1) {
		const line = (lines[index] ?? "").trim();
		const answer = line.match(/<!--\s*(?:correct|answer)\s*:\s*([a-d])\s*-->/i);
		if (answer?.[1]) {
			correct = answer[1].toLowerCase();
		} else {
			const visibleAnswer = line.match(/^(?:answer|correct)\s*:\s*([a-d])/i);
			if (visibleAnswer?.[1]) correct = visibleAnswer[1].toLowerCase();
		}
	}

	for (let index = questionIndex + 1; index < lines.length; index += 1) {
		const line = (lines[index] ?? "").trim();
		if (!line) continue;
		const answer = line.match(/<!--\s*(?:correct|answer)\s*:\s*([a-d])\s*-->/i);
		if (answer?.[1]) {
			correct = answer[1].toLowerCase();
			continue;
		}
		if (/^(?:answer|correct|rationale)\s*:/i.test(line)) {
			const visibleAnswer = line.match(/^(?:answer|correct)\s*:\s*([a-d])/i);
			if (visibleAnswer?.[1]) correct = visibleAnswer[1].toLowerCase();
			continue;
		}
		const option = line.match(/^\s*(?:[-*+]\s*)?(?:\*\*)?([a-d])(?:\*\*)?\s*[.)\-:]\s+(.+?)\s*$/i);
		if (option?.[1] && option[2]) {
			current = { id: option[1].toLowerCase(), text: option[2].trim() };
			options.push(current);
			continue;
		}
		if (options.length === 0) stemLines.push(line);
		else if (current) current.text = `${current.text} ${line}`.trim();
	}
	if (options.length < 2) return null;
	return normalizeMcq({ stem: stemLines.join(" ").trim(), options, correct: correct || options[0]?.id });
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
		const option = trimmed.match(/^(?:-\s*)?(?:option\s+)?([a-dA-D])\s*[:).=-]\s*(.+)$/);
		if (option?.[1] && option[2]) {
			options.push({ id: option[1].toLowerCase(), text: option[2].trim() });
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
	const correct = String(raw.correct ?? raw.correctAnswer ?? options[0]?.id ?? "").trim().toLowerCase();
	if (!options.some((opt) => opt.id === correct)) return null;
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
