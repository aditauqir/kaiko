export interface MathSpan {
	start: number;
	end: number;
	display: boolean;
	tex: string;
	raw: string;
}

export function findMathSpans(source: string): MathSpan[] {
	const spans: MathSpan[] = [];
	let i = 0;
	while (i < source.length) {
		if (source.startsWith("$$", i)) {
			const close = source.indexOf("$$", i + 2);
			if (close < 0) {
				spans.push({
					start: i,
					end: source.length,
					display: true,
					tex: source.slice(i + 2),
					raw: source.slice(i),
				});
				break;
			}
			const tex = source.slice(i + 2, close);
			spans.push({ start: i, end: close + 2, display: true, tex, raw: source.slice(i, close + 2) });
			i = close + 2;
			continue;
		}
		if (source[i] === "$" && source[i + 1] !== "$") {
			const close = source.indexOf("$", i + 1);
			if (close < 0) {
				spans.push({
					start: i,
					end: source.length,
					display: false,
					tex: source.slice(i + 1),
					raw: source.slice(i),
				});
				break;
			}
			const tex = source.slice(i + 1, close);
			spans.push({ start: i, end: close + 1, display: false, tex, raw: source.slice(i, close + 1) });
			i = close + 1;
			continue;
		}
		i += 1;
	}
	return spans;
}

export function isWellFormedTex(tex: string, opts?: { allowIncomplete?: boolean }): boolean {
	const body = tex.trim();
	if (!body) return Boolean(opts?.allowIncomplete);
	if (/[`<>]/.test(body) && /<(script|iframe|img)/i.test(body)) return false;

	let depth = 0;
	for (let i = 0; i < body.length; i += 1) {
		const ch = body[i];
		if (ch === "\\" && i + 1 < body.length) {
			i += 1;
			continue;
		}
		if (ch === "{") depth += 1;
		if (ch === "}") {
			depth -= 1;
			if (depth < 0) return false;
		}
	}
	if (depth !== 0) return Boolean(opts?.allowIncomplete);

	const begins = [...body.matchAll(/\\begin\{([a-zA-Z*]+)\}/g)].map((m) => m[1]);
	const ends = [...body.matchAll(/\\end\{([a-zA-Z*]+)\}/g)].map((m) => m[1]);
	if (begins.length !== ends.length) return Boolean(opts?.allowIncomplete);
	for (let i = 0; i < begins.length; i += 1) {
		if (begins[i] !== ends[i]) return false;
	}

	if (/\\[^a-zA-Z\s\\{},.!;:_^~'"[\]()+\-/=<>|&%#]+/.test(body)) {
		/* unknown one-char escapes are common (\,, \;, etc.); allow */
	}
	return true;
}

export function sanitizeMathForRender(markdown: string, opts?: { allowIncomplete?: boolean }): string {
	const spans = findMathSpans(markdown);
	if (spans.length === 0) return markdown;
	let out = "";
	let cursor = 0;
	for (const span of spans) {
		out += markdown.slice(cursor, span.start);
		const incomplete = span.end === markdown.length && !span.raw.endsWith("$");
		if (incomplete && opts?.allowIncomplete) {
			out += span.raw.replace(/\$/g, "\\$");
		} else if (!isWellFormedTex(span.tex, opts) || incomplete) {
			const source = span.tex.trim() || span.raw;
			out += `<span class="kaiako-math-fallback" title="${escapeAttr(source)}">couldn't render</span> \`${escapeTicks(source)}\``;
		} else {
			out += span.raw;
		}
		cursor = span.end;
	}
	out += markdown.slice(cursor);
	return out;
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeTicks(value: string): string {
	return value.replace(/`/g, "'");
}
