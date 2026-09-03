import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { appendToMarkdown, isImageFile } from "./note-writer";

export const VIEW_TYPE_DEMO_SIDECHAT = "demo-sidechat-view";

export class DemoChatView extends ItemView {
	private messagesEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private fileInputEl!: HTMLInputElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_DEMO_SIDECHAT;
	}

	getDisplayText(): string {
		return "Demo chat";
	}

	getIcon(): string {
		return "message-square";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("demo-sidechat");

		this.messagesEl = root.createDiv({ cls: "demo-sidechat__messages" });
		this.renderEmptyState();

		const composer = root.createDiv({ cls: "demo-sidechat__composer" });
		this.inputEl = composer.createEl("textarea", {
			cls: "demo-sidechat__input",
			attr: {
				placeholder: "Type something, then Send or Upload…",
				rows: "3",
			},
		});

		this.fileInputEl = composer.createEl("input", {
			cls: "demo-sidechat__file",
			type: "file",
			attr: { multiple: "true" },
		});

		const actions = composer.createDiv({ cls: "demo-sidechat__actions" });
		const uploadBtn = actions.createEl("button", {
			cls: "demo-sidechat__btn",
			text: "Upload",
		});
		const sendBtn = actions.createEl("button", {
			cls: "demo-sidechat__btn mod-cta",
			text: "Send",
		});

		this.registerDomEvent(this.inputEl, "keydown", (event) => {
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				void this.sendText();
			}
		});
		this.registerDomEvent(sendBtn, "click", () => {
			void this.sendText();
		});
		this.registerDomEvent(uploadBtn, "click", () => {
			this.fileInputEl.click();
		});
		this.registerDomEvent(this.fileInputEl, "change", () => {
			void this.handleUpload();
		});
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private renderEmptyState(): void {
		this.messagesEl.empty();
		this.messagesEl.createDiv({
			cls: "demo-sidechat__empty",
			text: "Send text or upload a file. It will show up here and in the open note.",
		});
	}

	private addBubble(text: string, imageSrc?: string, imageAlt?: string): void {
		this.messagesEl.find(".demo-sidechat__empty")?.remove();
		const bubble = this.messagesEl.createDiv({ cls: "demo-sidechat__bubble" });
		bubble.createDiv({ cls: "demo-sidechat__bubble-text", text });
		if (imageSrc) {
			bubble.createEl("img", {
				cls: "demo-sidechat__preview",
				attr: { src: imageSrc, alt: imageAlt ?? "" },
			});
		}
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	private takeInput(): string {
		const text = this.inputEl.value.trim();
		this.inputEl.value = "";
		return text;
	}

	private async sendText(): Promise<void> {
		const text = this.takeInput();
		if (!text) {
			new Notice("Type something first.");
			return;
		}

		this.addBubble(text);
		await appendToMarkdown(this.app, `**You:** ${text}`);
	}

	private async handleUpload(): Promise<void> {
		const files = Array.from(this.fileInputEl.files ?? []);
		this.fileInputEl.value = "";
		if (files.length === 0) return;

		const caption = this.takeInput();

		for (const file of files) {
			const buffer = await file.arrayBuffer();
			const destPath = await this.app.fileManager.getAvailablePathForAttachment(file.name);
			const stored = await this.app.vault.createBinary(destPath, buffer);
			const embed = isImageFile(stored.name) ? `![[${stored.name}]]` : `[[${stored.name}]]`;
			const lines = [`**You uploaded:** ${stored.name}`, embed];
			if (caption) lines.unshift(`**You:** ${caption}`);

			const label = caption
				? `${caption}\nUploaded ${stored.name}`
				: `Uploaded ${stored.name}`;
			this.addBubble(
				label,
				isImageFile(stored.name) ? this.app.vault.getResourcePath(stored) : undefined,
				stored.name,
			);

			await appendToMarkdown(this.app, lines.join("\n"));
		}
	}
}
