const CHARS_PER_TICK = 2;
const TICK_MS = 9;

export interface StreamRevealHandle {
	push: (chunk: string) => void;
	seedIfEmpty: (text: string) => void;
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

	const caret = el.createSpan({ cls: "kaiako-caret", attr: { "aria-hidden": "true" } });
	const textEl = el.createSpan({ cls: "kaiako-stream-text" });
	el.insertBefore(textEl, caret);

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
		seedIfEmpty: (text: string) => {
			if (!raw && text) {
				raw = text;
				ensureTimer();
			}
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
