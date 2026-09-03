import { Plugin } from "obsidian";
import { DemoChatView, VIEW_TYPE_DEMO_SIDECHAT } from "./chat-view";

export default class DemoSidechatPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(VIEW_TYPE_DEMO_SIDECHAT, (leaf) => new DemoChatView(leaf));

		this.addRibbonIcon("message-square", "Open demo chat", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-demo-chat",
			name: "Open demo chat",
			callback: () => {
				void this.activateView();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
		});
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_DEMO_SIDECHAT);
		let leaf = existing[0];

		if (!leaf) {
			leaf = workspace.getRightLeaf(false) ?? undefined;
			if (!leaf) return;
			await leaf.setViewState({
				type: VIEW_TYPE_DEMO_SIDECHAT,
				active: true,
			});
		}

		await workspace.revealLeaf(leaf);
	}
}
