import {
	ItemView,
	MarkdownRenderer,
	Notice,
	setIcon,
	type WorkspaceLeaf,
} from "obsidian";
import type KaiakoPlugin from "./main";
import type { KaiakoConfig, SessionMeta } from "./config";
import { appendProviderLogo, getProvider, onboardingProviders } from "./providers";
import { detectPiHarness, installPiHarness } from "./pi";
import { pickDataFolder } from "./folder";
import {
	appendToSession,
	createSessionNote,
	openSessionNote,
	persistHarnessState,
	readSessionBody,
	readSessionHarness,
	splitSessionTurns,
} from "./note-writer";
import { KaiakoSettingsModal } from "./settings-modal";
import { mountPromptBar, type PromptBarHandle } from "./prompt-bar";
import { extractGoal, hasStoredGoal } from "./goal";
import { buildHarnessPrompt, resolvePhase } from "./harness-prompt";
import { estimateAbility, type ScoredItem } from "./knowledge";
import { formatMcqRecord, splitMcq, stripMcqFences, type McqItem } from "./mcq";
import { sanitizeMathForRender } from "./math-safe";
import { mountStreamReveal, type StreamRevealHandle } from "./streaming-text";
import { orbStateForTool } from "./thinking-orb";

export const VIEW_TYPE_KAIAKO = "kaiako-view";

type Step = "provider" | "api-key" | "identity" | "setup" | "chat";

export class KaiakoView extends ItemView {
	plugin: KaiakoPlugin;
	private rootEl!: HTMLElement;
	private step: Step = "provider";
	private draftKey = "";
	private piFound = false;
	private piVersion: string | null = null;
	private piBusy = false;
	private archiveOpen = false;
	private promptBar: PromptBarHandle | null = null;
	private skippedProviders = false;
	private stream: StreamRevealHandle | null = null;
	private toolsLive = false;
	private costEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: KaiakoPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_KAIAKO;
	}

	getDisplayText(): string {
		return "Kaiako";
	}

	getIcon(): string {
		return "graduation-cap";
	}

	async onOpen(): Promise<void> {
		this.rootEl = this.contentEl;
		this.rootEl.empty();
		this.rootEl.addClass("kaiako-root");
		this.step = this.plugin.config.onboarded ? "chat" : "provider";
		await this.refreshPi();
		this.render();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	reopenOnboarding(): void {
		this.skippedProviders = false;
		this.step = "provider";
		this.archiveOpen = false;
		this.render();
	}

	private cfg(): KaiakoConfig {
		return this.plugin.config;
	}

	private async refreshPi(): Promise<void> {
		const result = await detectPiHarness();
		this.piFound = result.found;
		this.piVersion = result.version;
	}

	private async transitionTo(next: Step): Promise<void> {
		this.rootEl.addClass("kaiako-fade-out");
		await sleep(220);
		this.step = next;
		this.archiveOpen = false;
		this.render();
		this.rootEl.removeClass("kaiako-fade-out");
		this.rootEl.addClass("kaiako-fade-in");
		window.setTimeout(() => this.rootEl.removeClass("kaiako-fade-in"), 420);
	}

	private render(): void {
		this.rootEl.empty();
		const shell = this.rootEl.createDiv({
			cls: [
				"kaiako-shell",
				this.step === "chat" ? "kaiako-bg-chat" : "kaiako-bg-onboarding",
				this.step === "chat" && this.cfg().lockedIn ? "kaiako-locked" : "",
			]
				.filter(Boolean)
				.join(" "),
		});
		shell.createDiv({ cls: "kaiako-noise" });

		if (this.step === "provider") this.renderProvider(shell);
		else if (this.step === "api-key") this.renderApiKey(shell);
		else if (this.step === "identity") this.renderIdentity(shell);
		else if (this.step === "setup") void this.renderSetup(shell);
		else this.renderChat(shell);
	}

	private renderProvider(shell: HTMLElement): void {
		const panel = shell.createDiv({ cls: "kaiako-panel kaiako-panel--center" });
		panel.createEl("h1", { cls: "kaiako-brand", text: "Kaiako" });
		panel.createEl("p", {
			cls: "kaiako-sub",
			text: "Choose your API key provider",
		});

		const list = panel.createDiv({ cls: "kaiako-provider-list" });
		for (const provider of onboardingProviders()) {
			const btn = list.createEl("button", { cls: "kaiako-provider-btn" });
			appendProviderLogo(
				btn,
				this.app,
				this.plugin.manifest.dir,
				provider.id,
				`kaiako-provider-logo kaiako-provider-logo--${provider.id}`,
			);
			btn.createSpan({ cls: "kaiako-provider-label", text: provider.label });
			this.registerDomEvent(btn, "click", () => {
				this.skippedProviders = false;
				void this.plugin.saveConfig({ provider: provider.id });
				this.draftKey = "";
				void this.transitionTo("api-key");
			});
		}

		const skip = panel.createEl("button", {
			cls: "kaiako-skip",
			attr: { type: "button" },
		});
		skip.createSpan({ text: "skip this (set up later)" });
		setIcon(skip.createSpan({ cls: "kaiako-skip-arrow" }), "arrow-right");
		this.registerDomEvent(skip, "click", () => {
			this.skippedProviders = true;
			void this.transitionTo("identity");
		});
	}

	private renderApiKey(shell: HTMLElement): void {
		const provider = getProvider(this.cfg().provider);
		const panel = shell.createDiv({ cls: "kaiako-panel kaiako-panel--center" });
		panel.createEl("h1", { cls: "kaiako-brand", text: "Kaiako" });
		panel.createEl("p", {
			cls: "kaiako-sub",
			text: provider ? `${provider.label} · ${provider.hint}` : "API key",
		});

		const input = panel.createEl("input", {
			cls: "kaiako-input",
			type: "password",
			attr: {
				placeholder: "Paste API key",
				autocomplete: "off",
				spellcheck: "false",
			},
		});
		input.value = this.draftKey;

		const row = panel.createDiv({ cls: "kaiako-row" });
		const back = row.createEl("button", { cls: "kaiako-btn", text: "Back" });
		const next = row.createEl("button", { cls: "kaiako-btn kaiako-btn--primary", text: "Continue" });
		const removable = this.cfg().apiKeys.find((entry) => entry.key === this.cfg().apiKey);
		if (removable) {
			const remove = row.createEl("button", { cls: "kaiako-btn", text: "Remove key" });
			this.registerDomEvent(remove, "click", () => {
				const apiKeys = this.cfg().apiKeys.filter((entry) => entry.id !== removable.id);
				const nextActive = apiKeys[0] ?? null;
				void this.plugin.saveConfig({
					apiKeys,
					apiKey: nextActive?.key ?? "",
					provider: nextActive?.provider ?? null,
					activeModelId: nextActive?.id ?? null,
				}).then(() => {
					this.draftKey = "";
					new Notice("API key removed.");
					void this.transitionTo("provider");
				});
			});
		}

		this.registerDomEvent(input, "input", () => {
			this.draftKey = input.value;
		});
		this.registerDomEvent(back, "click", () => {
			void this.transitionTo("provider");
		});
		this.registerDomEvent(next, "click", () => {
			const key = input.value.trim();
			if (!key) {
				new Notice("Enter an API key to continue.");
				return;
			}
			this.skippedProviders = false;
			void this.plugin.saveConfig({ apiKey: key });
			void this.transitionTo("identity");
		});

		const skip = panel.createEl("button", {
			cls: "kaiako-skip",
			attr: { type: "button" },
		});
		skip.createSpan({ text: "skip this (set up later)" });
		setIcon(skip.createSpan({ cls: "kaiako-skip-arrow" }), "arrow-right");
		this.registerDomEvent(skip, "click", () => {
			this.skippedProviders = true;
			void this.transitionTo("identity");
		});
	}

	private renderIdentity(shell: HTMLElement): void {
		const panel = shell.createDiv({ cls: "kaiako-panel kaiako-panel--center" });
		panel.createEl("p", { cls: "kaiako-kicker", text: "Kaiako" });

		const hello = panel.createDiv({ cls: "kaiako-hello" });
		hello.createSpan({ text: "Hello " });
		const nameInput = hello.createEl("input", {
			cls: "kaiako-underline-field",
			type: "text",
			attr: { placeholder: " ", "aria-label": "Your name" },
		});
		nameInput.value = this.cfg().name;

		const pronouns = panel.createDiv({ cls: "kaiako-pronouns" });
		pronouns.createSpan({ text: "pronouns " });
		const sub = pronouns.createEl("input", {
			cls: "kaiako-underline-field kaiako-underline-field--sm",
			type: "text",
			attr: { placeholder: " ", "aria-label": "Subject pronoun" },
		});
		pronouns.createSpan({ text: "/" });
		const obj = pronouns.createEl("input", {
			cls: "kaiako-underline-field kaiako-underline-field--sm",
			type: "text",
			attr: { placeholder: " ", "aria-label": "Object pronoun" },
		});
		sub.value = this.cfg().pronounSubject;
		obj.value = this.cfg().pronounObject;

		const next = panel.createEl("button", {
			cls: "kaiako-btn kaiako-btn--primary kaiako-btn--spaced",
			text: "Continue",
		});

		this.registerDomEvent(next, "click", () => {
			void this.plugin.saveConfig({
				name: nameInput.value.trim(),
				pronounSubject: sub.value.trim(),
				pronounObject: obj.value.trim(),
			});
			void this.transitionTo("setup");
		});
	}

	private async renderSetup(shell: HTMLElement): Promise<void> {
		await this.refreshPi();
		const panel = shell.createDiv({ cls: "kaiako-panel kaiako-panel--center" });
		panel.createEl("h1", { cls: "kaiako-brand", text: "Kaiako" });
		panel.createEl("p", { cls: "kaiako-sub", text: "Finish setup" });

		const stack = panel.createDiv({ cls: "kaiako-setup-stack" });

		const settingsBtn = stack.createEl("button", { cls: "kaiako-setup-btn" });
		setIcon(settingsBtn.createSpan({ cls: "kaiako-setup-icon" }), "settings");
		settingsBtn.createSpan({ text: "Settings" });
		this.registerDomEvent(settingsBtn, "click", () => {
			this.openSettings();
		});

		const folderBtn = stack.createEl("button", { cls: "kaiako-setup-btn" });
		setIcon(folderBtn.createSpan({ cls: "kaiako-setup-icon" }), "folder");
		const folderLabel = folderBtn.createSpan({
			text: this.cfg().dataFolder
				? `Data folder · ${shortPath(this.cfg().dataFolder)}`
				: "Select folder to store data",
		});
		this.registerDomEvent(folderBtn, "click", () => {
			void (async () => {
				const picked = await pickDataFolder();
				if (!picked) {
					new Notice("Folder picker unavailable. You can still Save later after picking a path.");
					return;
				}
				await this.plugin.saveConfig({ dataFolder: picked });
				folderLabel.setText(`Data folder · ${shortPath(picked)}`);
			})();
		});

		const piBox = stack.createDiv({ cls: "kaiako-pi-box" });
		if (!this.piFound) {
			const installBtn = piBox.createEl("button", {
				cls: "kaiako-setup-btn",
				text: this.piBusy ? "Installing & linking…" : "Install & link harness",
			});
			piBox.createEl("p", {
				cls: "kaiako-hint",
				text: this.cfg().dataFolder
					? "Downloads and installs the Pi harness, then links it to Kaiako."
					: "Choose a data folder first, then install and link the Pi harness.",
			});
			installBtn.disabled = this.piBusy || !this.cfg().dataFolder;
			this.registerDomEvent(installBtn, "click", () => void this.installAndLinkHarness());
		} else {
			piBox.createEl("p", {
				cls: "kaiako-hint",
				text: `Pi harness found${this.piVersion ? ` · ${this.piVersion}` : ""}`,
			});
		}

		const save = panel.createEl("button", {
			cls: "kaiako-btn kaiako-btn--primary kaiako-btn--spaced",
			text: "Save",
		});
		this.registerDomEvent(save, "click", () => {
			void this.finishOnboarding();
		});
	}

	private async installAndLinkHarness(): Promise<void> {
		if (this.piBusy) return;
		if (!this.cfg().dataFolder) {
			new Notice("Choose a data folder before linking the Pi harness.");
			return;
		}
		this.piBusy = true;
		this.render();
		try {
			const detected = await installPiHarness();
			if (!detected.found) throw new Error("Pi was installed, but the pi command is not available on PATH.");
			await this.plugin.pi.linkHarness(this.cfg());
			this.piFound = true;
			this.piVersion = detected.version;
			new Notice("Pi harness installed and linked.");
		} catch (error) {
			new Notice(`Could not link Pi harness: ${error instanceof Error ? error.message : "unknown error"}`);
		} finally {
			this.piBusy = false;
			this.render();
		}
	}

	private async finishOnboarding(): Promise<void> {
		if (!this.skippedProviders && (!this.cfg().provider || !this.cfg().apiKey.trim())) {
			new Notice("API provider and key are required.");
			void this.transitionTo("provider");
			return;
		}
		if (!this.cfg().dataFolder.trim()) {
			new Notice("Choose a data folder before saving.");
			return;
		}

		let session = this.cfg().sessions[0];
		if (!session) {
			const name = this.cfg().name || "learner";
			session = await createSessionNote(this.app, `Kaiako · ${name}`);
		}

		await this.plugin.saveConfig({
			onboarded: true,
			sessions: session ? [session, ...this.cfg().sessions.filter((s) => s.id !== session!.id)] : this.cfg().sessions,
			currentSessionId: session?.id ?? null,
			apiKey: this.cfg().apiKey,
			provider: this.cfg().provider,
		});
		new Notice("Kaiako setup saved.");
		void this.transitionTo("chat");
	}

	private renderChat(shell: HTMLElement): void {
		const chat = shell.createDiv({ cls: "kaiako-chat" });
		const top = chat.createDiv({ cls: "kaiako-chat-top" });

		const settingsBtn = top.createEl("button", {
			cls: "kaiako-icon-btn",
			attr: { "aria-label": "Settings" },
		});
		setIcon(settingsBtn, "settings");
		this.registerDomEvent(settingsBtn, "click", () => this.openSettings());

		const spacer = top.createDiv({ cls: "kaiako-top-spacer" });
		void spacer;

		const archiveBtn = top.createEl("button", {
			cls: "kaiako-icon-btn",
			attr: { "aria-label": "Archive" },
		});
		setIcon(archiveBtn, "archive");
		this.registerDomEvent(archiveBtn, "click", () => {
			this.archiveOpen = !this.archiveOpen;
			this.render();
		});

		const newChatBtn = top.createEl("button", {
			cls: "kaiako-icon-btn",
			attr: { "aria-label": "Start a topic" },
		});
		setIcon(newChatBtn, "plus");
		this.registerDomEvent(newChatBtn, "click", () => {
			void this.newChat();
		});

		const lockBtn = top.createEl("button", {
			cls: `kaiako-icon-btn${this.cfg().lockedIn ? " is-active" : ""}`,
			attr: { "aria-label": "Lock in" },
		});
		setIcon(lockBtn, "coffee");
		this.registerDomEvent(lockBtn, "click", () => {
			void this.plugin.saveConfig({ lockedIn: !this.cfg().lockedIn }).then(() => this.render());
		});

		if (this.archiveOpen) this.renderArchive(chat);

		const currentSession = this.cfg().sessions.find((item) => item.id === this.cfg().currentSessionId) ?? null;
		const greet = currentSession?.title ?? (this.cfg().name ? `Hello ${this.cfg().name}` : "Kaiako");
		const greetEl = chat.createEl("h2", { cls: "kaiako-chat-greet", text: greet });

		const messages = chat.createDiv({ cls: "kaiako-messages" });
		void this.fillMessages(messages, greetEl);

		const composer = chat.createDiv({ cls: "kaiako-composer" });
		this.promptBar = mountPromptBar(this, composer, {
			onSend: (text) => {
				void this.handleSend(messages, text, greetEl);
			},
		});

		const meta = chat.createDiv({ cls: "kaiako-meta" });
		const entry = this.cfg().apiKeys.find((item) => item.id === this.cfg().activeModelId);
		const provider = getProvider(entry?.provider ?? this.cfg().provider);
		meta.createSpan({
			text: `Model · ${provider?.model ?? "—"}`,
		});
		this.costEl = meta.createSpan({
			cls: "kaiako-meta-cost",
			text: "Inference · $0.0000",
		});
	}

	private renderArchive(chat: HTMLElement): void {
		const pop = chat.createDiv({ cls: "kaiako-archive-pop" });
		pop.createEl("h3", { text: "Sessions" });
		const scroller = pop.createDiv({ cls: "kaiako-archive-scroll" });
		const sessions = this.cfg().sessions;
		if (sessions.length === 0) {
			scroller.createEl("p", { cls: "kaiako-hint", text: "No sessions yet." });
			return;
		}
		for (const session of sessions) {
			const row = scroller.createEl("button", { cls: "kaiako-archive-session" });
			if (session.id === this.cfg().currentSessionId) {
				row.addClass("is-current");
			}
			row.createSpan({ cls: "kaiako-archive-title", text: session.title });
			this.registerDomEvent(row, "click", () => {
				void this.openSession(session);
			});
		}
	}

	private openSettings(): void {
		new KaiakoSettingsModal(this.app, this.plugin, () => {
			if (!this.plugin.config.onboarded) this.reopenOnboarding();
			else this.render();
		}).open();
	}

	private async fillMessages(messages: HTMLElement, greet?: HTMLElement): Promise<void> {
		const session = this.cfg().sessions.find((item) => item.id === this.cfg().currentSessionId) ?? null;
		const body = await readSessionBody(this.app, session);
		messages.empty();
		if (!body) {
			greet?.addClass("kaiako-chat-greet--hidden");
			const empty = messages.createDiv({ cls: "kaiako-empty kaiako-topic-start" });
			empty.createEl("h2", { cls: "kaiako-empty-title", text: "Starting a topic" });
			empty.createEl("p", {
				cls: "kaiako-empty-sub",
				text: "Type out a topic you want to learn—as much detail as you need.",
			});
			return;
		}
		greet?.removeClass("kaiako-chat-greet--hidden");
		const turns = splitSessionTurns(body);
		for (const turn of turns) {
			this.separateMessage(messages);
			const wrap = messages.createDiv({ cls: `kaiako-turn kaiako-turn--${turn.role}` });
			const article = wrap.createDiv({ cls: "kaiako-md" });
			await MarkdownRenderer.render(
				this.app,
				sanitizeMathForRender(stripMcqFences(turn.markdown)),
				article,
				session?.filePath ?? "",
				this,
			);
		}
		this.mountScoreChip(messages, session);
	}

	private separateMessage(messages: HTMLElement): void {
		if (messages.childElementCount === 0) return;
		messages.createEl("hr", { cls: "kaiako-msg-rule", attr: { "aria-hidden": "true" } });
	}

	private mountScoreChip(messages: HTMLElement, session: SessionMeta | null): void {
		if (session?.knowledgeScore == null) return;
		const chip = messages.createDiv({ cls: "kaiako-score-chip" });
		chip.createSpan({
			text: `Knowledge score · ${session.knowledgeScore} points`,
		});
		if (session.teachingEntry != null) {
			chip.createSpan({
				cls: "kaiako-score-chip-sub",
				text: ` · teach from ${session.teachingEntry}`,
			});
		}
	}

	private async handleSend(messages: HTMLElement, text: string, greet?: HTMLElement): Promise<void> {
		this.stream?.cancel();
		this.stream = null;

		let session = this.cfg().sessions.find((item) => item.id === this.cfg().currentSessionId) ?? null;
		if (!session) {
			session = await createSessionNote(this.app, text.slice(0, 48) || "Starting a topic");
			await this.saveSession(session);
			greet?.setText(session.title);
		} else {
			session = await this.hydrateSession(session);
		}

		const captured = extractGoal(text);
		if (!hasStoredGoal(session.goal) && captured) {
			session = await persistHarnessState(this.app, session, {
				goal: captured,
				phase: "diagnostic",
			});
			await this.saveSession(session);
		}

		await appendToSession(this.app, session, `**You:** ${text}`);
		await this.fillMessages(messages, greet);

		const started = await this.plugin.pi.ensure(this.app, this.cfg());
		if (!started.ok) {
			new Notice(started.detail);
			return;
		}

		await this.runPiTurn(messages, session, text, greet);
	}

	private async runPiTurn(
		messages: HTMLElement,
		session: SessionMeta,
		learnerText: string,
		greet?: HTMLElement,
		opts?: { estimate?: ReturnType<typeof estimateAbility> | null; lastItem?: ScoredItem; mcqAnswer?: string },
	): Promise<void> {
		this.separateMessage(messages);
		const live = messages.createDiv({ cls: "kaiako-bubble kaiako-bubble--ai kaiako-stream" });
		this.stream = mountStreamReveal(live, { transform: stripMcqFences });
		this.toolsLive = false;
		this.promptBar?.setOrb("breathing");

		this.plugin.pi.setListeners({
			onThinking: (active) => {
				if (active && !this.toolsLive) this.promptBar?.setOrb("breathing");
			},
			onTools: (on, name) => {
				this.toolsLive = on;
				this.promptBar?.setInternetActive(on);
				if (on) this.promptBar?.setOrb(orbStateForTool(name ?? ""));
				else this.promptBar?.setOrb("composing");
			},
			onText: (chunk) => {
				if (!this.toolsLive) this.promptBar?.setOrb("composing");
				this.stream?.push(chunk);
			},
			onDone: (full, usage) => {
				void this.finishAssistantTurn(messages, session, full, greet, usage);
			},
			onError: (message) => {
				this.promptBar?.setOrb(null);
				this.promptBar?.setInternetActive(false);
				new Notice(message);
			},
		});

		this.plugin.pi.prompt(
			promptWithUserContext(this.cfg(), buildHarnessPrompt(session, learnerText, opts)),
		);
	}

	private async finishAssistantTurn(
		messages: HTMLElement,
		session: SessionMeta,
		full: string,
		greet?: HTMLElement,
		usage?: { cost?: number },
	): Promise<void> {
		await this.stream?.seedIfEmpty(stripMcqFences(full));
		await this.stream?.finish();
		this.stream = null;
		if (usage?.cost != null && this.costEl) {
			this.costEl.setText(`Inference · $${usage.cost.toFixed(4)}`);
		}

		session = await this.hydrateSession(session);
		const phase = resolvePhase(session);
		const { prose, mcq } = splitMcq(full);
		const toWrite = (prose || full).trim();

		if (mcq && phase === "need_goal") {
			if (toWrite) await appendToSession(this.app, session, toWrite);
			await this.fillMessages(messages, greet);
			this.promptBar?.setOrb(null);
			this.promptBar?.setInternetActive(false);
			await this.runPiTurn(
				messages,
				session,
				"(No goal is stored. Ask for the learning goal now. Do not quiz.)",
			);
			return;
		}

		if (mcq && phase !== "need_goal") {
			if (toWrite) await appendToSession(this.app, session, toWrite);
			await this.fillMessages(messages, greet);
			this.mountMcq(messages, session, mcq, greet, phase === "diagnostic");
			this.promptBar?.setInternetActive(false);
			this.promptBar?.setOrb("listening");
			return;
		}

		if (toWrite) await appendToSession(this.app, session, toWrite);
		await this.fillMessages(messages, greet);
		this.promptBar?.setOrb(null);
		this.promptBar?.setInternetActive(false);
	}

	private mountMcq(
		messages: HTMLElement,
		session: SessionMeta,
		item: McqItem,
		greet?: HTMLElement,
		scoreIt = true,
	): void {
		this.separateMessage(messages);
		const box = messages.createDiv({ cls: "kaiako-mcq" });
		const stem = box.createDiv({ cls: "kaiako-mcq-stem" });
		void MarkdownRenderer.render(
			this.app,
			sanitizeMathForRender(item.stem),
			stem,
			session.filePath,
			this,
		);
		const list = box.createDiv({ cls: "kaiako-mcq-options" });
		let locked = false;

		const pick = (chosen: string, dontKnow: boolean) => {
			if (locked) return;
			locked = true;
			void this.answerMcq(messages, session, item, chosen, dontKnow, box, greet, scoreIt);
		};

		for (const option of item.options) {
			const btn = list.createEl("button", {
				cls: "kaiako-mcq-option",
				attr: { type: "button" },
			});
			const label = btn.createSpan({ cls: "kaiako-mcq-key", text: option.id.toUpperCase() });
			void label;
			const body = btn.createSpan({ cls: "kaiako-mcq-text" });
			void MarkdownRenderer.render(
				this.app,
				sanitizeMathForRender(option.text),
				body,
				session.filePath,
				this,
			);
			this.registerDomEvent(btn, "click", () => pick(option.id, false));
		}

		const skip = box.createEl("button", {
			cls: "kaiako-mcq-skip",
			text: "I don't know",
			attr: { type: "button" },
		});
		this.registerDomEvent(skip, "click", () => pick("", true));
		messages.scrollTop = messages.scrollHeight;
	}

	private async answerMcq(
		messages: HTMLElement,
		session: SessionMeta,
		item: McqItem,
		chosen: string,
		dontKnow: boolean,
		box: HTMLElement,
		greet?: HTMLElement,
		scoreIt = true,
	): Promise<void> {
		const correct = !dontKnow && chosen === item.correct;
		const record: ScoredItem = {
			id: item.id,
			stem: item.stem,
			difficulty: item.difficulty,
			correct,
			dontKnow,
			chosen: dontKnow ? "dont_know" : chosen,
		};
		if (scoreIt) {
			const items = [...(session.diagnosticItems ?? []), record];
			const estimate = estimateAbility(items);
			const nextPhase = estimate.stop ? "teaching" : "diagnostic";
			session = await persistHarnessState(this.app, session, {
				phase: nextPhase,
				estimate,
				items,
			});
			await this.saveSession(session);
			await appendToSession(this.app, session, formatMcqRecord(item, chosen, dontKnow, correct));
			box.remove();
			await this.fillMessages(messages, greet);
			const reply = dontKnow
				? `I don't know. Item ${item.id} was a miss.`
				: `I chose "${chosen}". That is ${correct ? "correct" : "incorrect"}.`;
			this.promptBar?.setOrb("working");
			await this.runPiTurn(messages, session, reply, greet, {
				estimate,
				lastItem: record,
				mcqAnswer: reply,
			});
			return;
		}

		await appendToSession(this.app, session, formatMcqRecord(item, chosen, dontKnow, correct));
		box.remove();
		await this.fillMessages(messages, greet);
		const reply = dontKnow
			? `I don't know.`
			: `I chose "${chosen}". That is ${correct ? "correct" : "incorrect"}.`;
		this.promptBar?.setOrb("working");
		await this.runPiTurn(messages, session, reply, greet, { mcqAnswer: reply });
	}

	private async hydrateSession(session: SessionMeta): Promise<SessionMeta> {
		const harness = await readSessionHarness(this.app, session);
		const merged: SessionMeta = {
			...session,
			...harness,
			id: session.id,
			filePath: session.filePath,
			title: session.title,
			createdAt: session.createdAt,
		};
		if (
			merged.goal !== session.goal ||
			merged.phase !== session.phase ||
			merged.knowledgeScore !== session.knowledgeScore
		) {
			await this.saveSession(merged);
		}
		return merged;
	}

	private async saveSession(session: SessionMeta): Promise<void> {
		const sessions = [
			session,
			...this.cfg().sessions.filter((item) => item.id !== session.id),
		];
		await this.plugin.saveConfig({ sessions, currentSessionId: session.id });
	}

	private async newChat(): Promise<void> {
		await this.plugin.saveConfig({ currentSessionId: null });
		this.archiveOpen = false;
		this.render();
		new Notice("Starting a new topic.");
	}

	private async openSession(session: SessionMeta): Promise<void> {
		await openSessionNote(this.app, session);
		await this.plugin.saveConfig({ currentSessionId: session.id });
		this.archiveOpen = false;
		this.render();
	}
}

function promptWithUserContext(config: KaiakoConfig, text: string): string {
	const context = [
		config.name.trim() ? `Name: ${config.name.trim()}` : "",
		config.pronounSubject.trim() && config.pronounObject.trim()
			? `Pronouns: ${config.pronounSubject.trim()}/${config.pronounObject.trim()}`
			: "",
		config.about.trim() ? `About the learner: ${config.about.trim()}` : "",
	].filter(Boolean);

	if (context.length === 0) return text;

	return [
		"Use this learner context when it helps answer the request:",
		...context,
		"",
		"Learner request:",
		text,
	].join("\n");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shortPath(p: string): string {
	const parts = p.split(/[/\\]/);
	if (parts.length <= 2) return p;
	return `…/${parts.slice(-2).join("/")}`;
}
