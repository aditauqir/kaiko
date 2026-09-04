import type { SessionMeta } from "./config";
import { extractGoal, hasStoredGoal } from "./goal";
import {
	MAX_DIAGNOSTIC_ITEMS,
	TEACHING_OFFSET_POINTS,
	formatEstimate,
	suggestedNextDifficulty,
	type KnowledgeEstimate,
	type ScoredItem,
} from "./knowledge";

export type SessionPhase = "need_goal" | "diagnostic" | "teaching";

export function resolvePhase(session: SessionMeta | null): SessionPhase {
	if (!hasStoredGoal(session?.goal)) return "need_goal";
	if (session?.phase === "teaching") return "teaching";
	return "diagnostic";
}

export function buildHarnessPrompt(
	session: SessionMeta | null,
	learnerText: string,
	opts?: { estimate?: KnowledgeEstimate | null; lastItem?: ScoredItem; mcqAnswer?: string },
): string {
	const phase = resolvePhase(session);
	const goal = session?.goal?.trim() || "(none)";
	const lines: string[] = [
		"KAIAKO HARNESS STATE (follow exactly)",
		`phase: ${phase}`,
		`target_goal: ${goal}`,
	];

	if (phase === "need_goal") {
		lines.push(
			"RULE: No target goal is stored.",
			"Ask the learner what they want to be able to do. Be direct.",
			"Do not start MCQs, teaching, explanations of the topic, or tools until a goal is captured.",
			"Do not emit a kaiako-mcq fence.",
		);
		const captured = extractGoal(learnerText);
		if (captured) {
			lines.push(`Candidate goal from this message: ${captured}`);
			lines.push("If this is a real learning goal, confirm it briefly, then start the diagnostic with one kaiako-mcq.");
		}
	} else if (phase === "diagnostic") {
		const n = session?.diagnosticItems?.length ?? 0;
		const nextB = suggestedNextDifficulty(session?.knowledgeTheta ?? 0, opts?.lastItem);
		lines.push(
			`diagnostic_items: ${n}/${MAX_DIAGNOSTIC_ITEMS}`,
			session?.knowledgeScore != null
				? `current_knowledge_score: ${session.knowledgeScore} points`
				: "current_knowledge_score: not yet estimated",
		);
		if (opts?.estimate) lines.push(formatEstimate(opts.estimate));
		if (opts?.mcqAnswer) lines.push(`Learner MCQ reply: ${opts.mcqAnswer}`);
		if (opts?.estimate?.stop) {
			lines.push(
				"Diagnostic is complete. Do not ask more diagnostic MCQs.",
				`Start teaching at ${opts.estimate.teachingEntry} points (${TEACHING_OFFSET_POINTS} points below ${opts.estimate.score}).`,
				"Present a short plan, then teach upward toward the goal.",
			);
		} else {
			lines.push(
				`Ask at most ${MAX_DIAGNOSTIC_ITEMS} diagnostic MCQs total.`,
				"Emit exactly one fenced kaiako-mcq block per turn, then STOP and wait.",
				`Suggested item difficulty b (logits): ${nextB.toFixed(2)}`,
				"Do not teach the topic yet.",
			);
		}
	} else {
		const score = session?.knowledgeScore ?? 50;
		const entry = session?.teachingEntry ?? Math.max(0, score - TEACHING_OFFSET_POINTS);
		lines.push(
			`knowledge_score: ${score} points (Rasch 1PL MAP)`,
			`teaching_entry: ${entry} points`,
			`Start instruction ${TEACHING_OFFSET_POINTS} points below the score, at ${entry} points, then build up to the goal.`,
			"Do not restart the diagnostic.",
		);
		if (opts?.mcqAnswer) lines.push(`Learner MCQ reply: ${opts.mcqAnswer}`);
	}

	lines.push("", "Learner message:", learnerText);
	return lines.join("\n");
}
