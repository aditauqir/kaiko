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

export function splitMcq(markdown: string): { prose: string; mcq: McqItem | null } {
	const match = markdown.match(FENCE);
	if (match) {
		const mcq = parseMcqBlock(match[1] ?? "");
		return { prose: markdown.replace(FENCE, "").trim(), mcq };
	}
	const marked = markdown.match(MARKED_BLOCK);
	if (!marked) return { prose: markdown.trim(), mcq: null };
	const mcq = parseMcqBlock(marked[1] ?? "");
	return { prose: markdown.replace(MARKED_BLOCK, "").trim(), mcq };
}

export function stripMcqFences(markdown: string): string {
	return markdown
		.replace(/```kaiako-mcq[\s\S]*?(```|$)/gi, "")
		.replace(MARKED_BLOCK, "")
		.replace(/<!--\s*kaiako-mcq\s*-->[\s\S]*$/i, "")
		.trim();
}

export function normalizeMcqMarkdown(markdown: string): string {
	return markdown.replace(FENCE_GLOBAL, (full, raw: string) => {
		const item = parseMcqBlock(raw ?? "");
		return item ? formatMcqPrompt(item) : full;
	});
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
	const stem = repairInlineMarkdown(String(raw.stem ?? raw.question ?? "").trim());
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
		options: options.map((option) => ({ ...option, text: repairInlineMarkdown(option.text) })),
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
	return `Question: ${item.stem}`;
}

export function formatMcqRecord(item: McqItem, _chosen: string, _dontKnow: boolean, correct: boolean): string {
	const answer = item.options.find((option) => option.id === item.correct);
	const correctAnswer = answer ? `${answer.id.toUpperCase()}. ${answer.text}` : item.correct.toUpperCase();
	return [
		formatMcqQuestion(item),
		"",
		`Result: ${correct ? "Correct" : "Incorrect"}`,
		`Correct answer: ${correctAnswer}`,
	].join("\n");
}
