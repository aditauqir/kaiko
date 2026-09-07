import { Notice, Plugin } from "obsidian";
import { pathToFileURL } from "url";
import * as path from "path";
import { KaiakoView, VIEW_TYPE_KAIAKO } from "./kaiako-view";
import { DEFAULT_CONFIG, mergeConfig, type KaiakoConfig } from "./config";
import { hydrateConfig, moveConfigArtifacts, writeYaml } from "./yaml-store";
import { PiHost } from "./pi";
import { getProvider, piProviderFlag } from "./providers";
import { deleteSessionFiles } from "./note-writer";

export default class KaiakoPlugin extends Plugin {
	config: KaiakoConfig = { ...DEFAULT_CONFIG };
	pi = new PiHost();
	private fontStyleEl: HTMLStyleElement | null = null;

	async onload(): Promise<void> {
		this.config = mergeConfig(await this.loadData());
		this.config = await hydrateConfig(this.config);
		this.pi.setPluginDir(this.manifest.dir ?? "");
		this.injectFont();

		this.registerView(VIEW_TYPE_KAIAKO, (leaf) => new KaiakoView(leaf, this));

		this.addRibbonIcon("graduation-cap", "Open Kaiako", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-kaiako",
			name: "Open Kaiako",
			callback: () => {
				void this.activateView();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
			void this.pi.sync(this.app, this.config);
		});
	}

	onunload(): void {
		this.pi.stop();
		this.fontStyleEl?.remove();
		this.fontStyleEl = null;
	}

	async restartOnboarding(keepHarness: boolean): Promise<void> {
		const previous = this.config;
		this.pi.stop();
		await deleteSessionFiles(this.app, previous.sessions);
		if (!keepHarness) await this.pi.unlinkAndDeleteHarness(previous);

		await this.saveConfig({
			onboarded: false,
			provider: null,
			apiKey: "",
			apiKeys: [],
			activeModelId: null,
			name: "",
			pronounSubject: "",
			pronounObject: "",
			about: "",
			dataFolder: keepHarness ? previous.dataFolder : "",
			spendLimitUsd: null,
			requestLimit: null,
			autoStartPi: false,
			netSearch: false,
			baseJump: "medium",
			lockedIn: false,
			harnessLinked: keepHarness ? previous.harnessLinked : false,
			sessions: [],
			currentSessionId: null,
		});
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KAIAKO)) {
			const view = leaf.view;
			if (view instanceof KaiakoView) {
				view.setHarnessState(keepHarness ? previous.harnessLinked : false, null);
				view.reopenOnboarding();
			}
		}
	}

	notifyHarnessState(linked: boolean, version: string | null): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KAIAKO)) {
			const view = leaf.view;
			if (view instanceof KaiakoView) {
				view.setHarnessState(linked, version);
			}
		}
	}

	async saveConfig(partial?: Partial<KaiakoConfig>): Promise<void> {
		const prevAuto = this.config.autoStartPi;
		const prevNet = this.config.netSearch;
		const prevApprove = this.config.netSearchAutoApprove;
		const prevModel = this.config.activeModelId;
		const prevFolder = this.config.dataFolder;
		this.config = mergeConfig({ ...this.config, ...(partial ?? {}) });
		await this.saveData(this.config);
		await writeYaml(this.config);
		if (
			this.config.autoStartPi !== prevAuto ||
			this.config.netSearch !== prevNet ||
			this.config.netSearchAutoApprove !== prevApprove ||
			this.config.dataFolder !== prevFolder
		) {
			void this.pi.sync(this.app, this.config);
		}
		if (this.config.activeModelId !== prevModel) {
			const key = this.config.apiKeys.find((item) => item.id === this.config.activeModelId);
			const def = key ? getProvider(key.provider) : null;
			if (key && def) this.pi.setModel(piProviderFlag(key.provider), def.model);
		}
	}

	async moveDataFolder(next: string): Promise<void> {
		const prev = this.config.dataFolder;
		try {
			if (prev) await moveConfigArtifacts(prev, next);
			await this.saveConfig({ dataFolder: next });
			new Notice("Moved Kaiako config, skills, and pi files. Vault notes were left in place.");
		} catch (error) {
			new Notice("Could not move the data folder.");
			console.error(error);
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_KAIAKO);
		let leaf = existing[0];

		if (!leaf) {
			leaf = workspace.getRightLeaf(false) ?? undefined;
			if (!leaf) return;
			await leaf.setViewState({
				type: VIEW_TYPE_KAIAKO,
				active: true,
			});
		}

		await workspace.revealLeaf(leaf);
	}

	private injectFont(): void {
		const dir = this.manifest.dir;
		if (!dir) return;
		const fontPath = path.join(dir, "assets", "fonts", "LTSuperiorSerif-Regular.otf");
		const fontUrl = pathToFileURL(fontPath).href;
		this.fontStyleEl = document.createElement("style");
		this.fontStyleEl.setAttribute("data-kaiako-font", "1");
		this.fontStyleEl.textContent = `
@font-face {
	font-family: "LT Superior Serif";
	src: url("${fontUrl}") format("opentype");
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}
`;
		document.head.appendChild(this.fontStyleEl);
	}
}
