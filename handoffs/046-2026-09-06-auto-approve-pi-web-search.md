# 046: Auto-Approve Pi Internet Tool Calls & Bypass Browser Curator

## Summary
Identified the root cause of Pi's web search opening a browser window requiring manual approval, and configured automatic approval to bypass the curator interface across Pi configuration paths and CLI invocations.

## Root Causes Identified
1. **`pi-web-access` Curator Workflow Default**:
   - `pi-web-access` defaults to `"workflow": "summary-review"`. In this mode, whenever the agent calls `web_search` or an internet tool, `pi-web-access` launches a local HTTP server, invokes the system default web browser (`openCuratorBrowser`), and pauses execution while waiting for the user to manually review search results and click "Approve Summary".
2. **Missing Workflow Setting in `web-search.json`**:
   - Kaiako previously wrote `web-search.json` with only `provider: "exa"` and tool enablement flags, omitting `workflow` and `curator`. Consequently, `pi-web-access` fell back to its default interactive curator UI.
3. **Configuration Path Disconnect**:
   - Kaiako runs Pi with `PI_CODING_AGENT_DIR` pointing to `<dataFolder>/pi`, but previously only wrote `web-search.json` to `<dataFolder>/web-search.json` and `~/.pi/web-search.json`, omitting `<dataFolder>/pi/web-search.json` and `~/.pi/agent/web-search.json`.
4. **Pi CLI Project Trust**:
   - Pi CLI without the `--approve` flag may prompt for manual approval when loading project-local extensions and tools.

## Changes Made
1. **Configured Auto-Summary Workflow (`kaiako/src/pi.ts`)**:
   - Updated `writeNetSearchConfig` to include `"workflow": "auto-summary"` and `"curator": false` when auto-approval is active. In `auto-summary` mode, `pi-web-access` synthesizes citations and search results automatically and returns them directly to Pi without opening the browser or waiting for manual clicks.
   - Synchronized `web-search.json` to all potential target locations:
     - `<dataFolder>/web-search.json`
     - `<dataFolder>/pi/web-search.json` (`$PI_CODING_AGENT_DIR/web-search.json`)
     - `~/.pi/agent/web-search.json` (modern default Pi directory)
     - `~/.pi/web-search.json` (legacy Pi directory)
2. **Added `--approve` Flag to Pi Spawn (`kaiako/src/pi.ts`)**:
   - In `ensure()`, added `--approve` to the arguments passed to `spawnCli("pi", ...)` so that Pi automatically trusts and approves project-local tools and configurations in RPC mode.
3. **Added Setting & Config Support (`kaiako/src/config.ts`, `kaiako/src/settings-modal.ts`, `kaiako/src/main.ts`)**:
   - Added `netSearchAutoApprove: boolean` (default `true`) to `KaiakoConfig`, `DEFAULT_CONFIG`, and `mergeConfig`.
   - Added an "Auto-approve web search" toggle under the Pi settings tab in `KaiakoSettingsModal` ("Automatically approve search results and generate summaries without opening the browser curator").
   - Wired `netSearchAutoApprove` change detection in `main.ts:saveConfig` to trigger `pi.sync()` to update `web-search.json` immediately.

## Verification
- Built with `npm run build` (`tsc --noEmit --skipLibCheck && node esbuild.config.mjs production`) with 0 errors.
- Verified `git diff --check` with 0 whitespace issues.
