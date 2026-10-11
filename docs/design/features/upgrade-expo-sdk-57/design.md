# Design — Upgrade Expo SDK 54 → 57

Technical blueprint satisfying every AC in `story.md`. This is a **process** design (a repeatable per-hop playbook) plus the specific script hardening the upgrade forces. Grounded in the `expo-upgrade` skill + the repo's prebuild-resilience rules.

## Guiding constraints
- **Never raw `expo prebuild`.** Always `npm run prebuild:clean` (chains copy + patch). Fix native issues in `modules/dragonflow-native/` + `scripts/*.js`, never in generated `android/`.
- **Incremental**: one SDK major per hop; `expo install --fix` sets pins (no hand-editing versions).
- **No dev server, no device QA by the agent** — those are the user's. Agent verification = `npm run check` + `expo-doctor` + `prebuild:clean` + generated-file diff + release build.
- **Commit gate per hop** (🛑, standing rule). No Hermes V1, no React Compiler.

## The reusable hop procedure (applied at each of 54→55, 55→56, 56→57)

```
Hop to SDK <N>:
 1. git status clean; on develop (or the upgrade feature branch off develop).
 2. npx expo install expo@~<N>
 3. npx expo install --fix          # realigns all managed deps to the <N> pins
 4. Reanimated/worklets lockstep: confirm --fix moved BOTH; if not, expo install them together.
 5. Apply hop-specific migrations (see per-hop deltas below).
 6. Static gate:  npm run check      # tsc --noEmit && expo lint && jest
 7. npx expo-doctor                  # resolve failures; document accepted warnings
 8. Native regen:  npm run prebuild:clean
 9. Reconciliation checklist (analysis.md §checklist): diff generated AndroidManifest.xml
    + MainApplication.kt; grep for all custom declarations; verify autolinking rename +
    signing regex still hit. Fix any silent no-op IN THE SCRIPTS, then re-run prebuild:clean.
10. Build gate:  npm run build:apk   # confirms gradle compiles + release signing applied
11. 🛑 COMMIT GATE: show diff summary + review verdict; on "commit it" → run /precommit →
    commit "chore(expo): upgrade SDK <N-1>→<N> ..." → push to develop.
12. Update features.md ladder note + this folder as needed. Next hop.
```

> The user starts any dev server / device QA. The agent stops at the 🛑 in step 11.

## Per-hop deltas

### Hop 1 — 54 → 55 (heavy: New Arch + edge-to-edge + notifications)
Migrations layered into step 5:
1. **New Architecture** — remove `newArchEnabled` from `app.json` if present (now default). **Runtime-verify** the custom Kotlin bridge still registers under New Arch (device smoke test in Verify): FloatingBubble/ShareIntent/ParkingWatcher `@ReactMethod` calls resolve. Legacy `ReactContextBaseJavaModule` is interop-supported on 0.83 — no code change expected, but this is the top watch item.
2. **Notifications config plugin** — move any static notification config out of the removed `notification` app.json field into the `expo-notifications` plugin block in `app.json` (`plugins: [["expo-notifications", { icon, color, sounds }]]`). Verify channels + scheduled reminders still fire.
3. **Deprecation sweep** (code): `grep -rn "removeSubscription" src/` → `subscription.remove()`; audit `expo-status-bar` usages for `backgroundColor`/`translucent`/`networkActivityIndicatorVisible` → move to config plugin or drop.
4. **Edge-to-edge safe-area audit** — audit `app/(tabs)/*` + modals in `src/components/*Modal.tsx` for hardcoded top/bottom padding under system bars; prefer the existing `ScreenHeader` + `react-native-safe-area-context` insets (per memory: reuse `ScreenHeader`). Fix only real clipping.
5. **reanimated 4.1→4.5 + worklets 0.5→0.10** in lockstep via `--fix`.
6. `expo-audio`/`jest-expo` skew auto-resolves to the 55 pin here.

### Hop 2 — 55 → 56 (FS async + fetch + router/nav)
1. **expo-file-system async `copy`/`move`** — `grep -rn "\.copy(\|\.move(\|copyAsync\|moveAsync" src/utils/dataTransfer.ts src/services/cloudBackup/` ; ensure calls are `await`ed or switch to `*Sync`. Typecheck will catch signature changes.
2. **expo/fetch default** — no code change; **exercise Drive backup + restore round-trip** (Verify). If regressions, set `EXPO_PUBLIC_USE_RN_FETCH=1`.
3. **@react-navigation direct imports** — `grep -rn "@react-navigation" src/ app/`; if any direct imports break under Router-without-RN, run `npx expo-codemod sdk-56-expo-router-react-navigation-replace src`. (Tabs are via `expo-router`; likely nothing to do.)
4. `@expo/vector-icons` — no action (already explicit dep).
5. Expect the most Gradle/AGP churn here; run the full reconciliation checklist carefully.

### Hop 3 — 56 → 57 (trivial + Gradle 9 script fixes)
1. **Gradle 9 hardening in `scripts/copy-native-files.js`** (the one script edit the upgrade forces — see below).
2. Otherwise near-free. Retest modals/keyboard (edge-to-edge fixes are net-positive).

## Native-script hardening design (concrete)
Read the current `scripts/copy-native-files.js` and `scripts/patch-native-config.js` before editing. Two deterministic changes for Gradle 9 (SDK 57), applied to the **injected Groovy** in `copy-native-files.js`:

| Current (Gradle ≤8) | Gradle 9 replacement | Where |
| --- | --- | --- |
| `tasks.whenTaskAdded { task -> ... }` | `tasks.configureEach { task -> ... }` | autolinking BuildConfig-rename task hook (`copy-native-files.js:80-84`) |
| `${buildDir}/generated/autolinking/...` | `${layout.buildDirectory.get().asFile}/generated/autolinking/...` (or resolve via `layout.buildDirectory.dir(...)`) | autolinking entry-point path (`copy-native-files.js:71`) |

Anchor-resilience changes (apply **only if** the checklist finds a silent no-op on the new template — don't pre-emptively churn working anchors):
- If the RN template drops `WRITE_EXTERNAL_STORAGE`, repoint the permission/`PACKAGE_USAGE_STATS` anchors in `patch-native-config.js:85-136` to a stable element still present (e.g. the first `<uses-permission>` or the `<application` open tag).
- If the `packages.apply { // Packages that cannot be autolinked` comment shape changes, update the registration anchor in both `copy-native-files.js:152` and `patch-native-config.js:23`.
- If the release-signing `signingConfigs { debug {` / `// Caution!` block reflows, update the signing regex (`copy-native-files.js:109-119`) — **AC3 guards this** (release APK must be env-signed).

Add `expo-build-properties` to `package.json` `dependencies` at the SDK-57-compatible version (`npx expo install expo-build-properties`) so `app.plugin.js:26` resolves on a clean install.

## Criteria → design traceability
| AC | Design element that satisfies it | Verified by |
| --- | --- | --- |
| AC1 builds/checks | Step 6 `npm run check`, step 7 `expo-doctor`, run every hop | automated |
| AC2 native regen clean | Step 8 `prebuild:clean` + step 9 reconciliation grep/diff | automated grep + manual diff |
| AC3 release signing | Step 10 `build:apk` + signing-regex guard in hardening design | build + `apksigner verify` |
| AC4 dep hygiene | Steps 3-4 `--fix` + lockstep + `expo-build-properties` add; Hermes V1 left off | inspect `package.json` |
| AC5 no regression | Per-hop migrations (notifications plugin, FS async, fetch, edge-to-edge, safe-area) | device QA (Verify) |
| AC6 revertible trail | Step 11 one commit per hop on develop | git log |

## Test plan
- **Automated (agent, each hop):** `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npm run prebuild:clean`, generated-manifest grep assertions, `npm run build:apk` (final hop at minimum; ideally each hop).
- **Script idempotency:** run `copy-native-files.js` + `patch-native-config.js` twice; second run must be a no-op (they're `includes()`-guarded) — regression guard for the resilience rule.
- **Manual (user, Verify stage) device QA checklist** — the AC5 list: bubble overlay draws over edge-to-edge + boot restore, notifications (channels + scheduled), completion/alarm sound, Drive backup+restore round-trip, export/import, share-to-task (ACTION_SEND), parking watcher, task CRUD + persistence, no clipped content under system bars.

## Build order (summary)
1. (pre-check done ✅ google-signin 16.1.4 compatible)
2. Hop 54→55 → check → doctor → prebuild:clean → reconcile → build → 🛑 commit
3. Hop 55→56 → … → 🛑 commit
4. Hop 56→57 (+ Gradle 9 script fixes + expo-build-properties) → … → 🛑 commit
5. sdlc-verify → 🛑 QA handover
