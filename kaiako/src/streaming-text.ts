const CHARS_PER_TICK = 2;
const TICK_MS = 9;

export interface StreamRevealHandle {
	push: (chunk: string) => void;
	setText: (text: string) => void;
	finish: () => Promise<void>;
	cancel: () => void;
}

export function mountStreamReveal(
	el: HTMLElement,
	opts?: { transform?: (raw: string) => string },
): StreamRevealHandle {
	let raw = "";
	let shown = 0;
	let timer: number | null = null;
	let finishing = false;
	let resolveFinish: (() => void) | null = null;
	const transform = opts?.transform ?? ((value: string) => value);

	// Keep the live response in a paragraph, matching the StreamingText component
	// used by the chat UI while keeping this plugin's vanilla DOM architecture.
	const prose = el.createEl("p", {
		cls: "kaiako-stream-prose",
		attr: { "aria-live": "polite" },
	});
	const textEl = prose.createSpan({ cls: "kaiako-stream-text" });
	const caret = prose.createSpan({ cls: "kaiako-caret", attr: { "aria-hidden": "true" } });

	const visible = () => transform(raw);

	const paint = () => {
		textEl.setText(visible().slice(0, shown));
	};

	const tick = () => {
		const target = visible().length;
		if (shown < target) {
			shown = Math.min(target, shown + CHARS_PER_TICK);
			paint();
		}
		if (finishing && shown >= target) {
			if (timer !== null) {
				window.clearInterval(timer);
				timer = null;
			}
			caret.addClass("kaiako-caret--steady");
			prose.removeAttribute("aria-live");
			resolveFinish?.();
			resolveFinish = null;
			return;
		}
		if (!finishing && shown >= target && timer !== null) {
			window.clearInterval(timer);
			timer = null;
		}
	};

	const ensureTimer = () => {
		if (timer !== null) return;
		timer = window.setInterval(tick, TICK_MS);
	};

	return {
		push: (chunk: string) => {
			raw += chunk;
			ensureTimer();
		},
		setText: (text: string) => {
			if (text) raw = text;
			ensureTimer();
		},
		finish: () => {
			finishing = true;
			ensureTimer();
			return new Promise<void>((resolve) => {
				if (shown >= visible().length) {
					if (timer !== null) {
						window.clearInterval(timer);
						timer = null;
					}
					caret.addClass("kaiako-caret--steady");
					prose.removeAttribute("aria-live");
					resolve();
					return;
				}
				resolveFinish = resolve;
			});
		},
		cancel: () => {
			if (timer !== null) window.clearInterval(timer);
			timer = null;
			resolveFinish?.();
			resolveFinish = null;
		},
	};
}
