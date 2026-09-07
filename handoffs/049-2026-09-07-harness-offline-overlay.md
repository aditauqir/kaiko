# Session 049 — Harness offline overlay with 90% gaussian blur and direct settings link

## Scope

1. If the Pi harness is offline / not linked, display a centered screen in the sidebar with:
   - The unlinked chain symbol.
   - Centered two-line heading:
     `Harness offline`
     `activate it`
   - A button leading directly to the Pi harness section in the Settings page for linking/unlinking.
2. Render this screen as a frosted overlay with 0.56 blur (`backdrop-filter: blur(0.56rem) saturate(1.2)`) and 0.56 translucent backdrop (`rgba(255, 255, 252, 0.56)` in light mode, `rgba(13, 13, 13, 0.56)` in dark/locked mode).
3. The Settings button inverts colors on hover, does not shift upward, and uses custom animation motion easing `cubic-bezier(0.075, 0.82, 0.165, 1)`.

## Completed

- In `kaiako/src/settings-modal.ts`:
  - Exported `TabId` and updated `KaiakoSettingsModal` constructor to accept an `initialTab: TabId = "keys"` parameter.
  - Ensured `onClose()` always signals host refresh so the view is synchronized after settings changes.
  - Added `markHostRefresh()` on harness install, link, and unlink actions.
- In `kaiako/src/kaiako-view.ts`:
  - Added `hasHarness()` helper check (`this.piFound && Boolean(this.plugin.config.dataFolder)`).
  - Updated `openSettings(tab?: TabId)` to accept a target tab and refresh Pi detection before re-rendering.
  - Implemented `renderHarnessOfflineOverlay(shell)` and `mountUnlinkedIcon(parent)` displaying:
    - Custom unlinked SVG symbol (`viewBox="0 0 256 256"`).
    - Centered 2-line heading (`Harness offline` / `activate it`).
    - Settings button that invokes `openSettings("pi")` directly opening the Pi harness settings pane.
  - In `render()`, when in chat mode and harness is missing, the blur overlay is rendered on top.
- In `kaiako/styles.css`:
  - Styled `.kaiako-offline-overlay` with 0.56 gaussian blur (`backdrop-filter: blur(0.56rem) saturate(1.2); -webkit-backdrop-filter: blur(0.56rem) saturate(1.2);`) and 0.56 backdrop opacity (`rgba(255, 255, 252, 0.56)` in light mode, `rgba(13, 13, 13, 0.56)` in dark/locked mode).
  - Styled `.kaiako-offline-card`, `.kaiako-offline-icon`, `.kaiako-offline-heading`.
  - Configured `.kaiako-offline-btn` to invert colors on hover/focus in both themes (light mode: dark bg `#2a2622` to light `#fffffc`; dark mode: light bg `#fffffc` to dark `#12100e`).
  - Removed upward translation on hover (`transform: none`, removing `translateY(-1px)`), with subtle `transform: scale(0.98)` on active press.
  - Applied custom easing `cubic-bezier(0.075, 0.82, 0.165, 1)` for button and gear icon transitions.
  - Added `.kaiako-offline-overlay`, `.kaiako-offline-btn`, and `.kaiako-offline-btn-icon` to `prefers-reduced-motion` overrides.
- Rebuilt plugin with `npm run build` in `kaiako/`.

## Verification

- Ran `npm run build` (`tsc --noEmit --skipLibCheck` and `node esbuild.config.mjs production`) cleanly with 0 errors.
- Verified on branch `feature`.
- Ran `git diff --check` with 0 issues.

## Files

- `kaiako/src/settings-modal.ts`
- `kaiako/src/kaiako-view.ts`
- `kaiako/styles.css`
- `HANDOFF.md`
