import type { SessionPhase } from "./config";

export type OrbState =
	| "working"
	| "searching"
	| "solving"
	| "listening"
	| "connecting"
	| "weaving"
	| "composing"
	| "breathing"
	| "shaping";

const LABELS: Record<OrbState, string> = {
	working: "working",
	searching: "searching",
	solving: "solving",
	listening: "listening",
	connecting: "connecting",
	weaving: "weaving",
	composing: "composing",
	breathing: "breathing",
	shaping: "agent planning",
};

export interface OrbPhasePresentation {
	state: OrbState;
	label: string;
}

const PHASE_ORBS: Record<SessionPhase, OrbPhasePresentation> = {
	need_goal: { state: "listening", label: "goal setting" },
	// The diagnostic phase is currently our smoke-test path, so it uses the
	// agent-planning visual with the requested smoke-testing label.
	diagnostic: { state: "shaping", label: "smoke testing" },
	teaching: { state: "composing", label: "teaching" },
};

export function orbForPhase(phase: SessionPhase): OrbPhasePresentation {
	return PHASE_ORBS[phase];
}

export function orbStateForTool(toolName: string): OrbState {
	const name = toolName.toLowerCase();
	if (/(search|fetch|web|research|exa)/.test(name)) return "searching";
	if (/(quiz|calc|math|solve)/.test(name)) return "solving";
	if (/(ask_user|question|listen)/.test(name)) return "listening";
	if (/(connect|network|install)/.test(name)) return "connecting";
	if (/(mermaid|svg|visual|image)/.test(name)) return "weaving";
	if (/(write|edit|compose|md-log)/.test(name)) return "composing";
	if (/(subagent|agent|plan)/.test(name)) return "shaping";
	if (/(read|bash|ls)/.test(name)) return "working";
	return "working";
}

export interface ThinkingOrbHandle {
	setState: (state: OrbState | null, labelOverride?: string) => void;
	destroy: () => void;
}

const SIZE = 24;

export function mountThinkingOrb(parent: HTMLElement): ThinkingOrbHandle {
	const pill = parent.createDiv({
		cls: "kaiako-orb-pill",
		attr: { hidden: "true" },
	});
	const canvas = pill.createEl("canvas", {
		cls: "kaiako-orb-canvas",
		attr: { width: String(SIZE), height: String(SIZE), "aria-hidden": "true" },
	});
	const label = pill.createSpan({ cls: "kaiako-orb-label" });

	const ctx = canvas.getContext("2d");
	let state: OrbState | null = null;
	let raf = 0;
	let start = performance.now();

	const dark = () =>
		document.body.classList.contains("theme-dark") ||
		Boolean(parent.closest(".kaiako-locked"));

	const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const paint = (now: number) => {
		if (!ctx || !state) return;
		const t = ((now - start) / 1000) * speedFor(state);
		const ink = dark() ? "255,255,255" : "42,38,34";
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		if (canvas.width !== SIZE * dpr) {
			canvas.width = SIZE * dpr;
			canvas.height = SIZE * dpr;
			canvas.style.width = `${SIZE}px`;
			canvas.style.height = `${SIZE}px`;
		}
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, SIZE, SIZE);
		const cx = SIZE / 2;
		const cy = SIZE / 2;
		const r = 8.4;
		drawState(ctx, state, t, cx, cy, r, ink, reduced());
	};

	const loop = (now: number) => {
		paint(now);
		if (state && !reduced()) raf = requestAnimationFrame(loop);
	};

	const startLoop = () => {
		cancelAnimationFrame(raf);
		if (!state) return;
		if (reduced()) {
			paint(performance.now());
			return;
		}
		raf = requestAnimationFrame(loop);
	};

	return {
		setState: (next, labelOverride) => {
			state = next;
			if (!next) {
				pill.setAttr("hidden", "true");
				pill.removeClass("is-live");
				cancelAnimationFrame(raf);
				return;
			}
			pill.removeAttribute("hidden");
			pill.addClass("is-live");
			const displayLabel = labelOverride ?? LABELS[next];
			label.setText(displayLabel);
			pill.setAttr("aria-label", displayLabel);
			start = performance.now();
			startLoop();
		},
		destroy: () => {
			cancelAnimationFrame(raf);
			pill.remove();
		},
	};
}

function speedFor(state: OrbState): number {
	if (state === "breathing") return 0.55;
	if (state === "searching" || state === "solving") return 1.15;
	if (state === "composing" || state === "weaving") return 0.9;
	return 0.8;
}

function drawState(
	ctx: CanvasRenderingContext2D,
	state: OrbState,
	t: number,
	cx: number,
	cy: number,
	r: number,
	ink: string,
	frozen: boolean,
): void {
	const time = frozen ? 0.4 : t;
	if (state === "searching") drawGlobe(ctx, cx, cy, r, time, ink, true);
	else if (state === "working") drawOrbits(ctx, cx, cy, r, time, ink);
	else if (state === "solving") drawBands(ctx, cx, cy, r, time, ink);
	else if (state === "listening") drawWave(ctx, cx, cy, r, time, ink);
	else if (state === "connecting") drawConstellation(ctx, cx, cy, r, time, ink);
	else if (state === "weaving") drawWeave(ctx, cx, cy, r, time, ink);
	else if (state === "composing") drawSash(ctx, cx, cy, r, time, ink);
	else if (state === "shaping") drawShape(ctx, cx, cy, r, time, ink);
	else drawBreath(ctx, cx, cy, r, time, ink);
}

function dot(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	ink: string,
	alpha: number,
): void {
	ctx.beginPath();
	ctx.fillStyle = `rgba(${ink},${alpha})`;
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
}

function drawGlobe(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
	scan: boolean,
): void {
	const sweep = ((t * 0.7) % 2) - 1;
	for (let i = 0; i < 28; i += 1) {
		const lat = -0.85 + (i % 7) * 0.28;
		const lon = (Math.floor(i / 7) / 4) * Math.PI * 2 + t * 0.35;
		const x = cx + Math.cos(lon) * Math.cos(lat) * r;
		const y = cy + Math.sin(lat) * r * 0.72;
		const z = Math.sin(lon) * Math.cos(lat);
		if (z < -0.15) continue;
		const nearSweep = scan ? 1 - Math.min(1, Math.abs(Math.cos(lon) - sweep) * 2.4) : 0.45;
		dot(ctx, x, y, 0.9, ink, 0.28 + 0.55 * Math.max(0.2, z) + 0.25 * nearSweep);
	}
}

function drawOrbits(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	for (let ring = 0; ring < 3; ring += 1) {
		const tilt = 0.4 + ring * 0.35;
		for (let i = 0; i < 8; i += 1) {
			const a = t * (0.8 + ring * 0.2) + (i / 8) * Math.PI * 2;
			const x = cx + Math.cos(a) * r;
			const y = cy + Math.sin(a) * r * Math.sin(tilt);
			dot(ctx, x, y, 1, ink, 0.35 + 0.4 * ((Math.sin(a + t) + 1) / 2));
		}
	}
}

function drawBands(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	const solved = (Math.sin(t * 0.9) + 1) / 2;
	for (let b = 0; b < 4; b += 1) {
		const y = cy - r + (b + 0.5) * (r * 2) / 4;
		const jitter = (1 - solved) * Math.sin(t * 6 + b) * 1.6;
		for (let i = 0; i < 7; i += 1) {
			const x = cx - r + (i / 6) * r * 2 + jitter;
			dot(ctx, x, y, 0.95, ink, 0.3 + 0.5 * solved);
		}
	}
}

function drawWave(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	for (let i = 0; i < 14; i += 1) {
		const x = cx - r + (i / 13) * r * 2;
		const y = cy + Math.sin(t * 3 + i * 0.55) * r * 0.45;
		dot(ctx, x, y, 1.05, ink, 0.35 + 0.45 * ((Math.sin(t * 3 + i) + 1) / 2));
	}
}

function drawConstellation(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	const pts: [number, number][] = [];
	for (let i = 0; i < 7; i += 1) {
		const a = (i / 7) * Math.PI * 2 + t * 0.15;
		pts.push([cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82]);
	}
	ctx.strokeStyle = `rgba(${ink},0.28)`;
	ctx.lineWidth = 0.7;
	const visible = Math.min(pts.length - 1, Math.floor((t * 1.4) % pts.length));
	ctx.beginPath();
	for (let i = 0; i <= visible; i += 1) {
		const pt = pts[i];
		if (!pt) continue;
		if (i === 0) ctx.moveTo(pt[0], pt[1]);
		else ctx.lineTo(pt[0], pt[1]);
	}
	ctx.stroke();
	for (const [x, y] of pts) dot(ctx, x, y, 1.1, ink, 0.7);
}

function drawWeave(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	for (let s = 0; s < 3; s += 1) {
		for (let i = 0; i < 10; i += 1) {
			const u = i / 9;
			const a = u * Math.PI * 2 + t * 0.8 + s * 2.1;
			const x = cx + Math.cos(a) * r * (0.55 + 0.2 * Math.sin(u * 6 + t));
			const y = cy + (u - 0.5) * r * 2;
			dot(ctx, x, y, 0.85, ink, 0.3 + 0.4 * ((s + 1) / 3));
		}
	}
}

function drawSash(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	for (let b = 0; b < 3; b += 1) {
		for (let i = 0; i < 12; i += 1) {
			const u = i / 11;
			const a = u * Math.PI * 1.6 - 0.8 + Math.sin(t * 1.4 + b) * 0.2;
			const x = cx + Math.cos(a) * r;
			const y = cy + Math.sin(a) * r * 0.45 + (b - 1) * 2.1;
			dot(ctx, x, y, 0.9, ink, 0.25 + 0.2 * b);
		}
	}
}

function drawBreath(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	const pulse = 0.82 + 0.18 * Math.sin(t * 1.6);
	for (let i = 0; i < 16; i += 1) {
		const a = (i / 16) * Math.PI * 2;
		dot(ctx, cx + Math.cos(a) * r * pulse, cy + Math.sin(a) * r * pulse, 1, ink, 0.45);
	}
}

function drawShape(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
	t: number,
	ink: string,
): void {
	const phase = (t * 0.35) % 3;
	const sides = phase < 1 ? 16 : phase < 2 ? 3 : 4;
	const n = 14;
	for (let i = 0; i < n; i += 1) {
		const a = (i / n) * Math.PI * 2 - Math.PI / 2;
		const poly = r * (0.72 + 0.18 * Math.cos(sides * a));
		dot(ctx, cx + Math.cos(a) * poly, cy + Math.sin(a) * poly, 0.95, ink, 0.55);
	}
}
