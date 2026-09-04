import { FileSystemAdapter, normalizePath, type App } from "obsidian";
import * as fs from "fs";
import * as path from "path";

export type ProviderId =
	| "claude"
	| "openai"
	| "gemini"
	| "qwen-cloud"
	| "deepseek"
	| "openrouter";

export const PROVIDER_ICON_FILES: Record<ProviderId, string> = {
	claude: "claude.svg",
	openai: "openai.svg",
	gemini: "gemini.svg",
	"qwen-cloud": "qwen-cloud.svg",
	deepseek: "deepseek.svg",
	openrouter: "openrouter.svg",
};

export interface ProviderDef {
	id: ProviderId;
	label: string;
	model: string;
	hint: string;
}

/** Qwen Cloud = Alibaba Cloud Model Studio (DashScope), OpenAI-compatible. */
export const PROVIDERS: ProviderDef[] = [
	{
		id: "claude",
		label: "Claude",
		model: "claude-sonnet-4-5",
		hint: "Anthropic API key",
	},
	{
		id: "openai",
		label: "OpenAI",
		model: "gpt-4.1",
		hint: "OpenAI API key",
	},
	{
		id: "gemini",
		label: "Gemini",
		model: "gemini-2.5-pro",
		hint: "Google AI Studio key",
	},
	{
		id: "qwen-cloud",
		label: "Qwen Cloud",
		model: "qwen-plus",
		hint: "DashScope / Model Studio key (cloud)",
	},
	{
		id: "deepseek",
		label: "DeepSeek",
		model: "deepseek-v4-flash",
		hint: "DeepSeek API key",
	},
	{
		id: "openrouter",
		label: "OpenRouter",
		model: "openrouter/auto",
		hint: "OpenRouter API key",
	},
];

export const ONBOARDING_PROVIDER_IDS: ProviderId[] = ["openai", "claude", "qwen-cloud"];

const iconDataUrlCache = new Map<string, string>();

/**
 * Settings used pathToFileURL on the vault-relative plugin dir, which became
 * file:///.obsidian/... and 404'd. Embed the SVG as a data URL from disk.
 */
export function providerIconUrl(app: App, pluginDir: string | undefined, id: ProviderId): string {
	if (!pluginDir) return "";
	const file = PROVIDER_ICON_FILES[id];
	const cacheKey = `${pluginDir}/${file}`;
	const cached = iconDataUrlCache.get(cacheKey);
	if (cached) return cached;

	const adapter = app.vault.adapter;
	if (adapter instanceof FileSystemAdapter) {
		const fullPath = path.join(adapter.getBasePath(), pluginDir, "assets", "providers", file);
		try {
			const url = `data:image/svg+xml;base64,${fs.readFileSync(fullPath).toString("base64")}`;
			iconDataUrlCache.set(cacheKey, url);
			return url;
		} catch {
			/* fall through to Obsidian resource URL */
		}
	}

	return adapter.getResourcePath(normalizePath(`${pluginDir}/assets/providers/${file}`));
}

export function appendProviderLogo(
	parent: HTMLElement,
	app: App,
	pluginDir: string | undefined,
	id: ProviderId,
	className: string,
): HTMLImageElement {
	const label = getProvider(id)?.label ?? id;
	return parent.createEl("img", {
		cls: className,
		attr: {
			src: providerIconUrl(app, pluginDir, id),
			alt: `${label} logo`,
			draggable: "false",
		},
	});
}

export function onboardingProviders(): ProviderDef[] {
	return ONBOARDING_PROVIDER_IDS.map((id) => getProvider(id)).filter(
		(item): item is ProviderDef => item !== null,
	);
}

export function providerMark(id: ProviderId): string {
	if (id === "openai") return "O";
	if (id === "claude") return "C";
	if (id === "qwen-cloud") return "Q";
	return id.slice(0, 1).toUpperCase();
}

export function getProvider(id: ProviderId | null): ProviderDef | null {
	if (!id) return null;
	return PROVIDERS.find((p) => p.id === id) ?? null;
}

export function piProviderFlag(id: ProviderId): string {
	if (id === "claude") return "anthropic";
	if (id === "gemini") return "google";
	if (id === "qwen-cloud") return "openai";
	return id;
}

export function envForApiKey(id: ProviderId, key: string): Record<string, string> {
	if (id === "claude") return { ANTHROPIC_API_KEY: key };
	if (id === "openai") return { OPENAI_API_KEY: key };
	if (id === "gemini") return { GEMINI_API_KEY: key, GOOGLE_API_KEY: key };
	if (id === "qwen-cloud") {
		return {
			OPENAI_API_KEY: key,
			DASHSCOPE_API_KEY: key,
			OPENAI_BASE_URL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
			OPENAI_MODEL: "qwen-plus",
		};
	}
	if (id === "deepseek") return { DEEPSEEK_API_KEY: key };
	return { OPENROUTER_API_KEY: key };
}
