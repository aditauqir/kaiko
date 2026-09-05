import type { SessionMeta } from "./config";

export const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 1000;

export interface SessionActivitySnapshot {
	activeSeconds: number;
	lastInteractionAt: number | null;
}

type ActivityState = {
	activeMs: number;
	lastSignalAt: number | null;
	lastAccruedAt: number | null;
	piBusy: boolean;
	dirty: boolean;
};

export class SessionActivityTracker {
	private readonly states = new Map<string, ActivityState>();
	private currentSessionId: string | null = null;
	private timer: number | null = null;

	constructor(private readonly onFlush: (sessionId: string, snapshot: SessionActivitySnapshot) => Promise<void>) {}

	begin(session: Pick<SessionMeta, "id" | "activeSeconds" | "lastInteractionAt">): void {
		if (this.currentSessionId !== session.id) {
			const previousId = this.currentSessionId;
			if (previousId) {
				const previous = this.states.get(previousId);
				if (previous?.piBusy) {
					const now = Date.now();
					this.accrue(previous, now);
					previous.piBusy = false;
					previous.lastSignalAt = now;
					previous.lastAccruedAt = now;
					previous.dirty = true;
				}
				void this.flushSession(previousId);
			}
			this.currentSessionId = session.id;
		}

		const state = this.states.get(session.id) ?? this.createState(session);
		const persistedMs = finiteNonNegative(session.activeSeconds) * 1000;
		if (persistedMs > state.activeMs) state.activeMs = persistedMs;
		this.states.set(session.id, state);
		this.ensureTimer();
	}

	markUserInteraction(sessionId: string): void {
		this.signal(sessionId);
	}

	setPiBusy(sessionId: string, busy: boolean): void {
		if (sessionId !== this.currentSessionId) return;
		const state = this.states.get(sessionId);
		if (!state || state.piBusy === busy) return;
		const now = Date.now();
		this.accrue(state, now);
		state.piBusy = busy;
		state.lastSignalAt = now;
		state.lastAccruedAt = now;
		state.dirty = true;
		this.ensureTimer();
	}

	async flush(): Promise<void> {
		if (this.currentSessionId) await this.flushSession(this.currentSessionId);
	}

	async stop(): Promise<void> {
		if (this.currentSessionId) {
			const state = this.states.get(this.currentSessionId);
			if (state?.piBusy) {
				const now = Date.now();
				this.accrue(state, now);
				state.piBusy = false;
				state.lastSignalAt = now;
				state.lastAccruedAt = now;
				state.dirty = true;
			}
			await this.flushSession(this.currentSessionId);
		}
		this.currentSessionId = null;
		if (this.timer !== null) window.clearInterval(this.timer);
		this.timer = null;
	}

	private createState(session: Pick<SessionMeta, "activeSeconds" | "lastInteractionAt">): ActivityState {
		const lastInteractionAt = finiteTimestamp(session.lastInteractionAt);
		const now = Date.now();
		const recent = lastInteractionAt !== null && now - lastInteractionAt <= SESSION_IDLE_TIMEOUT_MS;
		return {
			activeMs: finiteNonNegative(session.activeSeconds) * 1000,
			lastSignalAt: recent ? lastInteractionAt : null,
			lastAccruedAt: recent ? lastInteractionAt : null,
			piBusy: false,
			dirty: false,
		};
	}

	private signal(sessionId: string, piBusy?: boolean): void {
		if (sessionId !== this.currentSessionId) return;
		const state = this.states.get(sessionId);
		if (!state) return;
		const now = Date.now();
		this.accrue(state, now);
		state.lastSignalAt = now;
		state.lastAccruedAt = now;
		if (piBusy !== undefined) state.piBusy = piBusy;
		state.dirty = true;
		this.ensureTimer();
	}

	private accrue(state: ActivityState, now: number): void {
		if (state.lastSignalAt === null || state.lastAccruedAt === null) return;
		const end = state.piBusy
			? now
			: Math.min(now, state.lastSignalAt + SESSION_IDLE_TIMEOUT_MS);
		if (end <= state.lastAccruedAt) return;
		state.activeMs += end - state.lastAccruedAt;
		state.lastAccruedAt = end;
		state.dirty = true;
	}

	private ensureTimer(): void {
		if (this.timer !== null) return;
		this.timer = window.setInterval(() => void this.flush(), 15_000);
	}

	private async flushSession(sessionId: string): Promise<void> {
		const state = this.states.get(sessionId);
		if (!state) return;
		this.accrue(state, Date.now());
		if (!state.dirty) return;
		state.dirty = false;
		try {
			await this.onFlush(sessionId, {
				activeSeconds: Math.max(0, Math.floor(state.activeMs / 1000)),
				lastInteractionAt: state.lastSignalAt,
			});
		} catch (error) {
			state.dirty = true;
			console.warn("[kaiako activity] Could not persist session activity", error);
		}
	}
}

function finiteNonNegative(value: number | undefined): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function finiteTimestamp(value: number | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
