import { Platform } from "obsidian";

export async function pickDataFolder(): Promise<string | null> {
	if (!Platform.isDesktopApp) return null;
	try {
		// Obsidian desktop exposes Electron via window.require
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
		const electron = (window as any).require?.("electron");
		if (!electron) return null;
		const dialog = electron.remote?.dialog ?? electron.dialog;
		const win = electron.remote?.getCurrentWindow?.();
		const result = await dialog.showOpenDialog(win, {
			properties: ["openDirectory", "createDirectory"],
			title: "Choose Kaiako data folder",
		});
		if (result.canceled || !result.filePaths?.[0]) return null;
		return result.filePaths[0] as string;
	} catch {
		return null;
	}
}
