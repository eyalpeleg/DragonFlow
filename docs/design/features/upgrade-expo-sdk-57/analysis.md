# Analysis — Upgrade Expo SDK 54 → 57

Input: `brainstorm.md` (decided: incremental 54→55→56→57, pure upgrade, keep custom native, commit+verify each hop). This stage pressure-tests feasibility against the real codebase and the Expo/RN changelogs. **No code written here.**

## Mechanism, resolved with evidence
- **Target:** Expo SDK 57 = **React Native 0.86**, **React 19.2** (React unchanged 56→57). Path: 54 (RN 0.81 / React 19.1) → 55 (RN ~0.83 / React 19.2) → 56 (RN ~0.85) → 57 (RN 0.86).
- **Canonical per-hop procedure** (from the `expo-upgrade` skill): `npx expo install expo@~<N>` → `npx expo install --fix` → `npx expo-doctor` → regenerate native → verify. We use `expo@~55/~56/~57` per hop, **not** `expo@latest` (incremental).
- **Project override — native regeneration:** this repo uses **`npm run prebuild:clean`** (= `expo prebuild --clean` → `copy-native-files.js` → `patch-native-config.js`), never raw `expo prebuild`. All custom-native fixes live in `modules/dragonflow-native/` + the two scripts — never in generated `android/` (CLAUDE.md + prebuild-resilience rule). Confirmed scripts at `package.json:10-14`.
- **Confirmed deps present** (`package.json:23-59`): `react-native-reanimated ~4.1.1` + `react-native-worklets 0.5.1` (must bump in lockstep); `@expo/vector-icons ^15.0.3` is **already an explicit dep** (so SDK 56's unbundling is a non-issue here); `@react-native-google-signin/google-signin ^16.1.2` is the **only non-Expo-pinned native dep**.

## Dependency compatibility matrix
Every Expo-managed package realigns to the SDK pin via `expo install --fix` at each hop — don't hand-edit versions. Exact unimodule minors are whatever `--fix` sets; below flags **type + risk**, not fabricated numbers.

| Package | Current | Target (SDK 57) | Type | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| expo | ~54.0.33 | ~57.0.x | managed | Med | Anchor. `expo prebuild` **cleans by default** on 57 — our `prebuild` (non-clean) script may need `--no-clean`; `prebuild:clean` unaffected. |
| react / react-dom | 19.1.0 | 19.2.x | managed | Low | Bump lands entirely at 54→55. |
| react-native | 0.81.5 | 0.86.x | managed | **Med/High** | Real churn is 0.81→0.85 (New-Arch-only, edge-to-edge); 0.85→0.86 non-breaking. |
| react-native-reanimated | ~4.1.1 | ~4.5.x | native (pinned) | Med | Lockstep with worklets. Hermes-V1 memory regression → **don't enable Hermes V1**. |
| react-native-worklets | 0.5.1 | ~0.10.x | native (pinned) | Med | Move with reanimated. |
| react-native-screens / safe-area-context / gesture-handler | 4.16 / 5.6 / 2.28 | via --fix | native (pinned) | Low | safe-area-context is edge-to-edge-sensitive — retest insets at 55 & 57. |
| @react-native-async-storage/async-storage | 2.2.0 | via --fix | native (pinned) | Low→Med | Zustand persist + **BootReceiver reads its SQLite `RKStorage` directly** — verify DB name unchanged. |
| @react-native-community/datetimepicker | 8.4.4 | via --fix | native (pinned) | Low | Add/Edit task modals. |
| expo-audio | ^55.0.14 | ~57.0.x | managed | Med | **Pre-existing skew** (a major ahead of expo 54). Resolve to 57 pin; retest alarm/ding. |
| expo-notifications | ~0.32.17 | via --fix | managed | Med | Channels + scheduled reminders; edge-to-edge-sensitive; **`notification` app.json field removed → config plugin** at 55. |
| expo-file-system | ~19.0.22 | via --fix | managed | Med | **`copy()`/`move()` become async at 56** — audit `dataTransfer.ts`. Backup/import ride on it. |
| expo-router | ~6.0.23 | ~7.0.x | managed | Med | Router major tracks SDK; verify tab navigator mounts. **No longer depends on React Navigation at 56.** |
| @react-navigation/* (native/bottom-tabs/elements) | ^7.x | ^7.x | managed | Low | Direct imports still used (`app/(tabs)`)? grep at 56 — codemod if any break. |
| expo-image / splash-screen / system-ui / status-bar | ~current | via --fix | managed | Low | edge-to-edge-adjacent; status-bar `backgroundColor`/`translucent` **deprecated at 55**. |
| expo-{constants,crypto,auth-session,web-browser,linking,document-picker,sharing,font,keep-awake} | ~current | via --fix | managed | Low | Stable. |
| @react-native-google-signin/google-signin | ^16.1.2 | latest w/ RN 0.86 | **native (NOT pinned)** | **High** | Expo won't set this. **Gating pre-check** — confirm a release supports RN 0.86/New Arch. Owns Drive-backup auth; silent break kills cloud backup. |
| jest-expo | ^55.0.17 | ~57.0.x | managed (dev) | Low | **Pre-existing skew** (major ahead). Land on 57 with SDK; align `jest` to its peer (may want jest 30). |
| eslint-config-expo / @types/react | ~10 / ~19.1 | via --fix | managed (dev) | Low | Bump with SDK. |
| zustand / typescript / eslint / @types/jest | current | unchanged | pure-js | Low | Independent of SDK. |

**No hard blocker** — the single gate is google-signin's RN 0.86 support (pre-check, Task #4).

## Per-hop breaking changes (relevant subset only)

### 54 → 55 — the heavy hop (RN 0.81→~0.83, React 19.1→19.2)
- **New Architecture mandatory** (`newArchEnabled` gone). Custom Kotlin (FloatingBubble bridge, receivers, ShareIntent, ParkingWatcher) **must run under New Arch**. It uses the legacy `ReactContextBaseJavaModule` + `ReactPackage` bridge — still supported via bridgeless interop on 0.8x, but **top risk; verify autoregistration + `@ReactMethod` calls at runtime.**
- **Edge-to-edge mandatory** (`edgeToEdgeEnabled` removed). In-app screens draw under system bars → **safe-area audit** of screens/modals (reuse `ScreenHeader` + safe-area-context). Overlay bubble (separate `TYPE_APPLICATION_OVERLAY` window) largely insulated — re-verify it draws over edge-to-edge activities.
- **`notification` app.json field removed → expo-notifications config plugin.** Migrate any static notification icon/color/sound config.
- **`expo-status-bar` `backgroundColor`/`translucent` deprecated**; **`removeSubscription` → `subscription.remove()`** — audit `src/utils/notifications.ts` + audio listeners.
- React 19.1→19.2 minor; no app-level API removals flagged.

### 55 → 56 (RN ~0.83→~0.85)
- **`expo-file-system` `copy()`/`move()` now async** — audit `src/utils/dataTransfer.ts` + cloud-backup serialization; `await` or use `*Sync`.
- **`@expo/vector-icons` unbundled from `expo`** — **non-issue here** (already explicit dep at `package.json:24`).
- **`expo/fetch` becomes default `globalThis.fetch`** — Google Drive REST calls in `googleDrive.ts` now run on Expo fetch; **exercise full backup+restore**; opt out with `EXPO_PUBLIC_USE_RN_FETCH=1` if regressions.
- **Expo Router no longer depends on React Navigation** — grep `@react-navigation`; codemod `sdk-56-expo-router-react-navigation-replace` if direct imports break.
- Most native/Gradle churn of the three hops (two RN minors).

### 56 → 57 (RN 0.85→0.86) — trivial
- "Easiest upgrade"; no user-facing breaking changes. **Edge-to-edge fixes that benefit us:** StatusBar updates while a Modal is open (app is modal-heavy), KeyboardAvoidingView fixed, `measureInWindow`/`Dimensions` corrected. Net positive; retest modals/keyboards.

### Cross-hop themes
- **Gradle 9 / AGP / Kotlin** bump across hops (esp. 55/56). Expect `modules/dragonflow-native/` Kotlin to need a recompile pass at each hop. Exact AGP/Gradle/compileSdk/targetSdk — **verify per hop** against the native upgrade helper.
- **New Arch** non-optional from 55; **Hermes V1 stays off** (reanimated memory regression).
- Rebuild the dev-client and regenerate native at **every** hop; go sequentially.

## Native module & build-pipeline risk (highest-value section)
All custom Android native is re-injected into generated `android/` by two scripts driven off **brittle text/regex anchors** against the RN template. That is the dominant risk surface — a new template layout makes an insert a **silent no-op** (no build error) and a receiver/service/package just vanishes at runtime.

**The prebuild→copy→patch chain:** `expo prebuild --clean` regenerates `android/` → `copy-native-files.js` copies 10 Kotlin files + res, injects the autolinking `BuildConfig` rename Gradle task, injects release signing, registers 3 packages in `MainApplication.kt`, writes `local.properties` → `patch-native-config.js` re-registers packages (idempotent dup) and patches `AndroidManifest.xml` (permissions, `<queries>`, `ACTION_SEND` filter, service/receivers). `app.plugin.js` adds 6 permissions via `expo-build-properties` *inside* prebuild.

### Files at risk
| File:line | Why it might break on SDK 57 | Risk |
| --- | --- | --- |
| `copy-native-files.js:80-84` | `tasks.whenTaskAdded` **deprecated, removed in Gradle 9** (SDK 57 ships Gradle 9.x) → migrate to `tasks.configureEach` | **High** |
| `copy-native-files.js:71` | `${buildDir}` **removed in Gradle 9** → `layout.buildDirectory`; also targets `ReactNativeApplicationEntryPoint.java` + rewrites `com.dragonflow.BuildConfig` — path/class/package string is RN-version-unstable | **High** |
| `copy-native-files.js:109-119` | Regex-injects release signing into `signingConfigs { debug { … } }` + `// Caution!` block — RN reflows `build.gradle`; miss = **release APK silently keeps debug signing** | **High** |
| `patch-native-config.js:85-101` | All permission inserts + `PACKAGE_USAGE_STATS` anchored on **`WRITE_EXTERNAL_STORAGE`** — edge-to-edge templates are dropping it → every insert silently fails | **High** |
| `patch-native-config.js:132-136` | Service/receiver insert anchored on `</activity>\s*\n\s*</application>` — any template element between them breaks the anchor | **High** |
| `patch-native-config.js:23-26` / `copy-native-files.js:152-155` | Package registration anchored on `packages.apply { // Packages that cannot be autolinked` — RN-version-dependent comment/shape; miss = bubble/share/parking **never register, no compile error** | **High** |
| `eas-build-post-install.sh:9` | Runs **only** `copy-native-files.js`, **not** `patch-native-config.js` → EAS builds miss service/receivers/share-filter/queries. Masked today (local builds). Upgrade is the moment to consolidate manifest edits into a real config plugin. | Med |
| `app.plugin.js:26` + `package.json` | `expo-build-properties` used but **not in deps/node_modules** — clean install on new SDK can fail prebuild plugin resolution. **Add it explicitly.** | Med |
| `modules/…/FloatingBubbleService.kt` | `TYPE_APPLICATION_OVERLAY`, FGS `specialUse`, `defaultDisplay.getMetrics()` — targetSdk 35+ device retest; getMetrics deprecated | Med |
| `modules/…/BootReceiver.kt:24` | Reads AsyncStorage SQLite `RKStorage` directly — verify DB name unchanged after async-storage bump | Med |

### Reconciliation checklist (run after every `prebuild:clean` on a new SDK)
1. **Diff generated files before building** — most failures are silent no-ops, not errors.
2. Confirm the autolinking entry point path/class + the `com.dragonflow.*` `BuildConfig` package still match (`copy-native-files.js:71-74`).
3. Verify `whenTaskAdded`/`${buildDir}` still valid on the shipped Gradle; migrate if Gradle 9.
4. Build a **release** APK; confirm it's env-keystore-signed, not debug.
5. Open generated `MainApplication.kt`; confirm all 3 `add(*Package())` present.
6. Grep generated `AndroidManifest.xml` for `FloatingBubbleService`, `BootReceiver`, `SoundAlarmReceiver`, `ACTION_SEND`, `com.unicell.pangoandroid`, all patched permissions + `PACKAGE_USAGE_STATS`, and the `WRITE_EXTERNAL_STORAGE` anchor.
7. EAS parity: add `patch-native-config.js` to `eas-build-post-install.sh` or migrate manifest edits to a config plugin.
8. Device smoke test (code can't prove): overlay draws, FGS starts, boot restore, ACTION_SEND in share sheet, parking poll fires, sound plays.

## Affected files (map)
- **Build/scripts:** `package.json:10-14,23-68`, `scripts/copy-native-files.js`, `scripts/patch-native-config.js`, `eas-build-post-install.sh`, `app.plugin.js`, `modules/dragonflow-native/app.plugin.js`, `app.json` (notification config, sdkVersion, plugins).
- **Native:** `modules/dragonflow-native/android/src/main/java/com/plgsw/dragonflow/*.kt` (10 files).
- **JS likely to touch:** `src/utils/notifications.ts` (removeSubscription, channels), `src/utils/dataTransfer.ts` (FS async copy/move), `src/services/cloudBackup/googleDrive.ts` (expo/fetch), audio listeners, any `@react-navigation` direct imports, safe-area/status-bar usages in screens/modals.

## Risks & mitigations (ranked)
1. **New Arch compat of custom Kotlin bridge (55)** — verify autoregistration + `@ReactMethod` at runtime on a device; the legacy bridge API is interop-supported but on the deprecation track.
2. **Silent regex/anchor misses in the two native scripts** — mitigate by diffing generated files + the reconciliation checklist each hop; harden anchors as needed (resilience rule: fix in the scripts, not generated files).
3. **Gradle 9 deprecations** (`whenTaskAdded`, `${buildDir}`) — likely hard failure at 57; fix in `copy-native-files.js`.
4. **google-signin RN 0.86 support** — gating pre-check (Task #4).
5. **expo-file-system async copy/move (56)** — audit `dataTransfer.ts`.
6. **expo/fetch default (56)** — full backup+restore round-trip; env opt-out available.
7. **EAS vs local pipeline divergence** — consolidate manifest edits (out-of-scope cleanup candidate; at minimum document).

## Feasibility & effort
- **Feasible, no hard blocker.** Effort **L** (3 sequential hops, native re-verification each). 54→55 is ~60% of the work (New Arch + edge-to-edge + notification plugin), 55→56 ~30% (FS async, fetch, Gradle churn), 56→57 ~10% (near-free + Gradle 9 script fixes).
- **Enabler assessment (per Analyze mandate):** the upgrade genuinely unlocks the better approach for the Share-text feature — `expo-share-intent` (v6+, SDK 55+) replaces `ShareIntentModule.kt` + `src/modules/ShareIntent.ts` + `useShareIntent.ts` and adds iOS parity. That migration is a **spawned side-way story**, out of scope here (per B1). Recorded for Story.

## Handoff to Story
Ship criteria to encode: (a) app builds (typecheck+lint+jest+release APK) at 57; (b) `expo-doctor` clean; (c) all custom native declarations present in generated manifest/MainApplication (checklist); (d) no behavior regression in notifications, audio, backup round-trip, share, bubble, boot restore, parking; (e) reanimated/worklets in lockstep, Hermes V1 off; (f) per-hop commit trail. Spawned stories: **expo-share-intent migration + iOS share target**; cleanup candidates: **EAS manifest parity / config-plugin consolidation**, **remove `packageManager: yarn` skew**, **add `expo-build-properties` to deps**.
