import { Notice, TFile, normalizePath, type App } from "obsidian";
import { newId, type DiagnosticItemRecord, type SessionMeta, type SessionPhase } from "./config";
import type { KnowledgeEstimate } from "./knowledge";

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

export async function createSessionNote(app: App, title: string): Promise<SessionMeta> {
	const id = sessionHash();
	const safe = title.replace(/[\\/:#*?"<>|]/g, "-").trim() || "Chat";
	const path = normalizePath(`Kaiako/${safe}-${id.slice(0, 8)}.md`);
	const folder = path.split("/").slice(0, -1).join("/");
	if (folder && !app.vault.getAbstractFileByPath(folder)) {
		await app.vault.createFolder(folder);
	}
	const body = [
		"---",
		`kaiako_session: ${id}`,
		`kaiako_topic: ${JSON.stringify(title)}`,
		"kaiako_goal: \"\"",
		"kaiako_phase: need_goal",
		"kaiako_knowledge_score: null",
		"kaiako_teaching_entry: null",
		"---",
		"",
		`# ${title}`,
		"",
		`_Kaiako session \`${id.slice(0, 8)}\` · ${new Date().toLocaleString()}_`,
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
		title,
		filePath: file.path,
		createdAt: Date.now(),
		goal: "",
		phase: "need_goal",
		diagnosticItems: [],
	};
}

export async function openSessionNote(app: App, session: SessionMeta): Promise<void> {
	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (file instanceof TFile) {
		await app.workspace.getLeaf(false).openFile(file);
		return;
	}
	new Notice("That session note is no longer in the vault.");
}

export async function readSessionBody(app: App, session: SessionMeta | null): Promise<string> {
	if (!session) return "";
	const file = app.vault.getAbstractFileByPath(session.filePath);
	if (!(file instanceof TFile)) return "";
	const text = await app.vault.read(file);
	const body = text.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
	const sessionMarker = escapeRegExp(`Kaiako session \`${session.id.slice(0, 8)}\``);
	const scaffold = new RegExp(
		"^# " + escapeRegExp(session.title) + "\\s*\\n\\s*_" + sessionMarker + " · [^\\n]+_\\s*",
	);
	return body.replace(scaffold, "").trim();
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
	if ("kaiako_goal" in fields) out.goal = unquote(fields.kaiako_goal);
	const phase = fields.kaiako_phase?.trim() as SessionPhase | undefined;
	if (phase === "diagnostic" || phase === "teaching" || phase === "need_goal") out.phase = phase;
	const score = parseNullableNumber(fields.kaiako_knowledge_score);
	const theta = parseNullableNumber(fields.kaiako_knowledge_theta);
	const se = parseNullableNumber(fields.kaiako_knowledge_se);
	const entry = parseNullableNumber(fields.kaiako_teaching_entry);
	const accuracy = parseNullableNumber(fields.kaiako_accuracy);
	if (score != null) out.knowledgeScore = score;
	if (theta != null) out.knowledgeTheta = theta;
	if (se != null) out.knowledgeSe = se;
	if (entry != null) out.teachingEntry = entry;
	if (accuracy != null) out.accuracy = accuracy;
	if (fields.kaiako_diagnostic) {
		try {
			const parsed = JSON.parse(unquote(fields.kaiako_diagnostic)) as DiagnosticItemRecord[];
			if (Array.isArray(parsed)) out.diagnosticItems = parsed;
		} catch {
			/* ignore */
		}
	}
	return out;
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
