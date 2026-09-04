import { getProvider, type ProviderId } from "./providers";

export type SessionPhase = "need_goal" | "diagnostic" | "teaching";

export interface DiagnosticItemRecord {
	id: string;
	stem: string;
	difficulty: number;
	correct: boolean;
	dontKnow: boolean;
	chosen: string;
}

export interface SessionMeta {
	id: string;
	title: string;
	filePath: string;
	createdAt: number;
	goal?: string;
	phase?: SessionPhase;
	knowledgeScore?: number;
	knowledgeTheta?: number;
	knowledgeSe?: number;
	teachingEntry?: number;
	accuracy?: number;
	diagnosticItems?: DiagnosticItemRecord[];
}

export interface ApiKeyEntry {
	id: string;
	provider: ProviderId;
	key: string;
	label: string;
}

export interface KaiakoConfig {
	onboarded: boolean;
	provider: ProviderId | null;
	apiKey: string;
	apiKeys: ApiKeyEntry[];
	activeModelId: string | null;
	name: string;
	pronounSubject: string;
	pronounObject: string;
	about: string;
	dataFolder: string;
	spendLimitUsd: number | null;
	requestLimit: number | null;
	autoStartPi: boolean;
	netSearch: boolean;
	lockedIn: boolean;
	sessions: SessionMeta[];
	currentSessionId: string | null;
}

export const DEFAULT_CONFIG: KaiakoConfig = {
	onboarded: false,
	provider: null,
	apiKey: "",
	apiKeys: [],
	activeModelId: null,
	name: "",
	pronounSubject: "",
	pronounObject: "",
	about: "",
	dataFolder: "",
	spendLimitUsd: null,
	requestLimit: null,
	autoStartPi: false,
	netSearch: false,
	lockedIn: false,
	sessions: [],
	currentSessionId: null,
};

export const CONFIG_ARTIFACTS = ["kaiako.yaml", "web-search.json", "skills", "pi"] as const;

export function mergeConfig(raw: Partial<KaiakoConfig> | null | undefined): KaiakoConfig {
	const merged: KaiakoConfig = {
		...DEFAULT_CONFIG,
		...(raw ?? {}),
		about: typeof raw?.about === "string" ? raw.about : "",
		apiKeys: Array.isArray(raw?.apiKeys) ? raw.apiKeys : [],
		spendLimitUsd:
			typeof raw?.spendLimitUsd === "number" && Number.isFinite(raw.spendLimitUsd) && raw.spendLimitUsd >= 0
				? raw.spendLimitUsd
				: null,
		requestLimit:
			typeof raw?.requestLimit === "number" && Number.isFinite(raw.requestLimit) && raw.requestLimit >= 0
				? raw.requestLimit
				: null,
		sessions: Array.isArray(raw?.sessions) ? raw.sessions : [],
	};
	return normalizeKeys(merged);
}

export function normalizeKeys(config: KaiakoConfig): KaiakoConfig {
	const apiKeys = [...config.apiKeys];
	if (config.provider && config.apiKey.trim() && !apiKeys.some((entry) => entry.key === config.apiKey)) {
		const provider = getProvider(config.provider);
		apiKeys.unshift({
			id: newId(),
			provider: config.provider,
			key: config.apiKey.trim(),
			label: provider?.label ?? config.provider,
		});
	}
	const activeModelId =
		config.activeModelId && apiKeys.some((entry) => entry.id === config.activeModelId)
			? config.activeModelId
			: (apiKeys[0]?.id ?? null);
	return { ...config, apiKeys, activeModelId };
}

export function newId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function activeKey(config: KaiakoConfig): ApiKeyEntry | null {
	return config.apiKeys.find((entry) => entry.id === config.activeModelId) ?? config.apiKeys[0] ?? null;
}

export type DiskConfig = Omit<KaiakoConfig, "onboarded" | "dataFolder">;
