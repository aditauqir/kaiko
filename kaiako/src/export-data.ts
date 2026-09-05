import type { App } from "obsidian";
import type { KaiakoConfig, SessionMeta } from "./config";
import { readSessionBody, readSessionHarness, splitSessionTurns } from "./note-writer";

const EXPORT_HEADERS = [
	"record_type",
	"session_id",
	"topic",
	"goal",
	"phase",
	"created_at",
	"last_interaction_at",
	"active_seconds",
	"active_minutes",
	"learner_turns",
	"assistant_turns",
	"diagnostic_items",
	"correct_items",
	"diagnostic_accuracy",
	"average_item_difficulty",
	"baseline_score",
	"knowledge_score",
	"knowledge_theta",
	"knowledge_se",
	"teaching_entry_score",
	"base_jump_level",
	"all_sessions_average_score",
];

type ExportRecord = {
	session: SessionMeta;
	learnerTurns: number;
	assistantTurns: number;
	diagnosticItems: number;
	correctItems: number;
	averageItemDifficulty: number | null;
};

export async function exportKaiakoDataCsv(app: App, config: KaiakoConfig): Promise<string> {
	const records: ExportRecord[] = [];
	for (const session of config.sessions) {
		const body = await readSessionBody(app, session);
		const harness = await readSessionHarness(app, session);
		const hydrated: SessionMeta = {
			...session,
			...harness,
			id: session.id,
			filePath: session.filePath,
			title: session.title,
			createdAt: session.createdAt,
		};
		const turns = splitSessionTurns(body);
		const items = hydrated.diagnosticItems ?? [];
		const difficultyTotal = items.reduce((total, item) => total + item.difficulty, 0);
		records.push({
			session: hydrated,
			learnerTurns: turns.filter((turn) => turn.role === "user").length,
			assistantTurns: turns.filter((turn) => turn.role === "assistant").length,
			diagnosticItems: items.length,
			correctItems: items.filter((item) => item.correct).length,
			averageItemDifficulty: items.length > 0 ? difficultyTotal / items.length : null,
		});
	}

	const scored = records.map((record) => record.session.knowledgeScore).filter(isFiniteNumber);
	const theta = records.map((record) => record.session.knowledgeTheta).filter(isFiniteNumber);
	const standardErrors = records.map((record) => record.session.knowledgeSe).filter(isFiniteNumber);
	const teachingEntries = records.map((record) => record.session.teachingEntry).filter(isFiniteNumber);
	const totalItems = records.reduce((total, record) => total + record.diagnosticItems, 0);
	const totalCorrect = records.reduce((total, record) => total + record.correctItems, 0);
	const averageScore = average(scored);
	const totalActiveSeconds = records.reduce(
		(total, record) => total + finiteNonNegative(record.session.activeSeconds),
		0,
	);
	const totalLearnerTurns = records.reduce((total, record) => total + record.learnerTurns, 0);
	const totalAssistantTurns = records.reduce((total, record) => total + record.assistantTurns, 0);
	const averageDifficulty = average(
		records
			.filter((record) => record.averageItemDifficulty !== null)
			.map((record) => record.averageItemDifficulty as number),
	);

	const rows: (string | number | null)[][] = [
		EXPORT_HEADERS,
		[
			"summary",
			"ALL",
			"All sessions",
			"",
			"combined",
			"",
			"",
			totalActiveSeconds,
			totalActiveSeconds / 60,
			totalLearnerTurns,
			totalAssistantTurns,
			totalItems,
			totalCorrect,
			totalItems > 0 ? totalCorrect / totalItems : null,
			averageDifficulty,
			averageScore,
			averageScore,
			average(theta),
			average(standardErrors),
			average(teachingEntries),
			config.baseJump,
			averageScore,
		],
		...records.map((record) => sessionRow(record, config.baseJump, averageScore)),
	];

	return rows.map((row) => row.map(csvValue).join(",")).join("\r\n") + "\r\n";
}

export function triggerCsvDownload(csv: string): void {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `kaiako-learning-data-${new Date().toISOString().slice(0, 10)}.csv`;
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sessionRow(
	record: ExportRecord,
	baseJump: KaiakoConfig["baseJump"],
	averageScore: number | null,
): (string | number | null)[] {
	const session = record.session;
	const accuracy = record.diagnosticItems > 0 ? record.correctItems / record.diagnosticItems : null;
	const score = finiteNumberOrNull(session.knowledgeScore);
	return [
		"session",
		session.id,
		session.title,
		session.goal ?? "",
		session.phase ?? "",
		dateValue(session.createdAt),
		dateValue(session.lastInteractionAt),
		finiteNonNegative(session.activeSeconds),
		finiteNonNegative(session.activeSeconds) / 60,
		record.learnerTurns,
		record.assistantTurns,
		record.diagnosticItems,
		record.correctItems,
		accuracy,
		record.averageItemDifficulty,
		score,
		score,
		finiteNumberOrNull(session.knowledgeTheta),
		finiteNumberOrNull(session.knowledgeSe),
		finiteNumberOrNull(session.teachingEntry),
		baseJump,
		averageScore,
	];
}

function csvValue(value: string | number | null): string {
	if (value === null || value === undefined) return "";
	const text = typeof value === "number" ? formatNumber(value) : value;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dateValue(value: number | undefined): string {
	return isFiniteNumber(value) ? new Date(value).toISOString() : "";
}

function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function finiteNumberOrNull(value: number | undefined): number | null {
	return isFiniteNumber(value) ? value : null;
}

function finiteNonNegative(value: number | undefined): number {
	return isFiniteNumber(value) && value >= 0 ? value : 0;
}

function isFiniteNumber(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
