import { FileSystemAdapter, Platform, type App } from "obsidian";
import { spawn, type ChildProcess } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { activeKey, type KaiakoConfig } from "./config";
import { envForApiKey, getProvider, piProviderFlag } from "./providers";
import { syncPiHarness } from "./skills-sync";

const execFileAsync = promisify(execFile);
export const PI_PACKAGE = "@earendil-works/pi-coding-agent";

export interface PiListeners {
	onTools?: (active: boolean, toolName?: string) => void;
	onText?: (chunk: string) => void;
	onDone?: (full: string, usage?: { cost?: number }) => void;
	onError?: (message: string) => void;
	onThinking?: (active: boolean) => void;
}

export async function detectPiHarness(): Promise<{ found: boolean; version: string | null }> {
	try {
		const { stdout } = await execFileAsync("pi", ["--version"], {
			timeout: 4000,
			shell: Platform.isWin,
		});
		return { found: true, version: stdout.trim() || "installed" };
	} catch {
		try {
			const cmd = Platform.isWin ? "where" : "which";
			await execFileAsync(cmd, ["pi"], { timeout: 4000, shell: Platform.isWin });
			return { found: true, version: "installed" };
		} catch {
			return { found: false, version: null };
		}
	}
}

export async function installPiHarness(): Promise<{ found: boolean; version: string | null }> {
	await execFileAsync("npm", ["install", "--global", "--ignore-scripts", PI_PACKAGE], {
		timeout: 120000,
		shell: Platform.isWin,
	});
	return detectPiHarness();
}

export async function uninstallPiHarness(): Promise<void> {
	await execFileAsync("npm", ["uninstall", "--global", "--ignore-scripts", PI_PACKAGE], {
		timeout: 120000,
		shell: Platform.isWin,
	});
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

	stop(): void {
		if (!this.proc) return;
		this.proc.kill();
		this.proc = null;
		this.buf = "";
	}

	setPluginDir(dir: string): void {
		this.pluginDir = dir;
	}

	async linkHarness(config: KaiakoConfig): Promise<void> {
		if (!config.dataFolder) throw new Error("Choose a data folder first.");
		if (this.pluginDir) await syncPiHarness(this.pluginDir, config.dataFolder);
		await writeNetSearchConfig(config);
	}

	async unlinkAndDeleteHarness(config: KaiakoConfig): Promise<void> {
		this.stop();
		await uninstallPiHarness();
		if (config.dataFolder) {
			await fs.promises.rm(path.join(config.dataFolder, "pi"), { recursive: true, force: true });
		}
	}

	async sync(app: App, config: KaiakoConfig): Promise<void> {
		if (config.dataFolder && this.pluginDir) {
			await syncPiHarness(this.pluginDir, config.dataFolder);
		}
		await writeNetSearchConfig(config);
		if (config.netSearch) void this.ensureWebAccess(config);
		if (config.autoStartPi) {
			await this.ensure(app, config);
		} else {
			this.stop();
		}
	}

	async ensure(app: App, config: KaiakoConfig): Promise<{ ok: boolean; detail: string }> {
		const detected = await detectPiHarness();
		if (!detected.found) return { ok: false, detail: "pi was not found on PATH." };
		if (!config.dataFolder) return { ok: false, detail: "Choose a data folder first." };
		if (this.pluginDir) await syncPiHarness(this.pluginDir, config.dataFolder);
		if (this.proc && !this.proc.killed) return { ok: true, detail: "running" };

		const cwd = vaultBasePath(app) ?? config.dataFolder;
		const piDir = path.join(config.dataFolder, "pi");
		const sessionDir = path.join(piDir, "sessions");
		await fs.promises.mkdir(sessionDir, { recursive: true });
		await writeNetSearchConfig(config);

		const key = activeKey(config);
		const provider = key ? piProviderFlag(key.provider) : undefined;
		const model = key ? getProvider(key.provider)?.model : undefined;
		const args = ["--mode", "rpc", "--session-dir", sessionDir];
		if (provider) args.push("--provider", provider);
		if (model) args.push("--model", model);

		this.proc = spawn("pi", args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			shell: Platform.isWin,
			env: {
				...process.env,
				PI_CODING_AGENT_DIR: piDir,
				...(key ? envForApiKey(key.provider, key.key) : {}),
			},
		});
		this.buf = "";
		this.proc.stdout?.on("data", (chunk: Buffer) => this.onChunk(chunk.toString("utf8")));
		this.proc.stderr?.on("data", (chunk: Buffer) => {
			console.warn("[kaiako pi]", chunk.toString("utf8"));
		});
		this.proc.on("exit", () => {
			this.proc = null;
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
			await execFileAsync("pi", ["install", "npm:pi-web-access"], {
				timeout: 120000,
				env: { ...process.env, PI_CODING_AGENT_DIR: piDir },
				shell: Platform.isWin,
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
	const payload = {
		provider: "exa",
		webSearch: { enabled: config.netSearch },
		tools: {
			webSearch: { enabled: config.netSearch },
			fetchContent: { enabled: config.netSearch },
			getSearchContent: { enabled: config.netSearch },
		},
	};
	const local = path.join(config.dataFolder, "web-search.json");
	await fs.promises.mkdir(config.dataFolder, { recursive: true });
	await fs.promises.writeFile(local, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
	const homePi = path.join(os.homedir(), ".pi", "web-search.json");
	try {
		await fs.promises.mkdir(path.dirname(homePi), { recursive: true });
		await fs.promises.writeFile(homePi, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
	} catch {
		/* best-effort */
	}
}
