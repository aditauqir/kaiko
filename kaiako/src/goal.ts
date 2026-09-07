const WEAK = /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|help)\b/i;

const TEST_REQUEST =
	/^(?:can you\s+)?(?:please\s+)?(?:run\s+(?:a\s+)?)?(?:smoke\s*test|diagnostic(?:\s*test)?|test\s+my\s+knowledge|test\s+me|quiz\s+me)(?:\s+(?:on|about|for|with)\s+(.+))?$/i;

const LABELED =
	/(?:my goal is|i want to (?:be able to|learn|understand|master|know)|teach me(?: how to)?|help me (?:learn|understand|master)|so that i can|goal\s*[:—-])\s+(.+)/i;

export function extractGoal(text: string): string | null {
	const trimmed = text.trim().replace(/\s+/g, " ");
	if (trimmed.length < 2) return null;

	const testMatch = trimmed.match(TEST_REQUEST);
	if (testMatch) {
		const subject = testMatch[1]?.trim().replace(/[.?!]+$/, "");
		if (subject && subject.length >= 2) {
			return clipGoal(subject);
		}
		return "Smoke test diagnostic";
	}

	const labeled = trimmed.match(LABELED);
	if (labeled?.[1]) {
		const goal = labeled[1].trim().replace(/[.?!]+$/, "");
		if (goal.length >= 2) return clipGoal(goal);
	}

	if (WEAK.test(trimmed) && trimmed.length < 24) return null;

	if (
		trimmed.length >= 8 &&
		/\b(learn|understand|derive|prove|solve|build|master|explain|able to|study|diagnostic|smoke test|quiz)\b/i.test(trimmed)
	) {
		return clipGoal(trimmed);
	}

	return null;
}

export function hasStoredGoal(goal: string | undefined | null): boolean {
	return Boolean(goal && goal.trim().length >= 2);
}

function clipGoal(value: string): string {
	return value.slice(0, 320);
}
