# Verification — expo-share-intent migration (Android-only)

Checks the migration against `story.md` (AC1–16 + M1–M4). Committed `612951f` on `develop`. Landed on `expo-share-intent@8.0.1` (SDK 57).

## Automated verification
| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `tsc --noEmit` | ✅ PASS (validates `shareIntent.meta?.title` vs lib types; no dangling `RawShare`/bridge import) |
| ESLint | `eslint app/ src/` | ✅ PASS (0 errors; one intentional `set-state-in-effect` disable) |
| Tests | `jest` | ✅ PASS — 147/147, 19 suites (`shareText.test.ts` unchanged + green) |
| Native regen | `npm run prebuild:clean` | ✅ plugin ran ("IOS module disabled", "add android filters (text/*)"); copy + patch succeed |
| Clean removal (M3) | grep `src/ app/ scripts/ modules/ android/` | ✅ zero `ShareIntentModule/Package`, `NativeModules.ShareIntent`, `shareTextReceived`, `RawShare`, `src/modules/ShareIntent.ts` refs |
| Script idempotency (M4) | run copy + patch twice | ✅ 2nd run no-op (1 SEND filter, 1 FloatingBubble, 1 ParkingWatcher) |
| Adversarial review | `plg` sub-agent | ✅ APPROVE (traced exactly-once + re-anchor against library source) |

> No JDK/Android SDK in the agent env → **no gradle build / device run**. Behavior AC2–4, 12 and the parking-watcher regression guard are 📱 Pending device QA.

## Acceptance-criteria coverage
| # | Criterion | Method | Status |
| --- | --- | --- | --- |
| 1 | Appears as share target | library `text/*` filter generated (M1) | ✅ Verified (manifest) |
| 2,3 | Cold + warm start prefill | library cold (`refreshShareIntent` on mount) + warm (AppState/native onChange); code-reviewed | 📱 Pending (device) |
| 4 | Save creates task / Cancel doesn't | unchanged `tasks.tsx`/`AddTaskModal` | 📱 Pending (device) |
| 5 | **Best-effort title** (meta.title else text-derived) | `parseSharedText({text, subject: meta?.title})`; code review + shareText tests | ✅ Verified (logic) / 📱 device confirm |
| 6,7,8,10,11,11a,15 | text→field mapping, URL-as-text, size cap + `[TRIMMED]` | `shareText.ts` unchanged + unit tests | ✅ Verified (unit) |
| 9 | App defaults, editable | unchanged modal | 📱 Pending (device) |
| 12 | Exactly-once | `resetShareIntent()` on every delivery; reviewer traced no-refire/no-loop | ✅ Verified (logic) / 📱 device confirm |
| 13 | Malformed intent ignored, no crash | `resetShareIntent()` drains; falsy-text guard | ✅ Verified (logic) |
| 14 | Privacy — never log payload | only lengths in `console.warn`; lib logs gated behind `debug:false` | ✅ Verified (code) |
| 16 | Android-only, no iOS | `disableIOS:true` → "IOS module disabled"; no iOS artifacts | ✅ Verified |
| M1 | Exactly one ACTION_SEND filter | grep generated manifest = 1 | ✅ Verified |
| M2 | FloatingBubble + ParkingWatcher registered, no ShareIntent | grep generated MainApplication | ✅ Verified |
| M3 | Clean removal | grep clean | ✅ Verified |
| M4 | Prebuild-resilient + idempotent | 2× script run no-op | ✅ Verified |

## Manual QA checklist (yours — needs JDK + Android SDK)
Rebuild (full native): `npm run build:apk`, install on device, then:
1. **Share sheet** — from a browser/notes/messaging app, share text → DragonFlow appears as a target.
2. **Cold start** — app closed, share text → launches to Tasks with Add Task modal pre-filled.
3. **Warm start** — app running, share text → modal opens pre-filled, no restart / no lost state.
4. **Exactly-once** — after a share, background the app and share again; then remount/rotate — the task isn't created twice; the same share doesn't re-open the modal on return.
5. **Best-effort title (the accepted regression)** — share a browser *page*: title is now the URL host or first line (was the page title via EXTRA_SUBJECT). Multi-line/plain text: first line → title (unchanged). Confirm this is acceptable in practice with your real share sources.
6. **`[TRIMMED]`** — share >10k chars → description truncated with the `[TRIMMED]` marker.
7. **Privacy** — `adb logcat` during a share on a **release** build → no shared-text content in logs (only the lengths-only warn if oversized).
8. **Parking-watcher regression guard (re-anchor)** — background the parking app → the arm-reminder prompt still appears (proves `ParkingWatcherPackage` still registered after ShareIntent removal).
9. **Bubble/boot/sound/notifications** — quick smoke that the other native modules are unaffected.

## Pre-existing bugs / issues found
- **[LOW, pre-existing, not this feature]** `copy-native-files.js` / `patch-native-config.js` register custom packages by regex against the Expo template's `// Packages that cannot be autolinked` anchor. If a future SDK renames that anchor, FloatingBubble (and thus the ParkingWatcher block anchored on it) would be dropped **silently** (`content !== before` false → no write, no error). Surfaced by the migration review; predates this change. Fix direction: after each registration block, assert the package string is present and `throw`/warn if not, so template drift fails loud. → File as its own backlog `Idea` (build-pipeline hardening) if desired.
- No app-behavior bugs surfaced.

## Known limitations
- **Subject→title regression (AC5)** — accepted best-effort; `expo-share-intent` cannot read `EXTRA_SUBJECT`. Tracked in the story.
- **iOS share target** — out of scope; deferred to its own backlog row (`disableIOS:true`).
- **doctor 20/21** — pre-existing SDK-57 **patch** drift (expo 57.0.9 vs 57.0.16 etc.), unrelated to this migration; resolve with a standalone `npx expo install --fix` whenever convenient.
- Device build + behavior unverified in agent env (no JDK/SDK).

## Verdict
**Built · QA pending.** Automated verification fully green (typecheck, lint, 147 tests, prebuild reconciliation M1–M4, idempotency) and adversarial review APPROVE. Static/logic-provable criteria (1, 5–8, 10–16, M1–M4) ✅ Verified; delivery-behavior criteria (2–4, 9, 12 device-confirm) 📱 Pending on-device QA — do not mark Verified until the checklist passes on a device (especially the parking-watcher regression guard).
