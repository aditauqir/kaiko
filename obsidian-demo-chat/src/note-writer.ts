import { MarkdownView, Notice, TFile, normalizePath, type App } from "obsidian";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);

export function isImageFile(name: string): boolean {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	return IMAGE_EXT.has(ext);
}

export function findMarkdownView(app: App): MarkdownView | null {
	const active = app.workspace.getActiveViewOfType(MarkdownView);
	if (active?.file) return active;

	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		if (leaf.view instanceof MarkdownView && leaf.view.file) {
			return leaf.view;
		}
	}
	return null;
}

export async function ensureMarkdownTarget(app: App): Promise<MarkdownView | null> {
	const existing = findMarkdownView(app);
	if (existing) return existing;

	const path = normalizePath("Demo Chat.md");
	let file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		file = await app.vault.create(
			path,
			"# Demo Chat\n\nMessages from the side chat land here.\n",
		);
	}
	if (!(file instanceof TFile)) return null;
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file);
	return app.workspace.getActiveViewOfType(MarkdownView);
}

export async function appendToMarkdown(app: App, markdown: string): Promise<TFile | null> {
	const view = await ensureMarkdownTarget(app);
	const file = view?.file;
	if (!view || !file) {
		new Notice("Open a markdown note first.");
		return null;
	}

	if (view.getMode() === "source") {
		const editor = view.editor;
		const lastLine = editor.lastLine();
		const lastCh = editor.getLine(lastLine).length;
		const prefix = lastLine === 0 && lastCh === 0 ? "" : "\n\n";
		editor.replaceRange(prefix + markdown, { line: lastLine, ch: lastCh });
	} else {
		await app.vault.process(file, (data) => {
			const sep = data.trim().length > 0 ? "\n\n" : "";
			return data + sep + markdown;
		});
	}

	return file;
}
