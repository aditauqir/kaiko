import * as fs from "fs";
import * as path from "path";
import { execNpm } from "./cli-path";

const SKILL_FOLDERS = ["teach", "visualize", "harness"] as const;

const MARKDOWN_SKILLS: { rel: string; folder: string }[] = [
	{ rel: path.join("my_skill", "STOP_SLOP.md"), folder: "stop-slop" },
	{ rel: path.join("my_skill", "ASD-STE100MD.md"), folder: "asd-ste100-markdown" },
];

const SKIP_NAMES = new Set([".git", "node_modules"]);

export function learnRootFromPlugin(pluginDir: string): string {
	const resolved = resolveExisting(pluginDir);
	return path.resolve(resolved, "..");
}

function resolveExisting(pluginDir: string): string {
	const candidates = [pluginDir, path.resolve(pluginDir)];
	for (const candidate of candidates) {
		if (!candidate || !fs.existsSync(candidate)) continue;
		try {
			return fs.realpathSync(candidate);
		} catch {
			return path.resolve(candidate);
		}
	}
	return path.resolve(pluginDir);
}

export function bundledSkillsRoot(pluginDir: string): string {
	return path.join(learnRootFromPlugin(pluginDir), "skills");
}

function shouldCopy(src: string): boolean {
	return !SKIP_NAMES.has(path.basename(src));
}

async function copyDir(src: string, dest: string): Promise<boolean> {
	if (!fs.existsSync(src)) return false;
	await fs.promises.mkdir(path.dirname(dest), { recursive: true });
	await fs.promises.cp(src, dest, {
		recursive: true,
		force: true,
		filter: shouldCopy,
	});
	return true;
}

async function copyMarkdownSkill(srcFile: string, destDir: string): Promise<boolean> {
	if (!fs.existsSync(srcFile)) return false;
	await fs.promises.mkdir(destDir, { recursive: true });
	await fs.promises.copyFile(srcFile, path.join(destDir, "SKILL.md"));
	return true;
}

async function mergeChildren(src: string, dest: string): Promise<number> {
	if (!fs.existsSync(src)) return 0;
	const entries = await fs.promises.readdir(src, { withFileTypes: true });
	let count = 0;
	for (const entry of entries) {
		if (SKIP_NAMES.has(entry.name) || entry.name.startsWith(".")) continue;
		const from = path.join(src, entry.name);
		const to = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			if (await copyDir(from, to)) count += 1;
		} else if (entry.isFile()) {
			await fs.promises.mkdir(dest, { recursive: true });
			await fs.promises.copyFile(from, to);
			count += 1;
		}
	}
	return count;
}

/** Copy workspace skills/extensions/agents into the Pi agent dir and data-folder skills. */
export async function syncPiHarness(pluginDir: string, dataFolder: string): Promise<string[]> {
	if (!pluginDir || !dataFolder) return [];

	const learnRoot = learnRootFromPlugin(pluginDir);
	const skillsSrc = path.join(learnRoot, "skills");
	const piDot = path.join(skillsSrc, ".pi");
	const installed: string[] = [];

	const publicSkills = path.join(dataFolder, "skills");
	const piDir = path.join(dataFolder, "pi");
	const piSkills = path.join(piDir, "skills");
	await fs.promises.mkdir(publicSkills, { recursive: true });
	await fs.promises.mkdir(piSkills, { recursive: true });
	await fs.promises.mkdir(path.join(piDir, "extensions"), { recursive: true });
	await fs.promises.mkdir(path.join(piDir, "agents"), { recursive: true });

	for (const folder of SKILL_FOLDERS) {
		const src = path.join(skillsSrc, folder);
		const alt = path.join(piDot, "skills", folder);
		const from = fs.existsSync(src) ? src : alt;
		if (!fs.existsSync(from)) continue;
		await copyDir(from, path.join(publicSkills, folder));
		await copyDir(from, path.join(piSkills, folder));
		installed.push(folder);
	}

	for (const item of MARKDOWN_SKILLS) {
		const src = path.join(skillsSrc, item.rel);
		if (!fs.existsSync(src)) continue;
		await copyMarkdownSkill(src, path.join(publicSkills, item.folder));
		await copyMarkdownSkill(src, path.join(piSkills, item.folder));
		installed.push(item.folder);
	}

	const extensionSources = [path.join(piDot, "extensions"), path.join(learnRoot, "extensions")];
	for (const src of extensionSources) {
		await mergeChildren(src, path.join(piDir, "extensions"));
	}

	await mergeChildren(path.join(piDot, "agents"), path.join(piDir, "agents"));

	const visualTools = path.join(piDir, "extensions", "visual-tools");
	if (fs.existsSync(path.join(visualTools, "package.json"))) {
		void npmInstallOptional(visualTools);
	}

	return [...new Set(installed)];
}

async function npmInstallOptional(dir: string): Promise<void> {
	if (fs.existsSync(path.join(dir, "node_modules"))) return;
	try {
		await execNpm(["install", "--omit=dev"], {
			cwd: dir,
			timeout: 120000,
		});
	} catch {
		/* optional; mermaid/svg tools work after a manual install */
	}
}
