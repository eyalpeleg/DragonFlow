# Verification — Share-text target

> Stage 8 of the SDLC flow. Checks the built feature against the story's acceptance criteria. Two halves: **automated** (run now) and **manual on-device QA** (needs a native rebuild). Every criterion gets a verification method and a status.

Input: [story.md](story.md) (criteria) + [design.md](design.md) (test plan) + the implementation (commit `207b316`).

## Automated verification (run this session — all green ✅)

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS (0 errors) |
| ESLint | `npx eslint app/ src/` | ✅ PASS (0 errors, 0 warnings) |
| Unit tests | `npm test` | ✅ 101/101 pass (13 suites; 12 new in `shareText.test.ts`) |
| Prebuild resilience | re-run patch scripts ×2 | ✅ Idempotent — SEND filter ×1, package registration ×1 |
| Manifest injection | inspect generated manifest | ✅ SEND `text/plain` filter lands **inside** `.MainActivity` |
| No new dependency | `package.json` unchanged | ✅ Confirmed |

## Acceptance-criteria coverage

Legend: **✅ Verified** (automated/review) · **📱 Pending** (needs on-device QA).

| # | Criterion | Method | Status |
|---|-----------|--------|--------|
| 1 | Appears in Android share sheet | On-device | 📱 Pending |
| 2 | Cold start → opens prefilled modal | On-device | 📱 Pending |
| 3 | Warm start → prefilled, no state loss | On-device | 📱 Pending |
| 4 | Save creates / Cancel discards | On-device (+ existing modal logic) | 📱 Pending |
| 5 | subject+body → title/description | Unit test | ✅ Verified |
| 6 | first line → title, rest → description | Unit test | ✅ Verified |
| 7 | bare URL → hostname/URL, never fetched | Unit test | ✅ Verified |
| 8 | short single line → title, empty desc | Unit test | ✅ Verified |
| 9 | defaults (Medium/Default), editable | Code review + on-device | ✅ Review / 📱 Pending |
| 10 | blank/whitespace → no task | Unit test (parser→null) + on-device | ✅ Verified / 📱 e2e |
| 11 | title too long → shortened, full body kept | Unit test | ✅ Verified |
| 11a | oversized → `[TRIMMED]` marker + length-only log | Unit test (marker) + on-device (logcat) | ✅ Marker / 📱 log |
| 12 | delivered exactly once (remount/rotate) | Code review (`removeExtra` + clear-after-read) + on-device | ✅ Review / 📱 Pending |
| 13 | malformed intent → graceful, no crash | Code review (guards + try/catch) + on-device | ✅ Review / 📱 Pending |
| 14 | payload never logged | Code review (no content logs; trim log is length-only) + on-device (logcat) | ✅ Review / 📱 logcat |
| 15 | never execute/fetch shared text | Unit test + code review (string-only) | ✅ Verified |
| 16 | Android-only, correct name/icon | Code review (Platform guards, manifest) + on-device | ✅ Review / 📱 icon |

**Automated/review-verifiable criteria: all pass.** Remaining items need a native rebuild on a device/emulator.

## Manual QA checklist (run after a native rebuild)

Rebuild is required — this is native + manifest, not a Metro-reloadable change:
```bash
npm run prebuild:clean && npm run android
```
Then, from another app (browser/notes/messages) use Android Share → DragonFlow:

- [ ] **(1)** DragonFlow appears in the share sheet for selected text.
- [ ] **(2)** With the app **closed**, sharing opens it to Tasks with the Add Task modal prefilled.
- [ ] **(3)** With the app **running**, sharing opens the prefilled modal without losing current state.
- [ ] **(4)** Save → task appears in Ready; Cancel → no task.
- [ ] **(5–8)** Share a browser tab (subject+URL), a multi-line note, a bare URL, and a short phrase → title/description map as specified.
- [ ] **(9)** Priority Medium / Default category; all fields editable before saving.
- [ ] **(10)** Share blank/whitespace → nothing happens (no empty modal, no task).
- [ ] **(11a)** Share a >10k-char text → description ends with `[TRIMMED]`; `adb logcat` shows a length-only trim line (no content).
- [ ] **(12)** Share once, then rotate the device / background+foreground → task is **not** created twice.
- [ ] **(13)** (Best-effort) malformed share → app ignores it, no crash.
- [ ] **(14)** `adb logcat` during a share shows **no** shared-text content.
- [ ] **(16)** Share-sheet entry shows the app's name and icon.

## Known limitations (v1)

- A second share arriving **while the Add Task modal is already open** is last-one-wins but won't re-seed the open modal (rare; acceptable for v1 per story "last-one-wins").
- iOS not supported (out of scope; see the "Upgrade Expo SDK 54 → 57" enabler story).

## Verdict

**Automated verification complete and green; feature is code-complete.** Definition of Done is met for all automated/review criteria. **Sign-off is pending the on-device manual QA checklist** above (requires a native rebuild, which is user-initiated). No regressions in the existing suite.
