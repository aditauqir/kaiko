import {
	ItemView,
	MarkdownRenderer,
	Notice,
	setIcon,
	type WorkspaceLeaf,
} from "obsidian";
import type KaiakoPlugin from "./main";
import type { BaseJumpLevel, KaiakoConfig, SessionMeta } from "./config";
import { appendProviderLogo, getProvider, onboardingProviders } from "./providers";
import { detectPiHarness, installPiHarness } from "./pi";
import { pickDataFolder } from "./folder";
import {
	appendToSession,
	createSessionNote,
	normalizeSessionNotePath,
	openSessionNote,
	persistHarnessState,
	readSessionBody,
	readSessionHarness,
	replaceSessionTurns,
	splitSessionTurns,
	stripYouPrefix,
	updateSessionTopic,
	patchSessionFrontmatter,
	type SessionTurn,
} from "./note-writer";
import { KaiakoSettingsModal } from "./settings-modal";
import { mountPromptBar, type PromptBarHandle } from "./prompt-bar";
import { mountApprovalCard } from "./approval-card";
import { extractGoal, hasStoredGoal } from "./goal";
import { buildHarnessPrompt, resolvePhase } from "./harness-prompt";
import { estimateAbility, type ScoredItem } from "./knowledge";
import {
	formatMcqQuestion,
	formatMcqRecord,
	normalizeMcqMarkdown,
	splitMcq,
	stripMcqFences,
	type McqItem,
} from "./mcq";
import { sanitizeMathForRender } from "./math-safe";
import { mountStreamReveal, type StreamRevealHandle } from "./streaming-text";
import { orbForPhase, orbStateForTool } from "./thinking-orb";
import { extractTopic, stripTopicMarker } from "./topic";
import { SessionActivityTracker, type SessionActivitySnapshot } from "./session-activity";

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
	private archiveEl: HTMLElement | null = null;
	private archiveBtn: HTMLButtonElement | null = null;
	private promptBar: PromptBarHandle | null = null;
	private skippedProviders = false;
	private stream: StreamRevealHandle | null = null;
	private toolsLive = false;
	private costEl: HTMLElement | null = null;
	private readonly activity: SessionActivityTracker;

	constructor(leaf: WorkspaceLeaf, plugin: KaiakoPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.activity = new SessionActivityTracker((sessionId, snapshot) =>
			this.persistSessionActivity(sessionId, snapshot),
		);
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
		this.registerDomEvent(this.rootEl, "pointerdown", (event) => this.markSessionActivity(event));
		this.registerDomEvent(this.rootEl, "keydown", (event) => this.markSessionActivity(event));
		this.registerDomEvent(this.rootEl, "input", (event) => this.markSessionActivity(event));
		this.registerDomEvent(this.rootEl, "wheel", (event) => this.markSessionActivity(event));
		this.registerDomEvent(this.rootEl, "touchstart", (event) => this.markSessionActivity(event));
		this.registerDomEvent(document, "pointerdown", (event) => this.dismissArchive(event));
		this.step = this.plugin.config.onboarded ? "chat" : "provider";
		await this.refreshPi();
		this.render();
	}

	async onClose(): Promise<void> {
		await this.activity.stop();
		this.contentEl.empty();
		this.archiveEl = null;
		this.archiveBtn = null;
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
		this.archiveEl = null;
		this.archiveBtn = null;
		this.rootEl.empty();
		const shell = this.rootEl.createDiv({
			cls: [
				"kaiako-shell",
				this.step === "chat" ? "kaiako-bg-chat" : "kaiako-bg-onboarding",
				this.step === "chat" ? "kaiako-locked" : "",
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
			void this.openSettings();
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
		this.registerDomEvent(settingsBtn, "click", () => void this.openSettings());

		const spacer = top.createDiv({ cls: "kaiako-top-spacer" });
		void spacer;

		this.archiveBtn = top.createEl("button", {
			cls: "kaiako-icon-btn",
			attr: { "aria-label": "Archive" },
		});
		setIcon(this.archiveBtn, "archive");
		this.registerDomEvent(this.archiveBtn, "click", () => {
			this.toggleArchive(chat);
		});

		const newChatBtn = top.createEl("button", {
			cls: "kaiako-icon-btn",
			attr: { "aria-label": "Start a topic" },
		});
		setIcon(newChatBtn, "plus");
		this.registerDomEvent(newChatBtn, "click", () => {
			void this.newChat();
		});

		if (this.archiveOpen) this.archiveEl = this.renderArchive(chat);

		const currentSession = this.cfg().sessions.find((item) => item.id === this.cfg().currentSessionId) ?? null;
		if (currentSession) this.activity.begin(currentSession);
		else void this.activity.stop();
		const topicReady = currentSession?.topicGenerated === true;
		const greet = topicReady ? currentSession?.title ?? "Kaiako" : (this.cfg().name ? `Hello ${this.cfg().name}` : "Kaiako");
		const greetEl = chat.createEl("h2", { cls: "kaiako-chat-greet", text: greet });
		if (currentSession && !topicReady) greetEl.addClass("kaiako-chat-greet--hidden");

		const messages = chat.createDiv({ cls: "kaiako-messages" });
		void this.fillMessages(messages, greetEl);

		const composer = chat.createDiv({ cls: "kaiako-composer" });
		this.promptBar = mountPromptBar(
			this,
			composer,
			{
				onSend: (text) => {
					void this.handleSend(messages, text, greetEl);
				},
			},
			{ netSearch: this.cfg().netSearch },
		);

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

	private toggleArchive(chat: HTMLElement): void {
		this.archiveOpen = !this.archiveOpen;
		if (this.archiveOpen) {
			this.archiveEl = this.renderArchive(chat);
			return;
		}
		this.archiveEl?.remove();
		this.archiveEl = null;
	}

	private dismissArchive(event: PointerEvent): void {
		if (!this.archiveOpen || !this.archiveEl) return;
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (this.archiveEl.contains(target) || this.archiveBtn?.contains(target)) return;
		this.archiveOpen = false;
		this.archiveEl.remove();
		this.archiveEl = null;
	}

	private renderArchive(chat: HTMLElement): HTMLElement {
		const pop = chat.createDiv({ cls: "kaiako-archive-pop" });
		pop.createEl("h3", { text: "Sessions" });
		const scroller = pop.createDiv({ cls: "kaiako-archive-scroll" });
		const sessions = this.cfg().sessions;
		if (sessions.length === 0) {
			scroller.createEl("p", { cls: "kaiako-hint", text: "No sessions yet." });
			return pop;
		}
		for (const session of sessions) {
			const row = scroller.createEl("button", { cls: "kaiako-archive-session" });
			if (session.id === this.cfg().currentSessionId) {
				row.addClass("is-current");
			}
			row.createSpan({
				cls: "kaiako-archive-title",
				text: session.topicGenerated === true ? session.title : "Generating topic…",
			});
			this.registerDomEvent(row, "click", () => {
				void this.openSession(session);
			});
		}
		return pop;
	}

	private async openSettings(): Promise<void> {
		await this.activity.flush();
		new KaiakoSettingsModal(this.app, this.plugin, () => {
			if (!this.plugin.config.onboarded) this.reopenOnboarding();
			else this.render();
		}).open();
	}

	private async fillMessages(messages: HTMLElement, greet?: HTMLElement): Promise<void> {
		let session = this.cfg().sessions.find((item) => item.id === this.cfg().currentSessionId) ?? null;
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
		if (session) session = await this.hydrateSession(session);
		if (session) this.activity.begin(session);
		if (session?.topicGenerated === true) greet?.removeClass("kaiako-chat-greet--hidden");
		else greet?.addClass("kaiako-chat-greet--hidden");
		let turns = splitSessionTurns(body);
		if (session) {
			let pendingMcq = session.pendingMcq;
			const normalizedTurns = turns.map((turn) => {
				if (turn.role !== "assistant") return turn;
				const parsed = splitMcq(turn.markdown);
				if (!parsed.mcq) return { ...turn, markdown: normalizeMcqMarkdown(turn.markdown) };

				if (legacyMcqHasAnswer(parsed.prose)) {
					pendingMcq = undefined;
					const prelude = legacyMcqPrelude(parsed.prose);
					const result = formatMcqRecord(parsed.mcq, "", false, legacyMcqWasCorrect(parsed.prose));
					return { ...turn, markdown: [prelude, result].filter(Boolean).join("\n\n") };
				}

				pendingMcq = parsed.mcq;
				return {
					...turn,
					markdown: [parsed.prose, formatMcqQuestion(parsed.mcq)].filter(Boolean).join("\n\n"),
				};
			});
			const turnsChanged = normalizedTurns.some((turn, index) => turn.markdown !== turns[index]?.markdown);
			const pendingChanged = pendingMcq?.id !== session.pendingMcq?.id;
			if (turnsChanged) {
				await replaceSessionTurns(this.app, session, normalizedTurns);
				turns = normalizedTurns;
			}
			if (pendingChanged) {
				await patchSessionFrontmatter(this.app, session, {
					kaiako_pending_mcq: pendingMcq ? JSON.stringify(pendingMcq) : null,
				});
				session = { ...session, pendingMcq };
				await this.saveSession(session);
			}
		}
		const liked = new Set(session?.likedTurns ?? []);
		for (let index = 0; index < turns.length; index += 1) {
			const turn = turns[index];
			if (!turn) continue;
			const pendingQuestion = session?.pendingMcq ? formatMcqQuestion(session.pendingMcq) : "";
			const withoutPendingQuestion = pendingQuestion ? turn.markdown.replace(pendingQuestion, "").trim() : turn.markdown;
			const visibleMarkdown = stripTopicMarker(stripMcqFences(withoutPendingQuestion));
			if (!visibleMarkdown.trim()) continue;
			const wrap = messages.createDiv({ cls: `kaiako-turn kaiako-turn--${turn.role}` });
			const article = wrap.createDiv({ cls: "kaiako-md" });
			await MarkdownRenderer.render(
				this.app,
				sanitizeMathForRender(visibleMarkdown),
				article,
				session?.filePath ?? "",
				this,
			);
			if (turn.role === "assistant") {
				this.mountTurnActions(wrap, messages, session, turns, index, liked.has(index), greet);
			}
		}
		if (session?.pendingMcq) {
			this.mountMcq(messages, session, session.pendingMcq, greet, resolvePhase(session) === "diagnostic");
		}
	}

	private mountTurnActions(
		wrap: HTMLElement,
		messages: HTMLElement,
		session: SessionMeta | null,
		turns: SessionTurn[],
		index: number,
		liked: boolean,
		greet?: HTMLElement,
	): void {
		const bar = wrap.createDiv({ cls: "kaiako-turn-actions" });
		const turn = turns[index];
		if (!turn) return;

		const likeBtn = heroIconButton(bar, "Like", HEART_PATH, "kaiako-turn-like");
		likeBtn.setAttr("aria-pressed", liked ? "true" : "false");
		if (liked) likeBtn.addClass("is-liked");
		this.registerDomEvent(likeBtn, "click", () => {
			void this.toggleTurnLike(likeBtn, session, index, greet);
		});

		const copyBtn = createCopyButton(bar);
		this.registerDomEvent(copyBtn, "click", () => {
			void this.copyTurn(copyBtn, turn);
		});

		const restartBtn = heroIconButton(bar, "Restart from here", RESTART_PATH, "kaiako-turn-restart");
		this.registerDomEvent(restartBtn, "click", () => {
			void this.restartFromTurn(messages, session, turns, index, greet);
		});
	}

	private async copyTurn(btn: HTMLButtonElement, turn: SessionTurn): Promise<void> {
		const text = stripYouPrefix(stripTopicMarker(stripMcqFences(turn.markdown)));
		try {
			await navigator.clipboard.writeText(text);
			btn.addClass("is-copied");
			btn.removeAttribute("aria-label");

			const host = btn as unknown as { _copyTimer?: number };
			if (host._copyTimer != null) {
				window.clearTimeout(host._copyTimer);
			}
			host._copyTimer = window.setTimeout(() => {
				btn.removeClass("is-copied");
				btn.setAttribute("aria-label", "Copy");
				delete host._copyTimer;
			}, 1800);
		} catch {
			new Notice("Could not copy");
		}
	}

	private async toggleTurnLike(
		btn: HTMLButtonElement,
		session: SessionMeta | null,
		index: number,
		_greet?: HTMLElement,
	): Promise<void> {
		if (!session) return;
		session = await this.hydrateSession(session);
		const liked = new Set(session.likedTurns ?? []);
		if (liked.has(index)) liked.delete(index);
		else liked.add(index);
		const likedTurns = [...liked].sort((a, b) => a - b);
		session = { ...session, likedTurns };
		await patchSessionFrontmatter(this.app, session, {
			kaiako_liked: JSON.stringify(likedTurns),
		});
		await this.saveSession(session);
		btn.toggleClass("is-liked", liked.has(index));
		btn.setAttr("aria-pressed", liked.has(index) ? "true" : "false");
	}

	private async restartFromTurn(
		messages: HTMLElement,
		session: SessionMeta | null,
		turns: SessionTurn[],
		index: number,
		greet?: HTMLElement,
	): Promise<void> {
		if (!session) {
			new Notice("Start a chat first.");
			return;
		}
		const target = turns[index];
		if (!target) return;

		this.stream?.cancel();
		this.stream = null;

		const kept = target.role === "user" ? turns.slice(0, index + 1) : turns.slice(0, index);
		const promptSource =
			target.role === "user"
				? target
				: [...kept].reverse().find((item) => item.role === "user");
		const promptText = promptSource ? stripYouPrefix(promptSource.markdown) : "";
		if (!promptText) {
			new Notice("Nothing to restart from.");
			return;
		}

		const likedTurns = (session.likedTurns ?? []).filter((item) => item < kept.length);
		await replaceSessionTurns(this.app, session, kept);
		session = { ...session, likedTurns };
		await patchSessionFrontmatter(this.app, session, {
			kaiako_liked: JSON.stringify(likedTurns),
		});
		await this.saveSession(session);
		await this.fillMessages(messages, greet);

		const started = await this.plugin.pi.ensure(this.app, this.cfg(), session.id);
		if (!started.ok) {
			new Notice(started.detail);
			return;
		}
		this.promptBar?.setOrb("working");
		await this.runPiTurn(messages, session, promptText, greet);
	}

	private async handleSend(messages: HTMLElement, text: string, greet?: HTMLElement): Promise<void> {
		this.stream?.cancel();
		this.stream = null;

		let session = this.cfg().sessions.find((item) => item.id === this.cfg().currentSessionId) ?? null;
		if (!session) {
			session = await createSessionNote(this.app, "New topic");
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

		const started = await this.plugin.pi.ensure(this.app, this.cfg(), session.id);
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
		opts?: {
			estimate?: ReturnType<typeof estimateAbility> | null;
			lastItem?: ScoredItem;
			mcqAnswer?: string;
			baseJump?: BaseJumpLevel;
		},
	): Promise<void> {
		const live = messages.createDiv({ cls: "kaiako-bubble kaiako-bubble--ai kaiako-stream" });
		const stream = mountStreamReveal(live, { transform: (raw) => stripTopicMarker(stripMcqFences(raw)) });
		this.stream = stream;
		this.toolsLive = false;
		const phase = resolvePhase(session);
		const presentation = orbForPhase(phase);
		this.promptBar?.setOrb(presentation.state, presentation.label);

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
				// Bind every Pi delta to this turn's reveal instance. This keeps the
				// typewriter animation alive if a later render starts another turn.
				if (this.stream === stream) stream.push(chunk);
			},
			onDone: (full, usage) => {
				void this.finishAssistantTurn(messages, session, stream, full, greet, usage);
			},
			onError: (message) => {
				this.activity.setPiBusy(session.id, false);
				if (this.stream === stream) {
					stream.cancel();
					this.stream = null;
					live.remove();
				}
				this.promptBar?.setOrb(null);
				this.promptBar?.setInternetActive(false);
				new Notice(message);
			},
		});

		const resumeContext = buildResumeContext(await readSessionBody(this.app, session), learnerText);
		this.activity.setPiBusy(session.id, true);
		this.plugin.pi.prompt(
			promptWithUserContext(this.cfg(), buildHarnessPrompt(session, learnerText, {
				...opts,
				baseJump: opts?.baseJump ?? this.cfg().baseJump,
				resumeContext,
			})),
		);
	}

	private async finishAssistantTurn(
		messages: HTMLElement,
		session: SessionMeta,
		stream: StreamRevealHandle,
		full: string,
		greet?: HTMLElement,
		usage?: { cost?: number },
	): Promise<void> {
		this.activity.setPiBusy(session.id, false);
		// Pi providers can emit deltas or only the completed response. Sync the
		// final text into the same reveal instance so both paths animate identically.
		stream.setText(stripTopicMarker(stripMcqFences(full)));
		await stream.finish();
		if (this.stream === stream) this.stream = null;
		if (usage?.cost != null && this.costEl) {
			this.costEl.setText(`Inference · $${usage.cost.toFixed(4)}`);
		}

		session = await this.hydrateSession(session);
		const phase = resolvePhase(session);
		const { prose, mcq } = splitMcq(full);
		const topic = extractTopic(full);
		if (topic && session.topicGenerated !== true) {
			const updatedPath = await updateSessionTopic(this.app, session, topic);
			session = {
				...session,
				title: topic,
				topicGenerated: true,
				...(updatedPath ? { filePath: updatedPath } : {}),
			};
			await patchSessionFrontmatter(this.app, session, { kaiako_topic_generated: true });
			await this.saveSession(session);
			greet?.setText(topic);
			greet?.removeClass("kaiako-chat-greet--hidden");
		}
		const toWrite = stripTopicMarker((mcq ? prose : full).trim());

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
			await appendToSession(this.app, session, formatMcqQuestion(mcq));
			await patchSessionFrontmatter(this.app, session, {
				kaiako_pending_mcq: JSON.stringify(mcq),
			});
			session = { ...session, pendingMcq: mcq };
			await this.saveSession(session);
			await this.fillMessages(messages, greet);
			this.promptBar?.setInternetActive(false);
			this.promptBar?.setOrb(null);
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
		let locked = false;
		const pick = (chosen: string, dontKnow: boolean) => {
			if (locked) return;
			locked = true;
			void this.answerMcq(messages, session, item, chosen, dontKnow, box, greet, scoreIt);
		};
		const box = mountApprovalCard(messages, item, {
			app: this.app,
			sourcePath: session.filePath,
			component: this,
			onSubmit: pick,
		});
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
			const estimate = estimateAbility(items, this.cfg().baseJump);
			const nextPhase = estimate.stop ? "teaching" : "diagnostic";
			session = await persistHarnessState(this.app, session, {
				phase: nextPhase,
				estimate,
				items,
			});
			session = await this.clearPendingMcq(session);
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

		session = await this.clearPendingMcq(session);
		await this.saveSession(session);
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
		const normalized = await normalizeSessionNotePath(this.app, session);
		const harness = await readSessionHarness(this.app, normalized);
		const merged: SessionMeta = {
			...normalized,
			...harness,
			id: normalized.id,
			filePath: normalized.filePath,
			title: normalized.title,
			createdAt: normalized.createdAt,
		};
		if (
			merged.filePath !== session.filePath ||
			merged.title !== session.title ||
			merged.topicGenerated !== session.topicGenerated ||
			merged.goal !== session.goal ||
			merged.phase !== session.phase ||
			merged.knowledgeScore !== session.knowledgeScore ||
			merged.activeSeconds !== session.activeSeconds ||
			merged.lastInteractionAt !== session.lastInteractionAt ||
			merged.pendingMcq?.id !== session.pendingMcq?.id
		) {
			await this.saveSession(merged);
		}
		return merged;
	}

	private async clearPendingMcq(session: SessionMeta): Promise<SessionMeta> {
		await patchSessionFrontmatter(this.app, session, { kaiako_pending_mcq: null });
		return { ...session, pendingMcq: undefined };
	}

	private markSessionActivity(event?: Event): void {
		const target = event?.target;
		if (target instanceof Element && target.closest(".kaiako-chat-top, .kaiako-archive-pop")) return;
		const sessionId = this.cfg().currentSessionId;
		if (sessionId) this.activity.markUserInteraction(sessionId);
	}

	private async persistSessionActivity(sessionId: string, snapshot: SessionActivitySnapshot): Promise<void> {
		const session = this.cfg().sessions.find((item) => item.id === sessionId);
		if (!session) return;
		const activeSeconds = Math.max(0, Math.floor(snapshot.activeSeconds));
		await patchSessionFrontmatter(this.app, session, {
			kaiako_active_seconds: activeSeconds,
			kaiako_last_interaction_at: snapshot.lastInteractionAt,
		});
		const next: SessionMeta = {
			...session,
			activeSeconds,
			lastInteractionAt: snapshot.lastInteractionAt ?? undefined,
		};
		const sessions = [next, ...this.cfg().sessions.filter((item) => item.id !== sessionId)];
		await this.plugin.saveConfig({ sessions });
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
		session = await normalizeSessionNotePath(this.app, session);
		await openSessionNote(this.app, session);
		await this.saveSession(session);
		this.archiveOpen = false;
		this.render();
	}
}

function legacyMcqHasAnswer(markdown: string): boolean {
	return /(?:^|\n)\s*_Answer:/i.test(markdown);
}

function legacyMcqWasCorrect(markdown: string): boolean {
	const answer = markdown.match(/_Answer:\s*[^_\n]*·\s*(correct|incorrect)\s*_/i);
	return answer?.[1]?.toLowerCase() === "correct";
}

function legacyMcqPrelude(markdown: string): string {
	const question = markdown.search(/(?:^|\n)\s*(?:\*\*)?Question:?(?:\*\*)?/i);
	return question > 0 ? markdown.slice(0, question).trim() : "";
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

function buildResumeContext(body: string, currentLearnerText: string): string {
	const current = currentLearnerText.trim();
	const turns = splitSessionTurns(body);
	const entries = turns
		.filter((turn, index) => {
			const isCurrentUserTurn =
				index === turns.length - 1 && turn.role === "user" && stripYouPrefix(turn.markdown) === current;
			return !isCurrentUserTurn;
		})
		.map((turn) => {
			const role = turn.role === "user" ? "Learner" : "Kaiako";
			const content = stripTopicMarker(turn.markdown).trim();
			return content ? `${role}: ${content}` : "";
		})
		.filter(Boolean);
	return entries.slice(-12).join("\n\n").slice(-12000);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function heroIconButton(parent: HTMLElement, label: string, pathD: string, className: string): HTMLButtonElement {
	const btn = parent.createEl("button", {
		cls: `kaiako-turn-action ${className}`,
		attr: { type: "button", "aria-label": label },
	});
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	svg.setAttribute("fill", "none");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("stroke-width", "1.5");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("class", "kaiako-custom-icon");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", pathD);
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", "currentColor");
	path.setAttribute("stroke-width", "1.5");
	path.setAttribute("stroke-linecap", "round");
	path.setAttribute("stroke-linejoin", "round");
	svg.appendChild(path);
	btn.appendChild(svg);
	return btn;
}

const CLIPBOARD_PATH =
	"M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184";

const CLIPBOARD_CHECK_PATH =
	"M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75";

function createCopyButton(parent: HTMLElement): HTMLButtonElement {
	const btn = parent.createEl("button", {
		cls: "kaiako-turn-action kaiako-turn-copy",
		attr: { type: "button", "aria-label": "Copy" },
	});

	const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	copySvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	copySvg.setAttribute("fill", "none");
	copySvg.setAttribute("viewBox", "0 0 24 24");
	copySvg.setAttribute("stroke-width", "1.5");
	copySvg.setAttribute("stroke", "currentColor");
	copySvg.setAttribute("class", "kaiako-custom-icon kaiako-icon-copy");
	copySvg.setAttribute("aria-hidden", "true");
	const copyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	copyPath.setAttribute("d", CLIPBOARD_PATH);
	copyPath.setAttribute("fill", "none");
	copyPath.setAttribute("stroke", "currentColor");
	copyPath.setAttribute("stroke-width", "1.5");
	copyPath.setAttribute("stroke-linecap", "round");
	copyPath.setAttribute("stroke-linejoin", "round");
	copySvg.appendChild(copyPath);
	btn.appendChild(copySvg);

	const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	checkSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	checkSvg.setAttribute("fill", "none");
	checkSvg.setAttribute("viewBox", "0 0 24 24");
	checkSvg.setAttribute("stroke-width", "1.5");
	checkSvg.setAttribute("stroke", "currentColor");
	checkSvg.setAttribute("class", "kaiako-custom-icon kaiako-icon-copied");
	checkSvg.setAttribute("aria-hidden", "true");
	const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	checkPath.setAttribute("d", CLIPBOARD_CHECK_PATH);
	checkPath.setAttribute("fill", "none");
	checkPath.setAttribute("stroke", "currentColor");
	checkPath.setAttribute("stroke-width", "1.5");
	checkPath.setAttribute("stroke-linecap", "round");
	checkPath.setAttribute("stroke-linejoin", "round");
	checkSvg.appendChild(checkPath);
	btn.appendChild(checkSvg);

	return btn;
}

const HEART_PATH =
	"M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z";

const RESTART_PATH =
	"M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99";

function shortPath(p: string): string {
	const parts = p.split(/[/\\]/);
	if (parts.length <= 2) return p;
	return `…/${parts.slice(-2).join("/")}`;
}
