import { FileSystemAdapter, type App } from "obsidian";
import type { ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execCli, execNpm, forgetResolvedCli, rememberGlobalNpmBin, spawnCli } from "./cli-path";
import { activeKey, type KaiakoConfig } from "./config";
import { envForApiKey, getProvider, piProviderFlag } from "./providers";
import { syncPiHarness } from "./skills-sync";

export const PI_PACKAGE = "@earendil-works/pi-coding-agent";

export interface PiListeners {
	onTools?: (active: boolean, toolName?: string) => void;
	onText?: (chunk: string) => void;
	onDone?: (full: string, usage?: { cost?: number }) => void;
	onError?: (message: string) => void;
	onThinking?: (active: boolean) => void;
}

let detectedPiCache: { found: boolean; version: string | null; checkedAt: number } | null = null;
let detectingPiPromise: Promise<{ found: boolean; version: string | null }> | null = null;

export function invalidatePiDetection(): void {
	detectedPiCache = null;
	detectingPiPromise = null;
	forgetResolvedCli("pi");
}

export async function detectPiHarness(force = false): Promise<{ found: boolean; version: string | null }> {
	const now = Date.now();
	if (!force && detectedPiCache && now - detectedPiCache.checkedAt < 30000) {
		return { found: detectedPiCache.found, version: detectedPiCache.version };
	}
	if (detectingPiPromise) return detectingPiPromise;

	detectingPiPromise = (async () => {
		try {
			const { stdout } = await execCli("pi", ["--version"], { timeout: 4000 });
			const res = { found: true, version: stdout.trim() || "installed" };
			detectedPiCache = { ...res, checkedAt: Date.now() };
			return res;
		} catch {
			const res = { found: false, version: null };
			detectedPiCache = { ...res, checkedAt: Date.now() };
			return res;
		} finally {
			detectingPiPromise = null;
		}
	})();

	return detectingPiPromise;
}

export async function installPiHarness(): Promise<{ found: boolean; version: string | null }> {
	invalidatePiDetection();
	await execNpm(["install", "--global", "--ignore-scripts", PI_PACKAGE], { timeout: 120000 });
	await rememberGlobalNpmBin("pi");
	invalidatePiDetection();
	const detected = await detectPiHarness(true);
	if (!detected.found) {
		throw new Error("Install Node.js, then retry. Pi was installed but the pi command is still not available.");
	}
	return detected;
}

export async function uninstallPiHarness(): Promise<void> {
	await execNpm(["uninstall", "--global", "--ignore-scripts", PI_PACKAGE], { timeout: 120000 });
	invalidatePiDetection();
}

export function vaultBasePath(app: App): string | null {
	const adapter = app.vault.adapter;
	if (adapter instanceof FileSystemAdapter) return adapter.getBasePath();
	return null;
}


export class PiHost {
	private proc: ChildProcess | null = null;
	private buf = "";
	private toolCount = 0;
	private assistant = "";
	private listeners: PiListeners = {};
	private installing = false;
	private pluginDir = "";
	private turnClosed = false;
	private activeSessionId: string | null = null;

	stop(): void {
		const proc = this.proc;
		this.proc = null;
		this.activeSessionId = null;
		this.buf = "";
		proc?.kill();
	}

	setPluginDir(dir: string): void {
		this.pluginDir = dir;
	}

	async linkHarness(config: KaiakoConfig): Promise<void> {
		if (!config.dataFolder) throw new Error("Choose a data folder first.");
		if (this.pluginDir) await syncPiHarness(this.pluginDir, config.dataFolder);
		await writeNetSearchConfig(config);
		invalidatePiDetection();
	}

	async unlinkAndDeleteHarness(config: KaiakoConfig): Promise<void> {
		this.stop();
		await uninstallPiHarness();
		if (config.dataFolder) {
			await fs.promises.rm(path.join(config.dataFolder, "pi"), { recursive: true, force: true });
		}
		invalidatePiDetection();
	}

	async sync(app: App, config: KaiakoConfig): Promise<void> {
		if (config.dataFolder && this.pluginDir) {
			await syncPiHarness(this.pluginDir, config.dataFolder);
		}
		await writeNetSearchConfig(config);
		if (config.netSearch) void this.ensureWebAccess(config);
		if (config.autoStartPi) {
			await this.ensure(app, config, config.currentSessionId ?? undefined);
		} else {
			this.stop();
		}
	}

	async ensure(app: App, config: KaiakoConfig, sessionId?: string): Promise<{ ok: boolean; detail: string }> {
		const detected = await detectPiHarness();
		if (!detected.found) return { ok: false, detail: "Install Node.js, then retry. The pi command was not found." };
		if (!config.dataFolder) return { ok: false, detail: "Choose a data folder first." };
		if (this.pluginDir) await syncPiHarness(this.pluginDir, config.dataFolder);
		if (this.proc && !this.proc.killed && this.activeSessionId === (sessionId ?? null)) {
			return { ok: true, detail: "running" };
		}
		if (this.proc) this.stop();

		const cwd = vaultBasePath(app) ?? config.dataFolder;
		const piDir = path.join(config.dataFolder, "pi");
		const sessionDir = path.join(piDir, "sessions");
		await fs.promises.mkdir(sessionDir, { recursive: true });
		await writeNetSearchConfig(config);

		const key = activeKey(config);
		const provider = key ? piProviderFlag(key.provider) : undefined;
		const model = key ? getProvider(key.provider)?.model : undefined;
		const args = ["--mode", "rpc", "--session-dir", sessionDir, "--approve"];
		if (sessionId) args.push("--session-id", sessionId);
		if (provider) args.push("--provider", provider);
		if (model) args.push("--model", model);

		const proc = await spawnCli("pi", args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				PI_CODING_AGENT_DIR: piDir,
				...(key ? envForApiKey(key.provider, key.key) : {}),
			},
		});
		this.proc = proc;
		this.activeSessionId = sessionId ?? null;
		this.buf = "";
		proc.stdout?.on("data", (chunk: Buffer) => this.onChunk(chunk.toString("utf8")));
		proc.stderr?.on("data", (chunk: Buffer) => {
			console.warn("[kaiako pi]", chunk.toString("utf8"));
		});
		proc.on("error", (err) => {
			console.warn("[kaiako pi]", err);
			if (this.proc === proc) {
				this.proc = null;
				this.activeSessionId = null;
			}
		});
		proc.on("exit", () => {
			if (this.proc === proc) {
				this.proc = null;
				this.activeSessionId = null;
			}
		});
		return { ok: true, detail: `rpc in ${cwd}` };
	}

	setListeners(listeners: PiListeners): void {
		this.listeners = listeners;
	}

	prompt(text: string): void {
		this.assistant = "";
		this.turnClosed = false;
		this.bumpTools(-this.toolCount);
		this.listeners.onThinking?.(true);
		this.send({ type: "prompt", message: text, streamingBehavior: "followUp" });
	}

	setModel(provider: string, model: string): void {
		this.send({ type: "set_model", model: `${provider}/${model}` });
	}

	private send(payload: Record<string, unknown>): void {
		if (!this.proc?.stdin) return;
		this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
	}

	private onChunk(text: string): void {
		this.buf += text;
		while (true) {
			const idx = this.buf.indexOf("\n");
			if (idx < 0) break;
			const line = this.buf.slice(0, idx).replace(/\r$/, "");
			this.buf = this.buf.slice(idx + 1);
			if (line.trim()) this.onLine(line);
		}
	}

	private onLine(line: string): void {
		let event: Record<string, unknown>;
		try {
			event = JSON.parse(line) as Record<string, unknown>;
		} catch {
			return;
		}
		const type = String(event.type ?? "");
		if (type === "agent_start" || type === "turn_start") {
			this.listeners.onThinking?.(true);
		}
		if (type === "message_update") {
			const delta = event.assistantMessageEvent as {
				type?: string;
				delta?: string;
				toolName?: string;
			} | undefined;
			if (delta?.type === "text_delta" && delta.delta) {
				this.assistant += delta.delta;
				this.listeners.onThinking?.(false);
				this.listeners.onText?.(delta.delta);
			}
			if (delta?.type === "thinking_delta" || delta?.type === "thought_delta") {
				this.listeners.onThinking?.(true);
			}
		}
		if (type === "toolcall_start" || type === "tool_execution_start") {
			this.bumpTools(1, toolNameOf(event));
		}
		if (type === "toolcall_end" || type === "tool_execution_end" || type === "tool_execution") {
			this.bumpTools(-1, toolNameOf(event));
		}
		if (type === "agent_settled" || type === "agent_end") {
			this.finishTurn(event);
		}
		if (type === "response" && event.success === false) {
			this.listeners.onThinking?.(false);
			this.listeners.onError?.(String(event.error ?? "pi rejected the prompt"));
		}
	}

	private finishTurn(event: Record<string, unknown>): void {
		if (this.turnClosed) return;
		this.turnClosed = true;
		this.bumpTools(-this.toolCount);
		this.listeners.onThinking?.(false);
		const usage = event.usage as { cost?: number } | undefined;
		this.listeners.onDone?.(this.assistant, usage);
	}

	private bumpTools(delta: number, toolName?: string): void {
		this.toolCount = Math.max(0, this.toolCount + delta);
		this.listeners.onTools?.(this.toolCount > 0, toolName);
	}

	private async ensureWebAccess(config: KaiakoConfig): Promise<void> {
		if (this.installing || !config.dataFolder) return;
		this.installing = true;
		const piDir = path.join(config.dataFolder, "pi");
		await fs.promises.mkdir(piDir, { recursive: true });
		try {
			await execCli("pi", ["install", "npm:pi-web-access"], {
				timeout: 120000,
				env: { PI_CODING_AGENT_DIR: piDir },
			});
		} catch {
			/* optional package */
		} finally {
			this.installing = false;
		}
	}
}

function toolNameOf(event: Record<string, unknown>): string {
	if (typeof event.toolName === "string" && event.toolName) return event.toolName;
	if (typeof event.name === "string" && event.name) return event.name;
	const nested = event.assistantMessageEvent as { toolName?: string } | undefined;
	if (nested?.toolName) return nested.toolName;
	return "";
}

export async function writeNetSearchConfig(config: KaiakoConfig): Promise<void> {
	if (!config.dataFolder) return;
	const autoApprove = config.netSearchAutoApprove ?? true;
	const payload = {
		provider: "exa",
		workflow: autoApprove ? "auto-summary" : "summary-review",
		curator: !autoApprove,
		webSearch: { enabled: config.netSearch },
		tools: {
			webSearch: { enabled: config.netSearch },
			fetchContent: { enabled: config.netSearch },
			getSearchContent: { enabled: config.netSearch },
		},
	};
	const content = `${JSON.stringify(payload, null, 2)}\n`;

	const targets = [
		path.join(config.dataFolder, "web-search.json"),
		path.join(config.dataFolder, "pi", "web-search.json"),
		path.join(os.homedir(), ".pi", "agent", "web-search.json"),
		path.join(os.homedir(), ".pi", "web-search.json"),
	];

	for (const target of targets) {
		try {
			await fs.promises.mkdir(path.dirname(target), { recursive: true });
			await fs.promises.writeFile(target, content, "utf-8");
		} catch {
			/* best-effort for external user paths */
		}
	}
}
