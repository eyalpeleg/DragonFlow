# Verification — Upgrade Expo SDK 54 → 57

Checks the completed upgrade against `story.md`'s acceptance criteria. Landed on **Expo SDK 57 / React Native 0.86.2 / React 19.2.3** via three committed hops on `develop`: `cb6430a` (54→55), `ab43fbd` (55→56), `59e9a6c` (56→57).

## Automated verification
| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` (`tsc --noEmit`, TS 6.0.3) | ✅ PASS (0 errors) |
| ESLint | `npm run lint` (`eslint app/ src/`) | ✅ PASS (0 errors, 0 warnings) |
| Tests | `npm test` | ✅ PASS — 147/147, 19 suites |
| Expo Doctor | `npx expo-doctor` | ✅ 20/20 checks passed |
| Native regen | `npm run prebuild:clean` | ✅ prebuild + copy + patch all succeed |
| Native reconciliation | grep generated manifest + MainApplication | ✅ 3/3 packages registered; FloatingBubbleService, BootReceiver, SoundAlarmReceiver, ACTION_SEND, parking `<queries>`, all permissions incl. PACKAGE_USAGE_STATS / FOREGROUND_SERVICE_SPECIAL_USE / SCHEDULE_EXACT_ALARM present |
| Script idempotency | run copy + patch scripts twice | ✅ 2nd run = no-op (1 registration, 1 service decl — no duplication) |
| Gradle hardening | grep generated `build.gradle` | ✅ `layout.buildDirectory` + `configureEach`; no `whenTaskAdded`/`${buildDir}` (Gradle 9.3.1) |

> **Environment limit:** no JDK / Android SDK in the agent environment, so the **gradle release build was not run**. Everything a build/device proves is marked 📱 Pending below — honestly, not as passed.

## Acceptance-criteria coverage
| # | Criterion | Method | Status |
| --- | --- | --- | --- |
| AC1 | Builds & static checks pass (per hop + final) | `npm run check` green all 3 hops + final; `expo-doctor` 20/20 | ✅ Verified |
| AC2 | Native regeneration clean; all custom declarations present | `prebuild:clean` + reconciliation grep + idempotency (above) | ✅ Verified |
| AC3 | Release build signed with **env keystore**, not debug | Signing-config injection verified by code review (env-gated `release ? signingConfigs.release : signingConfigs.debug` present in generated `build.gradle`). Actual signed artifact needs a gradle build. | 📱 Pending (build) |
| AC4 | Dependency hygiene | package.json inspection: expo ~57, RN 0.86.2, react 19.2.3, reanimated 4.5.1 + worklets 0.10.1 (lockstep), expo-audio/jest-expo skew resolved, **expo-build-properties added (~57.0.8)**, no cross-major straggler, no dep in both deps/devDeps, **Hermes V1 off** | ✅ Verified |
| AC5 | No behavior regression (device) — CRUD/persistence, notifications, sound, bubble+boot, Drive backup round-trip, export/import, share, parking, no clipped content | Requires a build + device | 📱 Pending (device) |
| AC6 | Incremental, revertible trail — one commit per hop, each builds | 3 commits on `develop`, each static-green (typecheck+lint+test) and independently prebuild-reconciled | ✅ Verified |

## Manual QA checklist (yours — needs JDK + Android SDK + keystore env)
Rebuild first (full native build required — not a hot reload):
```bash
npm run build:apk
```
Requires `ANDROID_HOME`, `JAVA_HOME`, and release-keystore env (`DRAGONFLOW_KEYSTORE_PATH`/`_PASSWORD`/`_ALIAS`/`_ALIAS_PASSWORD`) — none were set in the agent shell.

- **AC3 — release signing:** after `build:apk`, verify the APK is signed with the env keystore, not debug: `apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk` (or `keytool`). Confirm it's the release cert.
- **AC5 — install the release APK on a device and check:**
  1. **Tasks + persistence** — create/edit/complete tasks; kill & relaunch; data persists (AsyncStorage hydration under RN 0.86).
  2. **Notifications** — critical-summary + per-task reminders fire; channels intact (Pomodoro/Reminders/Parking).
  3. **Sound** — task-completion + alarm sound play (expo-audio 57).
  4. **Floating bubble** — overlay draws over edge-to-edge screens; drag + dismiss zone work.
  5. **Boot restore** — reboot device; bubble restores (BootReceiver reads AsyncStorage `RKStorage`).
  6. **Google Drive backup round-trip** — "Back Up Now" then restore; confirm data returns (exercises `expo/fetch` default from SDK 56 + native Google Sign-In on RN 0.86).
  7. **Export/import** — export JSON, re-import; data matches (new File/Directory FS API).
  8. **Share-to-task** — share text from another app → Add Task pre-fills (ACTION_SEND).
  9. **Parking watcher** — background the parking app → arm-reminder prompt appears.
  10. **Edge-to-edge** — no screen/modal content clipped under status/nav bars; **check the bottom system nav bar reads correctly** (the `androidNavigationBar` config key was removed in hop 2 — SDK 56 made it invalid under edge-to-edge).
  11. **Pomodoro** — timer + keep-awake work; mini-bar shows.

## Pre-existing bugs found
None newly surfaced by this upgrade. The two backup bugs found earlier (false "Backup Complete" alert; "Last backup: Never" after re-sign-in) were already filed in `features.md` and are unrelated to the SDK bump.

## Notes / process findings (not AC failures)
- **`expo-build-properties` gap closed during verify.** It was referenced by `modules/dragonflow-native/app.plugin.js:26` but not a direct dep. Prebuild resolved it via Expo SDK 57's bundled mechanism (survived clean reinstalls), but per design AC4 it's now pinned explicitly (~57.0.8) to remove the latent fragility.
- **Under-hoisting required a clean reinstall each hop.** SDK 55+ stopped declaring `expo-modules-core`/`@expo/config-plugins` on sibling packages; the piecemeal `expo install --fix` sequence left them under-hoisted (breaking type resolution / plugin resolution). `rm -rf node_modules package-lock.json && npm install` fixed it and is now a standard per-hop step. Documented for future upgrades.
- **`.npmrc legacy-peer-deps=true`** added (hop 1) for datetimepicker's optional `react-native-windows` peer; commented in-file. Re-run `expo-doctor` each hop to re-surface any masked conflict.
- **npm audit** reports transitive vulnerabilities (mostly RN toolchain); not upgrade-introduced regressions — track separately, don't gate on them.

## Known limitations
- Gradle release build + all device behavior (AC3, AC5) are **unverified in this environment** — they are the user's manual QA (checklist above).
- **EAS parity** unaddressed here: `eas-build-post-install.sh` runs only `copy-native-files.js`, not `patch-native-config.js`, so EAS artifacts would miss the service/receivers/share-filter. Filed as its own backlog story (EAS manifest parity / config-plugin consolidation).
- `packageManager: yarn` field still present (repo uses npm) — cosmetic cleanup, spawned story.

## Verdict
**Built · QA pending.** Automated verification is fully green (typecheck, lint, 147 tests, doctor 20/20, native reconciliation + script idempotency) across all three hops and the final state. AC1/AC2/AC4/AC6 are ✅ Verified. AC3 (release signing) and AC5 (device behavior) are 📱 Pending and require a gradle build + on-device QA the agent environment can't run. **Do not mark Verified until the manual checklist passes on a device.**
