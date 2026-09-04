import * as fs from "fs";
import * as path from "path";
import {
	CONFIG_ARTIFACTS,
	DEFAULT_CONFIG,
	mergeConfig,
	type DiskConfig,
	type KaiakoConfig,
} from "./config";

const YAML_NAME = "kaiako.yaml";

export function yamlPath(folder: string): string {
	return path.join(folder, YAML_NAME);
}

export function toDisk(config: KaiakoConfig): DiskConfig {
	const { onboarded: _onboarded, dataFolder: _dataFolder, ...rest } = config;
	return rest;
}

export function dumpYaml(config: KaiakoConfig): string {
	return `# Kaiako config. Vault markdown notes are not stored here.\n---\n${JSON.stringify(toDisk(config), null, 2)}\n`;
}

export function parseYaml(text: string): Partial<DiskConfig> {
	const stripped = text.replace(/^[\s\S]*?^---\s*$/m, "").trim() || text.trim();
	try {
		return JSON.parse(stripped) as Partial<DiskConfig>;
	} catch {
		return {};
	}
}

export async function ensureDataLayout(folder: string): Promise<void> {
	await fs.promises.mkdir(folder, { recursive: true });
	await fs.promises.mkdir(path.join(folder, "skills"), { recursive: true });
	await fs.promises.mkdir(path.join(folder, "pi"), { recursive: true });
	const skillsReadme = path.join(folder, "skills", "README.md");
	if (!fs.existsSync(skillsReadme)) {
		await fs.promises.writeFile(
			skillsReadme,
			"# Kaiako skills\n\nPi copies project skills here and into `pi/skills` on sync. Chat markdown stays in the Obsidian vault.\n",
			"utf-8",
		);
	}
}

export async function writeYaml(config: KaiakoConfig): Promise<void> {
	if (!config.dataFolder) return;
	await ensureDataLayout(config.dataFolder);
	await fs.promises.writeFile(yamlPath(config.dataFolder), dumpYaml(config), "utf-8");
}

export async function readYaml(folder: string): Promise<Partial<DiskConfig>> {
	const file = yamlPath(folder);
	if (!fs.existsSync(file)) return {};
	return parseYaml(await fs.promises.readFile(file, "utf-8"));
}

export async function hydrateConfig(config: KaiakoConfig): Promise<KaiakoConfig> {
	if (!config.dataFolder) return config;
	try {
		const disk = await readYaml(config.dataFolder);
		return mergeConfig({ ...config, ...disk, dataFolder: config.dataFolder, onboarded: config.onboarded });
	} catch {
		return config;
	}
}

export async function moveConfigArtifacts(from: string, to: string): Promise<void> {
	if (!from || !to || path.resolve(from) === path.resolve(to)) return;
	await ensureDataLayout(to);
	for (const name of CONFIG_ARTIFACTS) {
		const src = path.join(from, name);
		const dest = path.join(to, name);
		if (!fs.existsSync(src)) continue;
		if (fs.existsSync(dest)) {
			await fs.promises.rm(dest, { recursive: true, force: true });
		}
		try {
			await fs.promises.rename(src, dest);
		} catch {
			await fs.promises.cp(src, dest, { recursive: true });
			await fs.promises.rm(src, { recursive: true, force: true });
		}
	}
	await writeYaml(mergeConfig({ ...DEFAULT_CONFIG, dataFolder: to, ...(await readYaml(to)) }));
}
