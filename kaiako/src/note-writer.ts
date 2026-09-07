import { Notice, TFile, normalizePath, type App } from "obsidian";
import { limitTopicWords, newId, type DiagnosticItemRecord, type SessionMeta, type SessionPhase } from "./config";
import type { KnowledgeEstimate } from "./knowledge";
import { parseMcqBlock, type McqItem } from "./mcq";

export function sessionHash(): string {
	return newId();
}

export type SessionTurn = {
	role: "user" | "assistant";
	markdown: string;
};

/** Split a session note body into user / assistant turns (`**You:**` markers). */
export function splitSessionTurns(body: string): SessionTurn[] {
	const trimmed = body.trim();
	if (!trimmed) return [];
	const turns: SessionTurn[] = [];
	const blocks = trimmed.split(/\n\n(?=\*\*You:\*\*)/);
	for (const block of blocks) {
		const text = block.trim();
		if (!text) continue;
		if (text.startsWith("**You:**")) {
			const splitAt = text.indexOf("\n\n");
			if (splitAt === -1) {
				turns.push({ role: "user", markdown: text });
			} else {
				turns.push({ role: "user", markdown: text.slice(0, splitAt).trim() });
				const rest = text.slice(splitAt + 2).trim();
				if (rest) turns.push({ role: "assistant", markdown: rest });
			}
		} else {
			turns.push({ role: "assistant", markdown: text });
		}
	}
	return turns;
}

export function stripYouPrefix(markdown: string): string {
	return markdown.replace(/^\*\*You:\*\*\s*/i, "").trim();
}

export function serializeSessionTurns(turns: SessionTurn[]): string {
	return turns.map((turn) => turn.markdown.trim()).filter(Boolean).join("\n\n");
}

export async function replaceSessionTurns(
	app: App,
	session: SessionMeta,
	turns: SessionTurn[],
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) {
		new Notice("Session note is missing from the vault.");
		return;
	}
	const nextBody = serializeSessionTurns(turns);
	await app.vault.process(file, (data) => {
		const fmMatch = data.match(/^---\n[\s\S]*?\n---\n/);
		const front = fmMatch ? fmMatch[0] : "";
		const afterFm = fmMatch ? data.slice(fmMatch[0].length) : data;
		const headerMatch = afterFm.match(/^(# [^\n]+\n\n_Kaiako session(?: `[^`]+`)? · [^\n]+_\n*)/);
		const rawHeader = headerMatch?.[1] ?? "";
		const header = rawHeader
			.replace(/^# ([^\n]+)-[a-f0-9]{8}(?=\n)/m, "# $1")
			.replace(/\n+$/, "\n\n");
		const body = nextBody ? `${nextBody}\n` : "";
		return `${front}${header}${body}`;
	});
}

export async function appendToSession(
	app: App,
	session: SessionMeta | null,
	markdown: string,
): Promise<TFile | null> {
	if (!session) {
		new Notice("Start a chat first.");
		return null;
	}
	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) {
		new Notice("Session note is missing from the vault.");
		return null;
	}
	await app.vault.process(file, (data) => {
		const sep = data.trim().length > 0 ? "\n\n" : "";
		return data + sep + markdown;
	});
	if (app.workspace.getActiveFile()?.path !== file.path) {
		await app.workspace.getLeaf(false).openFile(file);
	}
	return file;
}

const HASH_SUFFIX_REGEX = /^(.*)-[a-f0-9]{8}\.md$/i;

export function generateUniqueNotePath(app: App, title: string, excludePath?: string): string {
	const topic = limitTopicWords(title);
	const safe = topic.replace(/[\\/:#*?"<>|]/g, "-").trim() || "Chat";
	const basePath = normalizePath(`Kaiako/${safe}.md`);
	const existing = app.vault.getAbstractFileByPath(basePath);
	if (!existing || (excludePath && existing.path === excludePath)) {
		return basePath;
	}
	let index = 2;
	while (true) {
		const candidate = normalizePath(`Kaiako/${safe} ${index}.md`);
		const found = app.vault.getAbstractFileByPath(candidate);
		if (!found || (excludePath && found.path === excludePath)) {
			return candidate;
		}
		index++;
	}
}

export async function createSessionNote(app: App, title: string): Promise<SessionMeta> {
	const id = sessionHash();
	const topic = limitTopicWords(title);
	const path = generateUniqueNotePath(app, topic);
	const folder = path.split("/").slice(0, -1).join("/");
	if (folder && !app.vault.getAbstractFileByPath(folder)) {
		await app.vault.createFolder(folder);
	}
	const body = [
		"---",
		`kaiako_session: ${id}`,
		`kaiako_topic: ${JSON.stringify(topic)}`,
		"kaiako_topic_generated: false",
		`cssclasses: ${JSON.stringify(["kaiako-session"])}`,
		"kaiako_goal: \"\"",
		"kaiako_phase: need_goal",
		"kaiako_knowledge_score: null",
		"kaiako_teaching_entry: null",
		"kaiako_active_seconds: 0",
		"kaiako_last_interaction_at: null",
		"kaiako_pending_mcq: null",
		"---",
		"",
		`# ${topic}`,
		"",
		`_Kaiako session · ${new Date().toLocaleString()}_`,
		"",
	].join("\n");

	let file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		file = await app.vault.create(path, body);
	}
	if (!(file instanceof TFile)) {
		throw new Error("Could not create session note");
	}
	await app.workspace.getLeaf(false).openFile(file);
	return {
		id,
		title: topic,
		topicGenerated: false,
		filePath: file.path,
		createdAt: Date.now(),
		goal: "",
		phase: "need_goal",
		diagnosticItems: [],
		activeSeconds: 0,
	};
}

export async function openSessionNote(app: App, session: SessionMeta): Promise<void> {
	let file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) {
		const match = session.filePath.match(HASH_SUFFIX_REGEX);
		const base = match?.[1];
		if (base) {
			const cleanCandidate = normalizePath(`${base}.md`);
			const altFile = app.vault.getAbstractFileByPath(cleanCandidate);
			if (altFile instanceof TFile) {
				file = altFile;
			}
		}
	}
	if (file instanceof TFile) {
		await ensureKaiakoSessionClass(app, file);
		await app.workspace.getLeaf(false).openFile(file);
		return;
	}
	new Notice("That session note is no longer in the vault.");
}

export async function readSessionBody(app: App, session: SessionMeta | null): Promise<string> {
	if (!session) return "";
	let file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) {
		const match = session.filePath.match(HASH_SUFFIX_REGEX);
		const base = match?.[1];
		if (base) {
			const cleanCandidate = normalizePath(`${base}.md`);
			const altFile = app.vault.getAbstractFileByPath(cleanCandidate);
			if (altFile instanceof TFile) {
				file = altFile;
			}
		}
	}
	if (!(file instanceof TFile)) return "";
	await ensureKaiakoSessionClass(app, file);
	const text = await app.vault.read(file);
	const body = text.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
	const sessionMarker = escapeRegExp(`Kaiako session \`${session.id.slice(0, 8)}\``);
	const scaffold = new RegExp(
		"^# [^\\n]+\\s*\\n\\s*(?:_" + sessionMarker + " · [^\\n]+_|_Kaiako session · [^\\n]+_|_Kaiako session[^\\n]*_)?\\s*",
		"i",
	);
	return body.replace(scaffold, "").trim();
}

async function ensureKaiakoSessionClass(app: App, file: TFile): Promise<void> {
	const text = await app.vault.read(file);
	const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
	if (!frontmatter) return;
	const existing = frontmatter[1] ?? "";
	const cssLine = existing.match(/^cssclasses:\s*(.*)$/m);
	if (cssLine?.[1]?.includes("kaiako-session")) return;
	await app.vault.process(file, (data) => {
		const match = data.match(/^---\n([\s\S]*?)\n---\n/);
		if (!match) return data;
		const current = match[1] ?? "";
		const currentCss = current.match(/^cssclasses:\s*(.*)$/m);
		let nextFrontmatter: string;
		if (!currentCss) {
			nextFrontmatter = `${current}\ncssclasses: ${JSON.stringify(["kaiako-session"])}`;
		} else {
			const value = currentCss[1]?.trim() ?? "";
			let classes: string[] = [];
			if (value.startsWith("[") && value.endsWith("]")) {
				try {
					const parsed = JSON.parse(value) as unknown;
					classes = Array.isArray(parsed) ? parsed.map(String) : [];
				} catch {
					classes = [];
				}
			} else {
				classes = value.split(/\s+/).filter(Boolean);
			}
			nextFrontmatter = current.replace(
				currentCss[0],
				`cssclasses: ${JSON.stringify([...classes, "kaiako-session"])}`,
			);
		}
		return `---\n${nextFrontmatter}\n---\n${data.slice(match[0].length)}`;
	});
}

export async function deleteSessionFiles(app: App, sessions: SessionMeta[]): Promise<void> {
	for (const session of sessions) {
		const file = app.vault.getAbstractFileByPath(session.filePath);
		if (file instanceof TFile) {
			await app.vault.trash(file, true);
		}
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseFrontmatter(text: string): Record<string, string> {
	const match = text.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match?.[1]) return {};
	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
		if (!kv?.[1]) continue;
		fields[kv[1]] = kv[2] ?? "";
	}
	return fields;
}

export function harnessFromFrontmatter(fields: Record<string, string>): Partial<SessionMeta> {
	const out: Partial<SessionMeta> = {};
	const topicGenerated = parseBoolean(fields.kaiako_topic_generated);
	if (topicGenerated != null) out.topicGenerated = topicGenerated;
	if ("kaiako_goal" in fields) out.goal = unquote(fields.kaiako_goal);
	const phase = fields.kaiako_phase?.trim() as SessionPhase | undefined;
	if (phase === "diagnostic" || phase === "teaching" || phase === "need_goal") out.phase = phase;
	const score = parseNullableNumber(fields.kaiako_knowledge_score);
	const theta = parseNullableNumber(fields.kaiako_knowledge_theta);
	const se = parseNullableNumber(fields.kaiako_knowledge_se);
	const entry = parseNullableNumber(fields.kaiako_teaching_entry);
	const accuracy = parseNullableNumber(fields.kaiako_accuracy);
	const activeSeconds = parseNullableNumber(fields.kaiako_active_seconds);
	const lastInteractionAt = parseNullableNumber(fields.kaiako_last_interaction_at);
	const pendingMcq = parsePendingMcq(fields.kaiako_pending_mcq);
	if (score != null) out.knowledgeScore = score;
	if (theta != null) out.knowledgeTheta = theta;
	if (se != null) out.knowledgeSe = se;
	if (entry != null) out.teachingEntry = entry;
	if (accuracy != null) out.accuracy = accuracy;
	if (activeSeconds != null && activeSeconds >= 0) out.activeSeconds = activeSeconds;
	if (lastInteractionAt != null && lastInteractionAt > 0) out.lastInteractionAt = lastInteractionAt;
	if (pendingMcq) out.pendingMcq = pendingMcq;
	if (fields.kaiako_diagnostic) {
		try {
			const parsed = JSON.parse(unquote(fields.kaiako_diagnostic)) as DiagnosticItemRecord[];
			if (Array.isArray(parsed)) out.diagnosticItems = parsed;
		} catch {
			/* ignore */
		}
	}
	if (fields.kaiako_liked) {
		try {
			const parsed = JSON.parse(unquote(fields.kaiako_liked)) as number[];
			if (Array.isArray(parsed)) {
				out.likedTurns = parsed.filter((item) => Number.isInteger(item) && item >= 0);
			}
		} catch {
			/* ignore */
		}
	}
	return out;
}

export async function updateSessionTopic(
	app: App,
	session: SessionMeta,
	title: string,
): Promise<string | null> {
	let file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) {
		const match = session.filePath.match(HASH_SUFFIX_REGEX);
		const base = match?.[1];
		if (base) {
			const cleanCandidate = normalizePath(`${base}.md`);
			const altFile = app.vault.getAbstractFileByPath(cleanCandidate);
			if (altFile instanceof TFile) {
				file = altFile;
			}
		}
	}
	if (!(file instanceof TFile)) return null;

	const topic = limitTopicWords(title);
	await app.vault.process(file, (data) => {
		const withFrontmatter = data.replace(
			/^kaiako_topic:\s*.*$/m,
			`kaiako_topic: ${JSON.stringify(topic)}`,
		);
		const withCleanScaffold = withFrontmatter.replace(
			/^# [^\n]+(?=\n\n_Kaiako session(?: `[^`]+`)? · )/m,
			`# ${topic}`,
		);
		return withCleanScaffold.replace(/^# ([^\n]+)-[a-f0-9]{8}(?=\n)/m, "# $1");
	});

	const newPath = generateUniqueNotePath(app, topic, file.path);
	if (newPath !== file.path) {
		try {
			await app.vault.rename(file, newPath);
			return newPath;
		} catch (e) {
			console.error("Failed to rename session note on topic update:", e);
		}
	}
	return file.path;
}

export async function normalizeSessionNotePath(
	app: App,
	session: SessionMeta,
): Promise<SessionMeta> {
	const match = session.filePath.match(HASH_SUFFIX_REGEX);
	const base = match?.[1];
	if (!base) return session;

	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) {
		const cleanCandidate = normalizePath(`${base}.md`);
		const altFile = app.vault.getAbstractFileByPath(cleanCandidate);
		if (altFile instanceof TFile) {
			const cleanTitle = session.title.replace(/-[a-f0-9]{8}$/i, "");
			return { ...session, title: cleanTitle, filePath: altFile.path };
		}
		return session;
	}

	const rawBase = base.split("/").pop() || session.title;
	const candidateTitle =
		session.topicGenerated && session.title && !session.title.match(/-[a-f0-9]{8}$/i)
			? session.title
			: rawBase;

	const targetPath = generateUniqueNotePath(app, candidateTitle, file.path);
	let nextPath = file.path;
	if (targetPath !== file.path) {
		try {
			await app.vault.rename(file, targetPath);
			nextPath = targetPath;
		} catch (e) {
			console.error("Failed to rename session note during normalization:", e);
		}
	}

	try {
		await app.vault.process(file, (data) => {
			return data.replace(/^# ([^\n]+)-[a-f0-9]{8}(?=\n)/m, "# $1");
		});
	} catch {
		/* ignore */
	}

	const cleanTitle = session.title.replace(/-[a-f0-9]{8}$/i, "");
	return {
		...session,
		title: cleanTitle,
		filePath: nextPath,
	};
}

export async function readSessionHarness(app: App, session: SessionMeta | null): Promise<Partial<SessionMeta>> {
	if (!session) return {};
	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) return {};
	return harnessFromFrontmatter(parseFrontmatter(await app.vault.read(file)));
}

export async function patchSessionFrontmatter(
	app: App,
	session: SessionMeta | null,
	fields: Record<string, string | number | boolean | null>,
): Promise<void> {
	if (!session) return;
	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) return;
	await app.vault.process(file, (data) => {
		const match = data.match(/^---\n([\s\S]*?)\n---\n/);
		const map = new Map<string, string>();
		if (match?.[1]) {
			for (const line of match[1].split("\n")) {
				const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
				if (kv?.[1]) map.set(kv[1], kv[2] ?? "");
			}
		}
		for (const [key, value] of Object.entries(fields)) {
			map.set(key, yamlScalar(value));
		}
		const yaml = [...map.entries()].map(([key, value]) => `${key}: ${value}`).join("\n");
		const rest = match ? data.slice(match[0].length) : data;
		return `---\n${yaml}\n---\n${rest}`;
	});
}

export async function persistHarnessState(
	app: App,
	session: SessionMeta,
	state: {
		goal?: string;
		phase?: SessionPhase;
		estimate?: KnowledgeEstimate | null;
		items?: DiagnosticItemRecord[];
	},
): Promise<SessionMeta> {
	const estimate = state.estimate;
	const next: SessionMeta = {
		...session,
		goal: state.goal ?? session.goal,
		phase: state.phase ?? session.phase,
		diagnosticItems: state.items ?? session.diagnosticItems,
		knowledgeScore: estimate?.score ?? session.knowledgeScore,
		knowledgeTheta: estimate ? Number(estimate.theta.toFixed(4)) : session.knowledgeTheta,
		knowledgeSe: estimate ? Number(estimate.se.toFixed(4)) : session.knowledgeSe,
		teachingEntry: estimate?.teachingEntry ?? session.teachingEntry,
		accuracy: estimate ? Number(estimate.accuracy.toFixed(4)) : session.accuracy,
	};
	await patchSessionFrontmatter(app, next, {
		kaiako_goal: next.goal?.trim() ? JSON.stringify(next.goal.trim()) : '""',
		kaiako_phase: next.phase ?? "need_goal",
		kaiako_knowledge_score: next.knowledgeScore ?? null,
		kaiako_knowledge_theta: next.knowledgeTheta ?? null,
		kaiako_knowledge_se: next.knowledgeSe ?? null,
		kaiako_teaching_entry: next.teachingEntry ?? null,
		kaiako_accuracy: next.accuracy ?? null,
		kaiako_diagnostic_n: next.diagnosticItems?.length ?? 0,
		kaiako_diagnostic: JSON.stringify(next.diagnosticItems ?? []),
	});
	return next;
}

function yamlScalar(value: string | number | boolean | null): string {
	if (value === null) return "null";
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
	if (typeof value === "boolean") return value ? "true" : "false";
	if (value.startsWith('"') || value.startsWith("[") || value.startsWith("{")) return value;
	return JSON.stringify(value);
}

function unquote(value: string | undefined): string {
	if (!value) return "";
	const trimmed = value.trim();
	if (trimmed === "null" || trimmed === '""') return "";
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		try {
			return JSON.parse(trimmed) as string;
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	return trimmed;
}

function parseNullableNumber(value: string | undefined): number | null {
	if (!value || value.trim() === "null") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function parsePendingMcq(value: string | undefined): McqItem | null {
	if (!value || value.trim() === "null") return null;
	try {
		const parsed = JSON.parse(unquote(value)) as Record<string, unknown>;
		return parseMcqBlock(JSON.stringify(parsed));
	} catch {
		return null;
	}
}

function parseBoolean(value: string | undefined): boolean | null {
	if (!value) return null;
	if (value.trim().toLowerCase() === "true") return true;
	if (value.trim().toLowerCase() === "false") return false;
	return null;
}
