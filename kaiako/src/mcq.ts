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

export function splitMcq(markdown: string): { prose: string; mcq: McqItem | null } {
	const match = markdown.match(FENCE);
	if (!match) return { prose: markdown.trim(), mcq: null };
	const mcq = parseMcqBlock(match[1] ?? "");
	const prose = markdown.replace(FENCE, "").trim();
	return { prose, mcq };
}

export function stripMcqFences(markdown: string): string {
	return markdown.replace(/```kaiako-mcq[\s\S]*?(```|$)/gi, "").trim();
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
	return parseMcqLines(trimmed);
}

function parseMcqLines(raw: string): McqItem | null {
	const data: Record<string, string> = {};
	const options: McqOption[] = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const option = trimmed.match(/^(?:-\s*)?(?:option\s+)?([a-dA-D])\s*[:).=-]\s*(.+)$/);
		if (option?.[1] && option[2]) {
			options.push({ id: option[1].toLowerCase(), text: option[2].trim() });
			continue;
		}
		const kv = trimmed.match(/^([A-Za-z_]+)\s*:\s*(.+)$/);
		if (kv?.[1] && kv[2]) data[kv[1].toLowerCase()] = kv[2].trim();
	}
	return normalizeMcq({ ...data, options });
}

function normalizeMcq(raw: Record<string, unknown>): McqItem | null {
	const stem = String(raw.stem ?? raw.question ?? "").trim();
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
		options,
		correct,
	};
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

export function formatMcqRecord(item: McqItem, chosen: string, dontKnow: boolean, correct: boolean): string {
	const lines = [`**Question:** ${item.stem}`, ""];
	for (const option of item.options) {
		const mark = option.id === item.correct ? "✓" : option.id === chosen ? "✗" : " ";
		lines.push(`- ${mark} ${option.id}. ${option.text}`);
	}
	if (dontKnow) lines.push("", "_Answer: I don't know_");
	else lines.push("", `_Answer: ${chosen} · ${correct ? "correct" : "incorrect"}_`);
	return lines.join("\n");
}
