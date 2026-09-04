import { Modal, Notice, Setting, setIcon, type App } from "obsidian";
import type KaiakoPlugin from "./main";
import { newId, type ApiKeyEntry } from "./config";
import { PROVIDERS, appendProviderLogo, getProvider, type ProviderId } from "./providers";
import { pickDataFolder } from "./folder";
import { detectPiHarness, installPiHarness } from "./pi";
import { deleteSessionFiles } from "./note-writer";

type TabId = "keys" | "user-info" | "sessions" | "folder" | "pi";

const TABS: { id: TabId; label: string; icon: string; group: string; search: string }[] = [
	{ id: "keys", label: "API keys", icon: "key", group: "Account", search: "api keys providers models" },
	{ id: "user-info", label: "User info", icon: "user", group: "Account", search: "name pronouns profile" },
	{ id: "sessions", label: "Sessions", icon: "archive", group: "Data", search: "sessions archive chats" },
	{ id: "folder", label: "Folder", icon: "folder", group: "Data", search: "folder data location" },
	{ id: "pi", label: "Pi", icon: "terminal", group: "Data", search: "pi harness tools" },
];

const PRONOUNS_PATTERN = /^\s*[^/]+\s*\/\s*[^/]+\s*$/;

export class KaiakoSettingsModal extends Modal {
	plugin: KaiakoPlugin;
	onChange: () => void;
	private tab: TabId = "keys";
	private query = "";
	private piFound = false;
	private piVersion: string | null = null;
	private piBusy = false;

	constructor(app: App, plugin: KaiakoPlugin, onChange: () => void) {
		super(app);
		this.plugin = plugin;
		this.onChange = onChange;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("mod-settings", "kaiako-settings-modal");
		this.titleEl.setText("Kaiako");
		const detected = await detectPiHarness();
		this.piFound = detected.found;
		this.piVersion = detected.version;
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private visibleTabs() {
		const q = this.query.trim().toLowerCase();
		if (!q) return TABS;
		return TABS.filter(
			(tab) =>
				tab.label.toLowerCase().includes(q) ||
				tab.group.toLowerCase().includes(q) ||
				tab.search.toLowerCase().includes(q),
		);
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("vertical-tabs-container");

		const header = contentEl.createDiv({ cls: "vertical-tab-header" });
		const searchWrap = header.createDiv({ cls: "kaiako-settings-search" });
		const search = searchWrap.createEl("input", {
			type: "search",
			cls: "search-input",
			attr: { placeholder: "Search settings...", spellcheck: "false" },
		});
		search.value = this.query;
		this.plugin.registerDomEvent(search, "input", () => {
			this.query = search.value;
			const visible = this.visibleTabs();
			if (!visible.some((tab) => tab.id === this.tab) && visible[0]) this.tab = visible[0].id;
			this.render();
			const again = this.contentEl.find("input.search-input") as HTMLInputElement | null;
			if (again) {
				again.focus();
				again.setSelectionRange(this.query.length, this.query.length);
			}
		});

		const visible = this.visibleTabs();
		let lastGroup = "";
		for (const tab of visible) {
			if (tab.group !== lastGroup) {
				lastGroup = tab.group;
				header.createDiv({ cls: "vertical-tab-header-group-title", text: tab.group });
			}
			const item = header.createDiv({
				cls: `vertical-tab-nav-item${this.tab === tab.id ? " is-active" : ""}`,
			});
			setIcon(item.createSpan({ cls: "kaiako-settings-nav-icon" }), tab.icon);
			item.createSpan({ text: tab.label });
			this.plugin.registerDomEvent(item, "click", () => {
				this.tab = tab.id;
				this.render();
			});
		}

		if (visible.length === 0) {
			header.createDiv({ cls: "vertical-tab-header-group-title", text: "No matches" });
		}

		const container = contentEl.createDiv({ cls: "vertical-tab-content-container" });
		const pane = container.createDiv({ cls: "vertical-tab-content" });
		if (this.tab === "keys") this.renderKeys(pane);
		if (this.tab === "user-info") this.renderUserInfo(pane);
		if (this.tab === "sessions") this.renderSessions(pane);
		if (this.tab === "folder") this.renderFolder(pane);
		if (this.tab === "pi") this.renderPi(pane);
	}

	private renderKeys(pane: HTMLElement): void {
		new Setting(pane).setName("Add an API key").setHeading();
		new Setting(pane)
			.setName("Provider options")
			.setDesc("Choose a provider, click Add, then enter its API key.");
		const providerOptions = pane.createDiv({ cls: "kaiako-settings-provider-options" });
		for (const item of PROVIDERS) {
			const row = providerOptions.createDiv({ cls: "kaiako-settings-provider-option" });
			appendProviderLogo(
				row,
				this.app,
				this.plugin.manifest.dir,
				item.id,
				`kaiako-provider-logo kaiako-settings-provider-logo kaiako-provider-logo--${item.id}`,
			);
			const copy = row.createDiv({ cls: "kaiako-settings-provider-copy" });
			copy.createSpan({ cls: "kaiako-settings-provider-label", text: item.label });
			copy.createSpan({ cls: "kaiako-settings-provider-model", text: item.model });
			copy.createSpan({ cls: "kaiako-settings-provider-hint", text: item.hint });
			const action = row.createDiv({ cls: "kaiako-settings-provider-action" });
			const addButton = action.createEl("button", {
				cls: "kaiako-settings-provider-add",
				text: "Add",
				attr: { type: "button" },
			});
			this.plugin.registerDomEvent(addButton, "click", () => {
				action.empty();
				const input = action.createEl("input", {
					cls: "kaiako-settings-provider-key",
					type: "password",
					attr: {
						placeholder: "Paste API key",
						"aria-label": `${item.label} API key`,
						autocomplete: "off",
						spellcheck: "false",
					},
				});
				const check = action.createEl("button", {
					cls: "kaiako-settings-provider-check",
					attr: { type: "button", "aria-label": `Save ${item.label} API key` },
				});
				setIcon(check, "check");
				const save = () => this.addApiKey(item.id, input.value);
				this.plugin.registerDomEvent(check, "click", save);
				this.plugin.registerDomEvent(input, "keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						save();
					}
				});
				input.focus();
			});
		}

		new Setting(pane).setName("Keys in rotation").setHeading();
		new Setting(pane)
			.setName("In-use key")
			.setDesc("Choose which saved key pi uses, or remove a key from rotation.");
		for (const entry of this.plugin.config.apiKeys) this.renderApiKeyEntry(pane, entry);
		if (this.plugin.config.apiKeys.length === 0) {
			new Setting(pane).setName("No keys in rotation").setDesc("Add a provider key above to get started.");
		}

		new Setting(pane).setName("Usage limits").setHeading();
		new Setting(pane)
			.setName("Monthly spend limit")
			.setDesc("Optional dollar guardrail in USD.")
			.addText((text) => {
				text.setPlaceholder("No limit");
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.step = "0.01";
				if (this.plugin.config.spendLimitUsd !== null) text.setValue(String(this.plugin.config.spendLimitUsd));
				text.onChange((value) => {
					const parsed = value.trim() ? Number(value) : null;
					if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return;
					void this.plugin.saveConfig({ spendLimitUsd: parsed });
				});
			});
		new Setting(pane)
			.setName("Monthly request limit")
			.setDesc("Optional maximum number of prompts per month.")
			.addText((text) => {
				text.setPlaceholder("No limit");
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.step = "1";
				if (this.plugin.config.requestLimit !== null) text.setValue(String(this.plugin.config.requestLimit));
				text.onChange((value) => {
					const parsed = value.trim() ? Number(value) : null;
					if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return;
					void this.plugin.saveConfig({ requestLimit: parsed === null ? null : Math.floor(parsed) });
				});
			});

		new Setting(pane)
			.setName("Set up again")
			.setDesc("Reset API keys, profile, limits, chats, and onboarding. Choose whether to keep the Pi harness.")
			.addButton((btn) => {
				btn.setButtonText("Restart onboarding");
				btn.onClick(() => {
					new RestartOnboardingModal(this.app, this.plugin, () => {
						this.onChange();
						this.close();
					}).open();
				});
			});
	}

	private renderApiKeyEntry(pane: HTMLElement, entry: ApiKeyEntry): void {
		const active = this.plugin.config.activeModelId === entry.id;
		new Setting(pane)
			.setName(entry.label)
			.setDesc(`${masked(entry.key)} · ${getProvider(entry.provider)?.model ?? entry.provider}`)
			.addButton((btn) => {
				btn.setButtonText(active ? "In use" : "Use").setDisabled(active);
				btn.onClick(() => {
					void this.plugin.saveConfig({
						activeModelId: entry.id,
						provider: entry.provider,
						apiKey: entry.key,
					}).then(() => {
						this.onChange();
						this.render();
					});
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Remove");
				btn.onClick(() => {
					const apiKeys = this.plugin.config.apiKeys.filter((item) => item.id !== entry.id);
					const removingActive = this.plugin.config.activeModelId === entry.id;
					const nextActiveModelId = removingActive
						? (apiKeys[0]?.id ?? null)
						: this.plugin.config.activeModelId;
					const nextActive = apiKeys.find((item) => item.id === nextActiveModelId) ?? apiKeys[0] ?? null;
					const removingLegacyKey = this.plugin.config.apiKey === entry.key;
					void this.plugin.saveConfig({
						apiKeys,
						activeModelId: nextActiveModelId,
						provider: removingActive || removingLegacyKey ? (nextActive?.provider ?? null) : this.plugin.config.provider,
						apiKey: removingActive || removingLegacyKey ? (nextActive?.key ?? "") : this.plugin.config.apiKey,
					}).then(() => {
						this.onChange();
						this.render();
					});
				});
			});
	}

	private addApiKey(provider: ProviderId, rawKey: string): void {
		const key = rawKey.trim();
		if (!key) {
			new Notice("Paste a key first.");
			return;
		}
		const label = getProvider(provider)?.label ?? provider;
		const entry: ApiKeyEntry = { id: newId(), provider, key, label };
		void this.plugin.saveConfig({
			apiKeys: [...this.plugin.config.apiKeys, entry],
			provider: this.plugin.config.provider ?? provider,
			apiKey: this.plugin.config.apiKey || key,
			activeModelId: this.plugin.config.activeModelId ?? entry.id,
		}).then(() => {
			this.onChange();
			this.render();
		});
	}

	private renderUserInfo(pane: HTMLElement): void {
		new Setting(pane).setName("User info").setHeading();
		new Setting(pane)
			.setName("Name")
			.setDesc("Shown in your chat greeting.")
			.addText((text) => {
				text.setValue(this.plugin.config.name);
				text.setPlaceholder("Your name");
				text.onChange((value) => {
					void this.plugin.saveConfig({ name: value.trim() }).then(() => this.onChange());
				});
			});

		new Setting(pane)
			.setName("Pronouns")
			.setDesc("Use at least one slash, for example they/them.")
			.addText((text) => {
				const current = [this.plugin.config.pronounSubject, this.plugin.config.pronounObject]
					.filter(Boolean)
					.join("/");
				text.setValue(current);
				text.setPlaceholder("they/them");
				text.inputEl.pattern = String(PRONOUNS_PATTERN).slice(1, -1);
				text.onChange((value) => {
					const valid = PRONOUNS_PATTERN.test(value);
					text.inputEl.toggleClass("is-invalid", value.trim().length > 0 && !valid);
					text.inputEl.setAttr("aria-invalid", String(!valid));
					if (!valid) return;
					const [subject, object] = value.trim().split(/\s*\/\s*/, 2);
					void this.plugin.saveConfig({ pronounSubject: subject, pronounObject: object }).then(() => this.onChange());
				});
			});

		new Setting(pane)
			.setName("About you")
			.setDesc("A little context Kaiako can use when it helps answer your questions.")
			.addTextArea((text) => {
				text.setValue(this.plugin.config.about);
				text.setPlaceholder("Tell Kaiako about your goals, background, or interests...");
				text.inputEl.addClass("kaiako-user-about");
				text.onChange((value) => {
					void this.plugin.saveConfig({ about: value.trim() }).then(() => this.onChange());
				});
			});
	}

	private renderSessions(pane: HTMLElement): void {
		const sessions = this.plugin.config.sessions;
		new Setting(pane).setName("Sessions").setHeading();
		new Setting(pane)
			.setName("Delete all sessions")
			.setDesc(
				`${sessions.length} linked chat${sessions.length === 1 ? "" : "s"}. Vault notes are trashed; config yaml stays.`,
			)
			.addButton((btn) => {
				btn.setButtonText("Delete all").setWarning();
				btn.onClick(() => {
					void (async () => {
						await deleteSessionFiles(this.app, sessions);
						await this.plugin.saveConfig({ sessions: [], currentSessionId: null });
						this.onChange();
						this.render();
					})();
				});
			});

		if (sessions.length === 0) {
			new Setting(pane).setName("No sessions yet").setDesc("Starting a topic creates a hashed markdown note in the vault.");
			return;
		}
		for (const session of sessions) {
			new Setting(pane)
				.setName(session.title)
				.setDesc(`${session.id.slice(0, 8)} · ${session.filePath}`)
				.addButton((btn) => {
					btn.setButtonText("Open");
					btn.onClick(() => {
						void this.plugin.saveConfig({ currentSessionId: session.id }).then(() => {
							this.onChange();
							this.close();
						});
					});
				});
		}
	}

	private renderFolder(pane: HTMLElement): void {
		new Setting(pane).setName("Data folder").setHeading();
		new Setting(pane)
			.setName("Location")
			.setDesc("Moves kaiako.yaml, skills, and pi config only. Vault markdown stays put so Obsidian links do not break.")
			.addButton((btn) => {
				btn.setButtonText("Change").setCta();
				btn.onClick(() => {
					void (async () => {
						const next = await pickDataFolder();
						if (!next) return;
						await this.plugin.moveDataFolder(next);
						this.onChange();
						this.render();
					})();
				});
			});
		new Setting(pane)
			.setName("Current folder")
			.setDesc(this.plugin.config.dataFolder || "No folder selected");
	}

	private renderPi(pane: HTMLElement): void {
		const linked = this.piFound && Boolean(this.plugin.config.dataFolder);
		new Setting(pane).setName("Pi harness").setHeading();
		const status = new Setting(pane)
			.setName("Status")
			.setDesc(
				linked
					? `Linked${this.piVersion ? ` · ${this.piVersion}` : ""}`
					: this.piFound
						? "Installed. Choose a data folder to finish linking it to Kaiako."
						: "Not linked. Install the Pi harness to connect it to Kaiako.",
			);
		const statusIcon = status.controlEl.createSpan({
			cls: `kaiako-pi-status-icon ${linked ? "is-linked" : "is-missing"}`,
		});
		setIcon(statusIcon, linked ? "check-circle" : "circle");

		new Setting(pane)
			.setName(this.piBusy ? "Linking Pi harness" : "Install and link")
			.setDesc(
				this.piFound
					? "Refresh the local Pi skills and configuration link."
					: "Downloads and installs the Pi harness, then links it to Kaiako.",
			)
			.addButton((btn) => {
				btn.setButtonText(this.piBusy ? "Working…" : this.piFound ? "Relink harness" : "Install & link harness");
				btn.setDisabled(this.piBusy || !this.plugin.config.dataFolder);
				btn.onClick(() => void this.installAndLinkHarness());
			});

		new Setting(pane)
			.setName("Unlink and delete")
			.setDesc("Stops Pi, unlinks the local files, uninstalls the global package, and deletes the local pi folder.")
			.addButton((btn) => {
				btn.setButtonText("Unlink & delete").setWarning();
				btn.setDisabled(this.piBusy || !this.piFound);
				btn.onClick(() => void this.unlinkAndDeleteHarness());
			});
		new Setting(pane)
			.setName("Auto start pi")
			.setDesc("Launch pi --mode rpc when Obsidian opens, using the in-use Kaiako key.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.config.autoStartPi);
				toggle.setDisabled(!this.piFound);
				toggle.onChange((value) => {
					void this.plugin.saveConfig({ autoStartPi: value }).then(() => this.onChange());
				});
			});
		new Setting(pane)
			.setName("Netsearch")
			.setDesc("Research / study web search via pi-web-access. The skills icon in the composer lights up during tool calls.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.config.netSearch);
				toggle.setDisabled(!this.piFound);
				toggle.onChange((value) => {
					void this.plugin.saveConfig({ netSearch: value }).then(() => this.onChange());
				});
			});
		new Setting(pane)
			.setName("Project skills")
			.setDesc(
				"Teach, harness, visualize, and writing skills from the learn/skills folder are copied into the data folder and Pi agent dir whenever Kaiako syncs.",
			);
	}

	private async installAndLinkHarness(): Promise<void> {
		if (this.piBusy) return;
		if (!this.plugin.config.dataFolder) {
			new Notice("Choose a data folder before linking the Pi harness.");
			return;
		}
		this.piBusy = true;
		this.render();
		try {
			const detected = this.piFound ? await detectPiHarness() : await installPiHarness();
			this.piFound = detected.found;
			this.piVersion = detected.version;
			if (!detected.found) throw new Error("Pi was installed, but the pi command is not available on PATH.");
			await this.plugin.pi.linkHarness(this.plugin.config);
			new Notice("Pi harness installed and linked.");
		} catch (error) {
			new Notice(`Could not link Pi harness: ${error instanceof Error ? error.message : "unknown error"}`);
		} finally {
			this.piBusy = false;
			this.render();
		}
	}

	private async unlinkAndDeleteHarness(): Promise<void> {
		if (this.piBusy || !this.piFound) return;
		this.piBusy = true;
		this.render();
		try {
			await this.plugin.pi.unlinkAndDeleteHarness(this.plugin.config);
			this.piFound = false;
			this.piVersion = null;
			await this.plugin.saveConfig({ autoStartPi: false, netSearch: false });
			new Notice("Pi harness unlinked and deleted.");
		} catch (error) {
			new Notice(`Could not delete Pi harness: ${error instanceof Error ? error.message : "unknown error"}`);
		} finally {
			this.piBusy = false;
			this.render();
		}
	}
}

class RestartOnboardingModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: KaiakoPlugin,
		private readonly onDone: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("kaiako-confirm-modal");
		this.titleEl.setText("Restart onboarding");
		this.contentEl.createEl("p", {
			cls: "kaiako-confirm-copy",
			text: "This clears API keys, profile details, limits, and Kaiako session notes. Choose what to do with the Pi harness.",
		});
		const actions = this.contentEl.createDiv({ cls: "kaiako-confirm-actions" });
		const keep = actions.createEl("button", { text: "Keep harness" });
		const remove = actions.createEl("button", { text: "Delete harness" });
		remove.addClass("mod-warning");
		keep.addEventListener("click", () => void this.finish(true, keep, remove));
		remove.addEventListener("click", () => void this.finish(false, keep, remove));
	}

	private async finish(keepHarness: boolean, keep: HTMLButtonElement, remove: HTMLButtonElement): Promise<void> {
		keep.disabled = true;
		remove.disabled = true;
		try {
			await this.plugin.restartOnboarding(keepHarness);
			new Notice(keepHarness ? "Onboarding reset. Pi harness kept." : "Onboarding reset and Pi harness deleted.");
			this.onDone();
			this.close();
		} catch (error) {
			new Notice(`Could not restart onboarding: ${error instanceof Error ? error.message : "unknown error"}`);
			keep.disabled = false;
			remove.disabled = false;
		}
	}
}

function masked(key: string): string {
	if (key.length < 8) return "••••";
	return `${key.slice(0, 3)}…${key.slice(-4)}`;
}
