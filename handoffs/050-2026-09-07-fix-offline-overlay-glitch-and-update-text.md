# Session 050 — Fix harness offline overlay glitch and update heading text

## Scope

1. Fix the issue where unlinking the harness or loading the extension glitched out and failed to show the offline overlay for several seconds, temporarily exposing the unblurred chat interface underneath.
2. Update the offline overlay heading text to centered two lines:
   `AI Agent is offline,`
   `active me!`

## Completed

- In `kaiako/src/config.ts`:
  - Added `harnessLinked: boolean` to `KaiakoConfig` and `DEFAULT_CONFIG`.
  - Updated `mergeConfig()` to retain and synchronize `harnessLinked`.
- In `kaiako/src/cli-path.ts`:
  - Updated `hitCache` from `Map<string, string>` to `Map<string, string | null>` to cache negative lookup results (`null`).
  - Allowed `resolveCli()` to return cached `null` in 0ms when tools like `pi` are not installed, eliminating repetitive expensive zsh login shells (`zsh -lic`).
- In `kaiako/src/pi.ts`:
  - Added request de-duplication and 30-second TTL in-memory caching to `detectPiHarness()`.
  - Added `invalidatePiDetection()` and wired it to `installPiHarness()`, `uninstallPiHarness()`, `linkHarness()`, and `unlinkAndDeleteHarness()`.
- In `kaiako/src/main.ts`:
  - Added `notifyHarnessState(linked, version)` on `KaiakoPlugin` to broadcast real-time harness state changes to all active `KaiakoView` instances.
  - Preserved `harnessLinked` in `restartOnboarding()`.
- In `kaiako/src/settings-modal.ts`:
  - In `installAndLinkHarness()`: saves `harnessLinked: true` and broadcasts `notifyHarnessState(true, version)`.
  - In `unlinkAndDeleteHarness()`: saves `harnessLinked: false` and broadcasts `notifyHarnessState(false, null)`.
- In `kaiako/src/kaiako-view.ts`:
  - Updated `onOpen()` to initialize `this.piFound` synchronously from `config.harnessLinked` and render immediately without blocking on shell execution.
  - Added `setHarnessState()` and `updateHarnessOverlay()`, allowing the view to mount or unmount `.kaiako-offline-overlay` without destroying the active DOM or resetting chat state.
  - In `openSettings()`, on modal exit called `updateHarnessOverlay()` directly instead of wiping the entire view with `this.render()`.
  - Updated heading text in `renderHarnessOfflineOverlay()`:
    - Line 1: `AI Agent is offline,`
    - Line 2: `active me!`
- In `kaiako/styles.css`:
  - Removed `animation: kaiako-fade-in 0.3s ease-out;` from `.kaiako-offline-overlay` to eliminate the 300ms transparent flash upon initial render.
- Rebuilt plugin with `npm run build` in `kaiako/`.

## Verification

- Ran `npm run build` (`tsc --noEmit --skipLibCheck` and `node esbuild.config.mjs production`) cleanly with 0 errors.
- Ran `git diff --check` with 0 issues.
- Verified on branch `feature`.

## Files

- `kaiako/src/config.ts`
- `kaiako/src/cli-path.ts`
- `kaiako/src/pi.ts`
- `kaiako/src/main.ts`
- `kaiako/src/settings-modal.ts`
- `kaiako/src/kaiako-view.ts`
- `kaiako/styles.css`
- `HANDOFF.md`
