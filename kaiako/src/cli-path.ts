/**
 * Resolve node/npm/pi for Obsidian’s Electron process.
 *
 * macOS GUI apps (Dock / Finder) do not inherit the user’s shell PATH, so
 * `spawn("npm")` fails with ENOENT even when `npm` works in Terminal.
 */
import { execFile, spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execFileAsync = promisify(execFile);

const isWin = process.platform === "win32";
const pathSep = path.delimiter;

const SAFE_BIN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const hitCache = new Map<string, string | null>();
let pathCache: Promise<string> | null = null;

export function forgetResolvedCli(name?: string): void {
	if (name) hitCache.delete(name);
	else hitCache.clear();
}

export function missingToolError(name: string): Error {
	if (name === "npm" || name === "node") {
		return new Error("Install Node.js, then retry.");
	}
	if (name === "pi") {
		return new Error("Install Node.js, then retry. The pi command was not found.");
	}
	return new Error(`Install Node.js, then retry. Could not find ${name}.`);
}

export function wrapSpawnError(name: string, err: unknown): Error {
	const code = err && typeof err === "object" && "code" in err ? (err as { code?: unknown }).code : undefined;
	if (code === "ENOENT") return missingToolError(name);
	return err instanceof Error ? err : new Error(String(err));
}

export async function resolvedPath(): Promise<string> {
	if (!pathCache) pathCache = buildResolvedPath();
	return pathCache;
}

export async function cliEnv(extra: NodeJS.ProcessEnv = {}): Promise<NodeJS.ProcessEnv> {
	return { ...process.env, ...extra, PATH: await resolvedPath() };
}

export async function resolveCli(name: string): Promise<string | null> {
	if (!SAFE_BIN.test(name)) return null;
	if (hitCache.has(name)) return hitCache.get(name) ?? null;

	const found =
		findInDirs(name, pathDirs(process.env.PATH).concat(commonBinDirs())) ??
		findInDirs(name, pathDirs(await resolvedPath())) ??
		(await whichFromLoginShell(name));
	hitCache.set(name, found);
	return found;
}

/** After `npm install -g`, remember the new bin from npm's global prefix. */
export async function rememberGlobalNpmBin(name: string): Promise<string | null> {
	forgetResolvedCli(name);
	try {
		const { stdout } = await execNpm(["prefix", "-g"], { timeout: 8000 });
		const prefix = stdout.trim();
		const candidates = isWin
			? [path.join(prefix, `${name}.cmd`), path.join(prefix, `${name}.exe`), path.join(prefix, name)]
			: [path.join(prefix, "bin", name), path.join(prefix, name)];
		for (const candidate of candidates) {
			if (looksExecutable(candidate)) {
				hitCache.set(name, candidate);
				return candidate;
			}
		}
	} catch {
		/* prefix lookup is best-effort */
	}
	return resolveCli(name);
}

export async function execCli(
	name: string,
	args: string[],
	options: { timeout?: number; cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string }> {
	const bin = await resolveCli(name);
	if (!bin) throw missingToolError(name);
	try {
		const result = await execFileAsync(bin, args, {
			timeout: options.timeout ?? 30000,
			cwd: options.cwd,
			env: await cliEnv(options.env),
			shell: isWin,
			windowsHide: true,
			encoding: "utf8",
		});
		return { stdout: String(result.stdout), stderr: String(result.stderr) };
	} catch (err) {
		throw wrapSpawnError(name, err);
	}
}

export async function execNpm(
	args: string[],
	options: { timeout?: number; cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string }> {
	const env = await cliEnv(options.env);
	const invocation = await npmInvocation();
	if (!invocation) throw missingToolError("npm");
	try {
		const result = await execFileAsync(invocation.command, [...invocation.prefixArgs, ...args], {
			timeout: options.timeout ?? 120000,
			cwd: options.cwd,
			env,
			shell: isWin && invocation.prefixArgs.length === 0,
			windowsHide: true,
			encoding: "utf8",
		});
		return { stdout: String(result.stdout), stderr: String(result.stderr) };
	} catch (err) {
		throw wrapSpawnError("npm", err);
	}
}

export async function spawnCli(
	name: string,
	args: string[],
	options: SpawnOptions = {},
): Promise<ChildProcess> {
	const bin = await resolveCli(name);
	if (!bin) throw missingToolError(name);
	try {
		return spawn(bin, args, {
			...options,
			shell: options.shell ?? isWin,
			env: await cliEnv((options.env as NodeJS.ProcessEnv | undefined) ?? {}),
		});
	} catch (err) {
		throw wrapSpawnError(name, err);
	}
}

async function npmInvocation(): Promise<{ command: string; prefixArgs: string[] } | null> {
	const node = await resolveCli("node");
	if (node) {
		const cli = npmCliJsNear(node);
		if (cli) return { command: node, prefixArgs: [cli] };
	}
	const npm = await resolveCli("npm");
	if (npm) return { command: npm, prefixArgs: [] };
	if (node) {
		const corepack = npmCliSibling(node, "corepack");
		if (corepack) return { command: node, prefixArgs: [corepack, "npm"] };
	}
	return null;
}

function npmCliJsNear(nodeBin: string): string | null {
	const dir = path.dirname(nodeBin);
	const candidates = [
		path.join(dir, "node_modules", "npm", "bin", "npm-cli.js"),
		path.join(dir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

function npmCliSibling(nodeBin: string, tool: "corepack"): string | null {
	const dir = path.dirname(nodeBin);
	const candidates = [
		path.join(dir, "node_modules", tool, "dist", `${tool}.js`),
		path.join(dir, "..", "lib", "node_modules", tool, "dist", `${tool}.js`),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

async function buildResolvedPath(): Promise<string> {
	const dirs = [
		...commonBinDirs(),
		...pathDirs(await loginShellPath()),
		...pathDirs(await windowsUserMachinePath()),
		...pathDirs(process.env.PATH),
		...pathDirs(process.env.Path),
	];
	return uniqueDirs(dirs).join(pathSep);
}

function pathDirs(value: string | undefined | null): string[] {
	if (!value) return [];
	return value.split(pathSep).map((part) => part.trim()).filter(Boolean);
}

function uniqueDirs(dirs: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const dir of dirs) {
		const normalized = dir.replace(/[/\\]+$/, "");
		const key = isWin ? normalized.toLowerCase() : normalized;
		if (!normalized || seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}

function commonBinDirs(): string[] {
	const home = os.homedir();
	const dirs: string[] = [];

	if (process.platform === "darwin") {
		dirs.push("/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", "/opt/local/bin");
		dirs.push(...versionBinDirs("/usr/local/opt", "bin"));
	}
	if (process.platform === "linux") {
		dirs.push("/usr/local/bin", "/usr/bin", path.join(home, ".local", "bin"));
	}
	if (isWin) {
		const local = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
		const roaming = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
		const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
		const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
		dirs.push(
			path.join(programFiles, "nodejs"),
			path.join(programFilesX86, "nodejs"),
			path.join(roaming, "npm"),
			path.join(local, "fnm"),
			path.join(home, "scoop", "shims"),
			path.join(home, "AppData", "Roaming", "fnm"),
		);
		if (process.env.NVM_SYMLINK) dirs.push(process.env.NVM_SYMLINK);
		if (process.env.NVM_HOME) dirs.push(process.env.NVM_HOME);
	}

	const nvmDefault = nvmDefaultBinDir(home);
	if (nvmDefault) dirs.unshift(nvmDefault);

	dirs.push(
		path.join(home, ".volta", "bin"),
		path.join(home, ".asdf", "shims"),
		path.join(home, ".local", "share", "fnm", "aliases", "default", "bin"),
		path.join(home, ".fnm", "aliases", "default", "bin"),
		path.join(home, ".nodenv", "shims"),
		path.join(home, ".yarn", "bin"),
		path.join(home, ".npm-global", "bin"),
		path.join(home, ".local", "bin"),
	);
	if (process.platform === "darwin") {
		dirs.push(
			path.join(home, "Library", "Application Support", "fnm", "aliases", "default", "bin"),
		);
	}

	dirs.push(...versionBinDirs(path.join(home, ".nvm", "versions", "node"), "bin"));
	dirs.push(...versionBinDirs(path.join(home, ".local", "share", "fnm", "node-versions"), path.join("installation", "bin")));
	dirs.push(...versionBinDirs(path.join(home, ".fnm", "node-versions"), path.join("installation", "bin")));
	if (process.platform === "darwin") {
		dirs.push(
			...versionBinDirs(
				path.join(home, "Library", "Application Support", "fnm", "node-versions"),
				path.join("installation", "bin"),
			),
		);
	}
	dirs.push(...versionBinDirs(path.join(home, ".asdf", "installs", "nodejs"), "bin"));
	dirs.push(...versionBinDirs(path.join(home, ".nodenv", "versions"), "bin"));
	dirs.push(...versionBinDirs("/usr/local/n/versions/node", "bin"));
	dirs.push(...versionBinDirs("/opt/homebrew/opt", "bin"));

	return dirs.filter((dir) => {
		try {
			return fs.existsSync(dir);
		} catch {
			return false;
		}
	});
}

function nvmDefaultBinDir(home: string): string | null {
	const aliasFile = path.join(home, ".nvm", "alias", "default");
	try {
		if (!fs.existsSync(aliasFile)) return null;
		const alias = fs.readFileSync(aliasFile, "utf8").trim();
		if (!alias || alias.includes("..")) return null;
		const bin = path.join(home, ".nvm", "versions", "node", alias.startsWith("v") ? alias : `v${alias}`, "bin");
		return fs.existsSync(bin) ? bin : null;
	} catch {
		return null;
	}
}

function versionBinDirs(root: string, binSubpath: string): string[] {
	if (!fs.existsSync(root)) return [];
	let names: string[] = [];
	try {
		names = fs.readdirSync(root);
	} catch {
		return [];
	}
	names.sort().reverse();
	const out: string[] = [];
	for (const name of names) {
		if (root.endsWith(`${path.sep}opt`) && !/^node(@|$)/i.test(name)) continue;
		const bin = path.join(root, name, binSubpath);
		if (fs.existsSync(bin)) out.push(bin);
	}
	return out;
}

function findInDirs(name: string, dirs: string[]): string | null {
	for (const dir of uniqueDirs(dirs)) {
		for (const candidate of binCandidates(dir, name)) {
			if (looksExecutable(candidate)) return candidate;
		}
	}
	return null;
}

function binCandidates(dir: string, name: string): string[] {
	const base = path.join(dir, name);
	if (!isWin) return [base];
	const exts = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
		.split(";")
		.map((ext) => ext.trim())
		.filter(Boolean);
	const out = [base];
	for (const ext of exts) {
		out.push(base + ext);
		out.push(base + ext.toLowerCase());
	}
	return out;
}

function looksExecutable(file: string): boolean {
	try {
		const st = fs.statSync(file);
		if (!st.isFile()) return false;
		if (isWin) return true;
		return (st.mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

async function whichFromLoginShell(name: string): Promise<string | null> {
	if (!SAFE_BIN.test(name)) return null;
	if (isWin) {
		try {
			const { stdout } = await execFileAsync("where.exe", [name], {
				timeout: 4000,
				windowsHide: true,
				env: { ...process.env, PATH: await resolvedPath() },
				encoding: "utf8",
			});
			for (const line of String(stdout).split(/\r?\n/)) {
				const candidate = line.trim();
				if (candidate && looksExecutable(candidate)) return candidate;
			}
		} catch {
			return null;
		}
		return null;
	}
	const shell = process.env.SHELL || "/bin/zsh";
	try {
		const { stdout } = await execFileAsync(shell, ["-lic", `command -v ${name}`], {
			timeout: 6000,
			env: { ...process.env, TERM: "dumb" },
			encoding: "utf8",
		});
		for (const line of String(stdout).split(/\r?\n/)) {
			const candidate = line.trim();
			if (candidate.startsWith("/") && looksExecutable(candidate)) return candidate;
		}
	} catch {
		return null;
	}
	return null;
}

async function loginShellPath(): Promise<string | null> {
	if (isWin) return null;
	const shell = process.env.SHELL || "/bin/zsh";
	try {
		const { stdout } = await execFileAsync(
			shell,
			["-lc", "printf '%s' \"$PATH\""],
			{
				timeout: 6000,
				env: { ...process.env, TERM: "dumb" },
				encoding: "utf8",
			},
		);
		const value = String(stdout).trim();
		return value || null;
	} catch {
		return null;
	}
}

async function windowsUserMachinePath(): Promise<string | null> {
	if (!isWin) return null;
	try {
		const { stdout } = await execFileAsync(
			"powershell.exe",
			[
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				"[Environment]::GetEnvironmentVariable('Path','User') + ';' + [Environment]::GetEnvironmentVariable('Path','Machine')",
			],
			{ timeout: 6000, windowsHide: true, encoding: "utf8" },
		);
		const value = String(stdout).trim();
		return value || null;
	} catch {
		return null;
	}
}
