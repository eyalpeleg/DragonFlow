# Story — Upgrade Expo SDK 54 → 57

## User story
**As** the developer/maintainer of DragonFlow,
**I want** the app on Expo SDK 57 (RN 0.86, React 19.2), upgraded incrementally with no behavior change,
**so that** the app stays on a supported SDK, pulls in RN/security fixes, and unblocks `expo-share-intent` + the iOS share target.

This is an **enabler / maintenance** story. The user-visible surface must be **identical** before and after. "Done" = builds clean, all existing behavior intact, custom native survives.

## Scope
**In scope**
- Sequential SDK bumps 54→55→56→57, each with `expo install --fix`, `expo-doctor`, `npm run prebuild:clean`, and the reconciliation checklist from `analysis.md`.
- Realign every Expo-managed dep to its SDK pin (resolve the `expo-audio`/`jest-expo` skew).
- Required migrations to keep parity: notification config → expo-notifications config plugin (55); `removeSubscription`→`subscription.remove()`; status-bar deprecations; edge-to-edge safe-area audit of screens/modals; `expo-file-system` async `copy/move` (56); confirm `expo/fetch` doesn't regress Drive backup (56).
- Harden the two native scripts for the new template (Gradle 9 `whenTaskAdded`/`${buildDir}`; verify all regex anchors still hit).
- Add `expo-build-properties` to `package.json` deps.
- One gated commit per hop.

**Out of scope** (spawned stories, recorded below)
- `expo-share-intent` migration (replacing `ShareIntentModule.kt` + JS bridge) + iOS share target.
- iOS floating bubble.
- EAS manifest parity / config-plugin consolidation (recommended cleanup; may be done opportunistically if a hop forces it, else spawned).
- Enabling Hermes V1 or React Compiler (explicitly deferred).
- Removing the `packageManager: yarn` field (cleanup; only if it obstructs a hop).

## Acceptance criteria

### AC1 — Builds and static checks pass (per hop and final)
- **Given** the app upgraded to SDK `<N>`, **when** I run `npm run check` (`tsc --noEmit` + `expo lint` + `jest`), **then** all three pass with no new errors.
- **Given** SDK `<N>`, **when** I run `npx expo-doctor`, **then** it reports no failed checks (or only known/accepted warnings, documented).

### AC2 — Native regeneration is clean
- **Given** a hop's dependency changes, **when** I run `npm run prebuild:clean`, **then** it completes without error and `copy-native-files.js` + `patch-native-config.js` both apply successfully.
- **Given** the regenerated `android/`, **when** I grep the generated `AndroidManifest.xml` and `MainApplication.kt`, **then** all custom declarations are present: `FloatingBubbleService`, `BootReceiver`, `SoundAlarmReceiver`, the `ACTION_SEND` intent-filter, the `com.unicell.pangoandroid` `<queries>` entry, all patched permissions incl. `PACKAGE_USAGE_STATS`, and all three custom packages registered (`FloatingBubblePackage`, `ShareIntentPackage`, `ParkingWatcherPackage`).

### AC3 — Release build is correct
- **Given** SDK 57, **when** I run `npm run build:apk` (or `build:aab`), **then** it produces a signed artifact.
- **Given** the release artifact, **when** its signing is inspected, **then** it is signed with the **env keystore**, not the debug key (guards the `copy-native-files.js` signing regex).

### AC4 — Dependency hygiene
- **Given** the final `package.json`, **then** `expo` is `~57.x`, `react` `19.2.x`, `react-native` `0.86.x`, `jest-expo`/`expo-audio` realigned to the 57 pin (no cross-major skew), `react-native-reanimated` and `react-native-worklets` bumped **in lockstep**, and `expo-build-properties` is present.
- **Given** the build config, **then** Hermes V1 is **not** enabled.

### AC5 — No behavior regression (verified in Verify stage; device QA)
- **Given** the SDK-57 build on a device, **then** these work unchanged: task CRUD + persistence (AsyncStorage hydration), notifications (channels + scheduled reminders), alarm/completion **sound**, Pomodoro, the **floating bubble overlay** (draws over edge-to-edge), **boot restore** of the bubble, **Google Drive backup + restore round-trip**, data **export/import**, the **share-to-task** target (ACTION_SEND), and the **parking** usage-stats watcher.
- **Given** edge-to-edge is now mandatory, **then** no screen/modal has content clipped under the status/nav bars.

### AC6 — Incremental, revertible trail
- **Given** the effort, **then** history contains one commit per SDK hop (54→55, 55→56, 56→57) on `develop`, each independently building, so any hop can be reverted in isolation.

## Definition of Done
- All ACs met; `analysis.md` reconciliation checklist run at each hop.
- `verification.md` maps every AC to a verification method + status.
- Backlog row advanced through the ladder to **Verified** (Shipped only after release).
- Spawned stories filed in `features.md`.

## Spawned side-way stories (file in backlog)
1. **expo-share-intent migration + iOS share target** — replace custom `ShareIntentModule.kt` + `src/modules/ShareIntent.ts` + `useShareIntent.ts` with `expo-share-intent` (v6+, SDK 55+); adds iOS parity. Unlocked by this upgrade.
2. **EAS manifest parity / config-plugin consolidation** — `eas-build-post-install.sh` skips `patch-native-config.js`, so EAS artifacts miss the service/receivers/share-filter. Consolidate manifest edits into a real config plugin so local + EAS agree.
3. **(cleanup) Remove `packageManager: yarn` skew** — repo uses npm per convention; the field is misleading.
