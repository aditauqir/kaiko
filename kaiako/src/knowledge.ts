/**
 * Rasch 1PL IRT with MAP ability estimation (normal prior).
 *
 * Rasch, G. (1960). Probabilistic models for some intelligence and
 * attainment tests. Copenhagen: Danish Institute for Educational Research.
 *
 * Lord, F. M. (1980). Applications of item response theory to practical
 * testing problems. Hillsdale, NJ: Erlbaum. (1PL / logistic form)
 *
 * MAP with θ ~ N(0, 1) keeps all-correct / all-wrong finite — unlike raw
 * MLE, which diverges (Warm, 1989, Psychometrika, discusses this class of
 * IRT ability estimators).
 *
 * CAT stop: SE(θ) threshold, the standard variable-length rule
 * (Weiss, 1982, Applied Psychological Measurement; Choi, Grady & Dodd, 2010).
 *
 * knowledge_score is 0–100 *points* on a linear map of θ (not percent correct).
 * Teaching starts below the estimated score according to the Base Jump setting.
 */

import type { BaseJumpLevel } from "./config";

export const MAX_DIAGNOSTIC_ITEMS = 10;
export const MIN_ITEMS_SE_STOP = 4;
export const SE_STOP = 0.5;
export const MIN_ITEMS_FLOOR_STOP = 3;
export const FLOOR_THETA = -1.2;
export const BASE_JUMP_OFFSET_POINTS: Record<BaseJumpLevel, number> = {
	low: 10,
	medium: 25,
	high: 40,
};
export const SCORE_CENTER = 50;
export const SCORE_POINTS_PER_LOGIT = 20;

export interface ScoredItem {
	id: string;
	stem: string;
	difficulty: number;
	correct: boolean;
	dontKnow: boolean;
	chosen: string;
}

export interface KnowledgeEstimate {
	theta: number;
	se: number;
	score: number;
	teachingEntry: number;
	accuracy: number;
	n: number;
	nCorrect: number;
	stop: boolean;
	stopReason: string;
}

export function clampDifficulty(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(-2.5, Math.min(2.5, value));
}

export function thetaToScore(theta: number): number {
	return Math.max(0, Math.min(100, Math.round(SCORE_CENTER + SCORE_POINTS_PER_LOGIT * theta)));
}

export function baseJumpOffsetPoints(level: BaseJumpLevel = "medium"): number {
	return BASE_JUMP_OFFSET_POINTS[level];
}

export function teachingEntryFromScore(score: number, baseJump: BaseJumpLevel = "medium"): number {
	return Math.max(0, score - baseJumpOffsetPoints(baseJump));
}

function raschP(theta: number, difficulty: number): number {
	const z = theta - difficulty;
	if (z > 20) return 1;
	if (z < -20) return 0;
	return 1 / (1 + Math.exp(-z));
}

/** Newton–Raphson MAP for Rasch 1PL with N(0,1) prior. */
export function estimateAbility(items: ScoredItem[], baseJump: BaseJumpLevel = "medium"): KnowledgeEstimate {
	const n = items.length;
	const nCorrect = items.filter((item) => item.correct).length;
	const accuracy = n === 0 ? 0 : nCorrect / n;

	if (n === 0) {
		return {
			theta: 0,
			se: 1,
			score: SCORE_CENTER,
			teachingEntry: teachingEntryFromScore(SCORE_CENTER, baseJump),
			accuracy: 0,
			n: 0,
			nCorrect: 0,
			stop: false,
			stopReason: "",
		};
	}

	let theta = 0;
	let info = 1;
	for (let step = 0; step < 30; step += 1) {
		let grad = -theta;
		info = 1;
		for (const item of items) {
			const p = raschP(theta, clampDifficulty(item.difficulty));
			const u = item.correct ? 1 : 0;
			grad += u - p;
			info += p * (1 - p);
		}
		const delta = grad / Math.max(info, 1e-6);
		theta += delta;
		if (Math.abs(delta) < 1e-5) break;
	}

	const se = 1 / Math.sqrt(Math.max(info, 1e-6));
	const score = thetaToScore(theta);
	const teachingEntry = teachingEntryFromScore(score, baseJump);
	const { stop, stopReason } = diagnosticStop(n, se, theta, items);

	return {
		theta,
		se,
		score,
		teachingEntry,
		accuracy,
		n,
		nCorrect,
		stop,
		stopReason,
	};
}

export function diagnosticStop(
	n: number,
	se: number,
	theta: number,
	items: ScoredItem[],
): { stop: boolean; stopReason: string } {
	if (n >= MAX_DIAGNOSTIC_ITEMS) {
		return { stop: true, stopReason: `Reached the ${MAX_DIAGNOSTIC_ITEMS}-item ceiling.` };
	}
	if (n >= MIN_ITEMS_SE_STOP && se <= SE_STOP) {
		return {
			stop: true,
			stopReason: `SE(θ)=${se.toFixed(2)} ≤ ${SE_STOP} after ${n} items (CAT standard-error rule).`,
		};
	}
	const allMiss = n >= MIN_ITEMS_FLOOR_STOP && items.every((item) => !item.correct);
	if (allMiss && theta <= FLOOR_THETA) {
		return {
			stop: true,
			stopReason: `Near-floor ability (θ=${theta.toFixed(2)}) after ${n} misses.`,
		};
	}
	return { stop: false, stopReason: "" };
}

export function suggestedNextDifficulty(theta: number, last?: ScoredItem): number {
	if (!last) return 0;
	const bump = last.correct ? 0.7 : -0.7;
	return clampDifficulty(0.6 * theta + 0.4 * (last.difficulty + bump));
}

export function formatEstimate(estimate: KnowledgeEstimate, baseJump: BaseJumpLevel = "medium"): string {
	const acc = `${estimate.nCorrect}/${estimate.n} (${Math.round(estimate.accuracy * 100)}%)`;
	const offset = baseJumpOffsetPoints(baseJump);
	return [
		`knowledge_score: ${estimate.score} points (Rasch 1PL MAP)`,
		`theta: ${estimate.theta.toFixed(3)} logits`,
		`SE: ${estimate.se.toFixed(3)}`,
		`teaching_entry: ${estimate.teachingEntry} points (${offset} below score; base jump ${baseJump})`,
		`accuracy: ${acc} (secondary; do not use as the teaching level)`,
		`items: ${estimate.n}/${MAX_DIAGNOSTIC_ITEMS}`,
		estimate.stop ? `STOP diagnostic: ${estimate.stopReason}` : "Continue diagnostic: ask exactly one more kaiako-mcq.",
	].join("\n");
}
