import { MarkdownRenderer, type App, type Component } from "obsidian";
import type { McqItem } from "./mcq";
import { sanitizeMathForRender } from "./math-safe";

export interface ApprovalCardOptions {
	app: App;
	sourcePath: string;
	component: Component;
	onSubmit: (chosen: string, dontKnow: boolean) => void;
}

/** Native Obsidian equivalent of the supplied ApprovalCard, scoped to one MCQ. */
export function mountApprovalCard(parent: HTMLElement, item: McqItem, options: ApprovalCardOptions): HTMLElement {
	const root = parent.createDiv({ cls: "kaiako-mcq-root" });
	const reopen = root.createEl("button", {
		cls: "kaiako-mcq-reopen",
		text: "Open question",
		attr: { type: "button", hidden: "true" },
	});
	let selected = "";
	let custom = "";
	let locked = false;

	const submit = (chosen: string, dontKnow: boolean) => {
		if (locked) return;
		const answer = chosen.trim();
		if (!dontKnow && !answer) return;
		locked = true;
		if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
			document.activeElement.blur();
		}
		options.onSubmit(answer, dontKnow);
	};

	const buildCard = () => {
		selected = "";
		custom = "";
		locked = false;
		reopen.hidden = true;

		const card = root.createDiv({ cls: "kaiako-mcq" });
		const dismiss = card.createEl("button", {
			cls: "kaiako-mcq-dismiss",
			attr: { type: "button", "aria-label": "Dismiss question" },
		});
		appendIcon(dismiss, "M18 6 6 18M6 6l12 12", 14, 2.2);

		const pad = card.createDiv({ cls: "kaiako-mcq-card-pad" });
		const question = pad.createDiv({ cls: "kaiako-mcq-question" });
		const stem = question.createDiv({ cls: "kaiako-mcq-stem" });
		void MarkdownRenderer.render(
			options.app,
			sanitizeMathForRender(item.stem),
			stem,
			options.sourcePath,
			options.component,
		);

		const list = question.createDiv({ cls: "kaiako-mcq-options" });
		const optionButtons: { button: HTMLButtonElement; id: string }[] = [];
		let answerButton: HTMLButtonElement | null = null;
		let customInput: HTMLInputElement | null = null;

		const hasAnswer = () => Boolean(selected || custom.trim());
		const sync = () => {
			for (const option of optionButtons) {
				const on = option.id === selected;
				option.button.setAttr("aria-pressed", on ? "true" : "false");
			}
			if (answerButton) answerButton.disabled = locked || !hasAnswer();
		};

		for (const option of item.options) {
			const btn = list.createEl("button", {
				cls: "kaiako-mcq-option",
				attr: { type: "button", "aria-pressed": "false" },
			});
			const indicator = btn.createSpan({ cls: "kaiako-mcq-indicator kaiako-mcq-radio" });
			indicator.createSpan({ cls: "kaiako-mcq-dot" });
			// MarkdownRenderer creates block elements such as <p>; keep them inside
			// a block container so wrapped options cannot collapse into each other.
			const body = btn.createDiv({ cls: "kaiako-mcq-text" });
			void MarkdownRenderer.render(
				options.app,
				sanitizeMathForRender(option.text),
				body,
				options.sourcePath,
				options.component,
			);
			optionButtons.push({ button: btn, id: option.id });
			options.component.registerDomEvent(btn, "click", (event: MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();
				if (locked) return;
				selected = option.id;
				custom = "";
				if (customInput) customInput.value = "";
				sync();
				submit(option.id, false);
			});
		}

		const customRow = list.createEl("label", { cls: "kaiako-mcq-custom" });
		customInput = customRow.createEl("input", {
			cls: "kaiako-mcq-custom-input",
			type: "text",
			attr: { placeholder: "Something else…", "aria-label": "Custom answer" },
		});
		options.component.registerDomEvent(customInput, "input", () => {
			if (locked || !customInput) return;
			custom = customInput.value;
			selected = "";
			sync();
		});
		options.component.registerDomEvent(customInput, "keydown", (event) => {
			if (event.key !== "Enter" || !hasAnswer()) return;
			event.preventDefault();
			submit(custom, false);
		});

		const footer = card.createDiv({ cls: "kaiako-mcq-footer" });
		const progress = footer.createDiv({ cls: "kaiako-mcq-progress" });
		const previous = progress.createEl("button", {
			cls: "kaiako-mcq-nav",
			attr: { type: "button", "aria-label": "Previous question", disabled: "true" },
		});
		appendIcon(previous, "M18 15 12 9 6 15", 14, 1.8);
		progress.createSpan({ text: "1 / 1" });
		const next = progress.createEl("button", {
			cls: "kaiako-mcq-nav",
			attr: { type: "button", "aria-label": "Next question", disabled: "true" },
		});
		appendIcon(next, "M6 9 12 15 18 9", 14, 1.8);

		const actions = footer.createDiv({ cls: "kaiako-mcq-actions" });
		const skip = actions.createEl("button", {
			cls: "kaiako-mcq-action kaiako-mcq-skip",
			text: "Skip",
			attr: { type: "button" },
		});
		options.component.registerDomEvent(skip, "click", (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			submit("", true);
		});
		answerButton = actions.createEl("button", {
			cls: "kaiako-mcq-action kaiako-mcq-answer",
			text: "Answer",
			attr: { type: "button", disabled: "true" },
		});
		options.component.registerDomEvent(answerButton, "click", (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			submit(custom || selected, false);
		});
		sync();

		options.component.registerDomEvent(dismiss, "click", (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			card.remove();
			reopen.hidden = false;
		});
	};

	options.component.registerDomEvent(reopen, "click", (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		buildCard();
	});
	buildCard();
	return root;
}

function appendIcon(parent: HTMLElement, pathD: string, size: number, strokeWidth: number): void {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", String(strokeWidth));
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", pathD);
	svg.appendChild(path);
	parent.appendChild(svg);
}
