const WEAK = /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|test|help)\b/i;

const LABELED =
	/(?:my goal is|i want to (?:be able to|learn|understand|master|know)|teach me(?: how to)?|so that i can|goal\s*[:—-])\s+(.+)/i;

export function extractGoal(text: string): string | null {
	const trimmed = text.trim().replace(/\s+/g, " ");
	if (trimmed.length < 8) return null;

	const labeled = trimmed.match(LABELED);
	if (labeled?.[1]) {
		const goal = labeled[1].trim().replace(/[.?!]+$/, "");
		if (goal.length >= 8) return clipGoal(goal);
	}

	if (WEAK.test(trimmed) && trimmed.length < 24) return null;

	if (
		trimmed.length >= 24 &&
		/\b(learn|understand|derive|prove|solve|build|master|explain|able to)\b/i.test(trimmed)
	) {
		return clipGoal(trimmed);
	}

	return null;
}

export function hasStoredGoal(goal: string | undefined | null): boolean {
	return Boolean(goal && goal.trim().length >= 8);
}

function clipGoal(value: string): string {
	return value.slice(0, 320);
}
