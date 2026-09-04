import { type Component } from "obsidian";
import { mountThinkingOrb, type OrbState, type ThinkingOrbHandle } from "./thinking-orb";

export interface PromptBarHandlers {
	onSend: (text: string) => void;
}

export interface PromptBarHandle {
	setInternetActive: (on: boolean) => void;
	setOrb: (state: OrbState | null) => void;
}

export function mountPromptBar(
	host: Component,
	parent: HTMLElement,
	handlers: PromptBarHandlers,
): PromptBarHandle {
	parent.empty();
	parent.addClass("kaiako-promptbar");
	parent.setAttr("data-promptbar", "true");

	const orb: ThinkingOrbHandle = mountThinkingOrb(parent);

	const composer = parent.createDiv({ cls: "kaiako-prompt-composer" });
	const controls = composer.createDiv({ cls: "kaiako-prompt-controls" });
	const internetBtn = svgIconButton(controls, "Internet in use", globePath, "kaiako-internet-btn");
	internetBtn.addClass("kaiako-status-btn");
	internetBtn.disabled = true;

	const input = controls.createEl("textarea", {
		cls: "kaiako-prompt-input",
		attr: { rows: "1", placeholder: "Write a message...", "aria-label": "Prompt" },
	});

	const sendBtn = svgIconButton(controls, "Send", uploadPath, "kaiako-prompt-send");
	sendBtn.addClass("kaiako-prompt-send");

	let draft = "";

	const syncSend = () => {
		const canSend = draft.trim().length > 0;
		sendBtn.toggleClass("is-ready", canSend);
		sendBtn.disabled = !canSend;
	};

	const resize = () => {
		input.style.height = "auto";
		const chat = parent.closest<HTMLElement>(".kaiako-chat");
		const maxHeight = Math.min(144, Math.max(72, Math.floor((chat?.clientHeight ?? window.innerHeight) * 0.32)));
		const naturalHeight = input.scrollHeight;
		const next = Math.min(Math.max(naturalHeight, 28), maxHeight);
		input.style.height = `${next}px`;
		input.style.overflowY = naturalHeight > maxHeight ? "auto" : "hidden";
		composer.toggleClass("is-expanded", naturalHeight > 36);
	};

	const send = () => {
		const text = draft.trim();
		if (!text) return;
		handlers.onSend(text);
		draft = "";
		input.value = "";
		syncSend();
		resize();
	};

	host.registerDomEvent(input, "input", () => {
		draft = input.value;
		syncSend();
		resize();
	});
	host.registerDomEvent(input, "keydown", (event) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			send();
		}
	});
	host.registerDomEvent(sendBtn, "click", () => send());

	syncSend();
	resize();

	return {
		setInternetActive: (on) => internetBtn.toggleClass("is-live", on),
		setOrb: (state) => orb.setState(state),
	};
}

function svgIconButton(parent: HTMLElement, label: string, pathD: string, className: string): HTMLButtonElement {
	const btn = parent.createEl("button", {
		cls: `kaiako-prompt-icon ${className}`,
		attr: { type: "button", "aria-label": label },
	});
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("fill", "none");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("stroke-width", "1.5");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("class", "size-6 kaiako-custom-icon");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", pathD);
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", "currentColor");
	path.setAttribute("stroke-width", "1.5");
	path.setAttribute("vector-effect", "non-scaling-stroke");
	path.setAttribute("stroke-linecap", "round");
	path.setAttribute("stroke-linejoin", "round");
	svg.appendChild(path);
	btn.appendChild(svg);
	return btn;
}

const globePath =
	"M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418";

const uploadPath = "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18";
