import { requestUrl } from "obsidian";
import type { ProviderId } from "./providers";

export type ApiKeyCheckStatus = "checking" | "valid" | "invalid";
export type ApiKeyCheckReason = "unauthorized" | "network" | "error";

export interface ApiKeyCheckResult {
	status: Exclude<ApiKeyCheckStatus, "checking">;
	reason?: ApiKeyCheckReason;
	detail?: string;
}

export type ApiKeyCheckState =
	| { status: "checking" }
	| ApiKeyCheckResult;

const CHECK_TIMEOUT_MS = 12_000;

interface CheckTarget {
	url: string;
	headers: Record<string, string>;
}

function targetFor(provider: ProviderId, key: string): CheckTarget {
	if (provider === "claude") {
		return {
			url: "https://api.anthropic.com/v1/models",
			headers: {
				"x-api-key": key,
				"anthropic-version": "2023-06-01",
				accept: "application/json",
			},
		};
	}
	if (provider === "openai") {
		return {
			url: "https://api.openai.com/v1/models",
			headers: {
				authorization: `Bearer ${key}`,
				accept: "application/json",
			},
		};
	}
	if (provider === "gemini") {
		return {
			url: "https://generativelanguage.googleapis.com/v1beta/models",
			headers: {
				"x-goog-api-key": key,
				accept: "application/json",
			},
		};
	}
	if (provider === "qwen-cloud") {
		return {
			url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
			headers: {
				authorization: `Bearer ${key}`,
				accept: "application/json",
			},
		};
	}
	if (provider === "deepseek") {
		return {
			url: "https://api.deepseek.com/models",
			headers: {
				authorization: `Bearer ${key}`,
				accept: "application/json",
			},
		};
	}
	return {
		url: "https://openrouter.ai/api/v1/key",
		headers: {
			authorization: `Bearer ${key}`,
			accept: "application/json",
		},
	};
}

export function apiKeyCheckLabel(state: ApiKeyCheckState): string {
	if (state.status === "checking") return "checking…";
	if (state.status === "valid") return "valid";
	if (state.reason === "unauthorized") return "invalid · unauthorized";
	if (state.reason === "network") return "invalid · network";
	return state.detail ? `invalid · ${state.detail}` : "invalid";
}

export async function checkApiKey(provider: ProviderId, key: string): Promise<ApiKeyCheckResult> {
	const trimmed = key.trim();
	if (!trimmed) {
		return { status: "invalid", reason: "unauthorized", detail: "empty" };
	}

	const { url, headers } = targetFor(provider, trimmed);
	try {
		const response = await withTimeout(
			requestUrl({
				url,
				method: "GET",
				headers,
				throw: false,
			}),
			CHECK_TIMEOUT_MS,
		);
		return classifyStatus(response.status, response.text, trimmed);
	} catch (error) {
		if (isTimeout(error) || isNetworkError(error)) {
			return { status: "invalid", reason: "network" };
		}
		return { status: "invalid", reason: "error", detail: "request failed" };
	}
}

function classifyStatus(status: number, body: string, key: string): ApiKeyCheckResult {
	if ((status >= 200 && status < 300) || status === 402 || status === 429) {
		return { status: "valid" };
	}
	if (status === 401 || status === 403 || looksUnauthorized(body, key)) {
		return { status: "invalid", reason: "unauthorized" };
	}
	if (status === 0) {
		return { status: "invalid", reason: "network" };
	}
	return { status: "invalid", reason: "error", detail: `HTTP ${status}` };
}

function looksUnauthorized(body: string, key: string): boolean {
	const text = scrubSecret(body, key).toLowerCase();
	return (
		text.includes("invalid api key") ||
		text.includes("incorrect api key") ||
		text.includes("invalid_api_key") ||
		text.includes("api key not valid") ||
		text.includes("api_key_invalid") ||
		text.includes("unauthorized") ||
		text.includes("authentication") ||
		text.includes("permission denied") ||
		text.includes("invalid token")
	);
}

function scrubSecret(text: string, key: string): string {
	if (!text || !key) return text ?? "";
	return text.split(key).join("***");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timeout")), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

function isTimeout(error: unknown): boolean {
	return error instanceof Error && error.message === "timeout";
}

function isNetworkError(error: unknown): boolean {
	if (!(error instanceof Error)) return true;
	const text = error.message.toLowerCase();
	return (
		text.includes("network") ||
		text.includes("fetch") ||
		text.includes("econn") ||
		text.includes("enotfound") ||
		text.includes("etimedout") ||
		text.includes("net::") ||
		text.includes("failed to") ||
		text.includes("offline")
	);
}
