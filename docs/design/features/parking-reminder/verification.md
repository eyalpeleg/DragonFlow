# Verification — Pango Reminder

> SDLC Stage 8 (Verify). Slug: `parking-reminder`. Checks the built feature against [story.md](story.md) AC1–AC25. Committed to `develop` as `aa5d258` (not pushed). Android-only.

## Automated verification

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | ✅ 0 errors |
| ESLint | `npm run lint` (`expo lint`) | ✅ 0 errors, 0 warnings |
| Tests | `npm test` (Jest) | ✅ 147 passed / 147, 19 suites |
| Build-script idempotency | `copy-native-files.js` + `patch-native-config.js` ×3 | ✅ `PangoWatcherPackage`, `PACKAGE_USAGE_STATS`, `xmlns:tools`, `<queries>` each present exactly once |
| No new JS dependency | inspection of `package.json` | ✅ none added |
| Platform scope | inspection | ✅ Android-only; all bridges `Platform.OS==='android'`-guarded; no iOS paths |

New/extended test suites: `utils/__tests__/parking.test.ts` (14 cases), `utils/__tests__/notifications.parking.test.ts`, `store/__tests__/parking.test.ts`, `store/__tests__/bubbleResolver.test.ts`, `utils/__tests__/dataTransfer.test.ts` (AC17 exclusion).

## Acceptance-criteria coverage

| AC | Method | Status |
|----|--------|--------|
| AC1 arm prompt on Pango background | native poll → hook → modal; device flow | 📱 Pending (device) |
| AC2 arm creates session + schedules | `store/parking.test.ts`, `parking.test.ts` (`computeRemindAt`) | ✅ Verified (automated) |
| AC3 custom duration bounds | `parking.test.ts` (`isValidDuration`), `store/parking.test.ts` | ✅ Verified (automated) |
| AC4 nudge notification + actions | `notifications.parking.test.ts` (DATE trigger, category); delivery | ✅ scheduling Verified / 📱 on-device delivery Pending |
| AC4a live bubble countdown | code inspection (`parkingRunnable`, `formatParking`); render | 📱 Pending (device) |
| AC4b overdue state (+Xm, red border, text) | `parking.test.ts` (`formatOverdue`); render | ✅ format Verified / 📱 render Pending |
| AC5 extend (bubble/notif/in-app) | `parking.test.ts` (`computeExtend`), `store/parking.test.ts` | ✅ logic Verified / 📱 entry-points Pending |
| AC5a extend 24h cap | `parking.test.ts`, `store/parking.test.ts` | ✅ Verified (automated) |
| AC6 open Pango (installed/uninstalled) | code inspection (`getLaunchIntentForPackage`, `<queries>`) | 📱 Pending (device — needs Pango installed) |
| AC7 done clears | `store/parking.test.ts` | ✅ Verified (automated) |
| AC7a bubble precedence parking>pomodoro>tasks | `bubbleResolver.test.ts` (pure) + race fix inspection | ✅ resolver Verified / 📱 native hand-off Pending |
| AC8 <20s debounce | native inspection (`DEBOUNCE_MS`) | 📱 Pending (device) |
| AC9 suppress while active | `usePangoReminder` inspection + `store/parking.test.ts` | ✅ Verified (inspection+test) |
| AC10 not-parking cooldown 30m | `store/parking.test.ts` (`setPangoSuppressedUntil`) | ✅ Verified (automated) |
| AC11 stop-asking-today → midnight | `parking.test.ts` (`nextLocalMidnight`), `store/parking.test.ts` | ✅ Verified (automated) |
| AC12 default OFF | `store/parking.test.ts` | ✅ Verified (automated) |
| AC13 disclosure before grant | code inspection (Settings disclosure modal) | 📱 Pending (device) |
| AC14 grant deep-link | code inspection (`requestUsageAccess` → `ACTION_USAGE_ACCESS_SETTINGS`) | 📱 Pending (device) |
| AC15 revoked surfaced | code inspection (`hasUsageAccess` re-check on focus/resume) | 📱 Pending (device) |
| AC16 no usage logging | grep: zero `Log.*`/`console.*` of package/usage in new JS+Kotlin | ✅ Verified (inspection) |
| AC17 excluded from backup | `dataTransfer.test.ts` assertion | ✅ Verified (automated) |
| AC18 service not exported | inspection (reuses `FloatingBubbleService`, `exported=false`; no new `<service>`) | ✅ source Verified / 📱 built-manifest Pending |
| AC19 intent safety + bounds | inspection (fixed-package launch) + `computeExtend`/`isValidDuration` tests | ✅ Verified (automated+inspection) |
| AC20 persist/rehydrate re-arm/expiry | inspection (`partialize`, `onRehydrateStorage`) | ✅ Verified (inspection) / 📱 end-to-end Pending |
| AC21 reboot restore | inspection (`BootReceiver` parkingSession branch) | 📱 Pending (device) |
| AC22 poll only when armed | inspection (idle→confirm→stop, `maybeStopIfIdle`) | ✅ logic Verified / 📱 battery Pending |
| AC23 Android-only, no iOS regression | inspection (guards) | ✅ Verified (inspection) |
| AC24 build resilience | idempotency runs ×3 | ✅ Verified (automated) / 📱 full `prebuild:clean` Pending |
| AC25 a11y | inspection (`accessibilityLabel`/`Role`, ≥44dp, text+icon) | ✅ source Verified / 📱 TalkBack Pending |

## Manual QA checklist (on device — after a native rebuild)

**Rebuild first (native — not a hot reload):**
```bash
npm run android
```

**Pre-flight — device-specific:**
- [ ] Confirm Pango's package id on this device: `adb shell pm list packages | grep -i pango` → expect `com.unicell.pangoandroid`. If different, update `PANGO_PACKAGE` in `PangoWatcherModule.kt` and rebuild.

**Enable + permission (AC13/14/15):**
- [ ] Settings → Pango Reminder → toggle on → **disclosure modal appears** stating "detects only that Pango ran, nothing leaves device" (AC13).
- [ ] Continue → lands on **Settings → Usage access**; grant DragonFlow (AC14).
- [ ] Revoke Usage access in system settings, return to app → Settings shows the **"Grant usage access"** CTA (AC15).

**Detect → arm (AC1/AC8):**
- [ ] With feature on + granted: open Pango, use it >20s, background it → within ~5s the **arm prompt** appears (30m/1h/2h/custom, default 1h) (AC1).
- [ ] Glance at Pango <20s then background → **no prompt** (AC8).
- [ ] Tap **Not parking** → no prompt again for ~30 min (AC10); tap **Stop asking today** on a later prompt → none until tomorrow (AC11).

**Countdown + extend + done (AC4/4a/4b/5/6/7):**
- [ ] Arm 1h, background app → **bubble shows a live countdown** `h:mm`, ticking (AC4a).
- [ ] Let it pass the end (or arm a short custom) → bubble flips to **overdue `+Xm` with red border** (AC4b); notification "Stop your Pango parking" fires with **Extend / Open Pango** (AC4).
- [ ] Tap bubble → in-app sheet; **+5/+15/+30/+60** each push the end out; try to extend past 24h-from-start → **rejected with a message** (AC5/AC5a).
- [ ] **Open Pango** from the sheet and from the notification action → Pango launches (AC6). Then uninstall Pango (or test on a device without it) → **graceful message, no crash** (AC6).
- [ ] Mark **Done** → reminder + bubble clear (AC7).

**Precedence (AC7a):**
- [ ] Start a pomodoro, then arm parking, background → **parking countdown wins** the bubble. Mark parking Done → bubble **returns to the running pomodoro** (not a static count).

**Reliability (AC20/AC21/AC22):**
- [ ] Arm parking, force-stop the app, reopen → session still active, reminder still fires at the original time (AC20).
- [ ] Arm parking, **reboot** the device → bubble/countdown restored on boot (AC21).
- [ ] Observe battery/polling: with feature on but idle, confirm no continuous drain; polling only bursts around Pango use (AC22).

**Platform / build / a11y (AC18/AC23/AC24/AC25):**
- [ ] Inspect built `android/app/src/main/AndroidManifest.xml` → `FloatingBubbleService` still `android:exported="false"` (AC18).
- [ ] `npm run prebuild:clean` then rebuild → PangoWatcher registration + `PACKAGE_USAGE_STATS` + `<queries>` re-applied; re-running the scripts is a no-op (AC24).
- [ ] iOS build unaffected / feature absent (AC23).
- [ ] TalkBack: arm prompt + action sheet controls are labelled and reachable; overdue conveyed by text not colour alone (AC25).

## Pre-existing bugs found

None surfaced during this verification. (The 7 adversarial-review findings were all in the new feature code and were fixed before commit; none were pre-existing defects in unrelated code.)

## Known limitations (accepted for v1)

1. **UsageStats poll window vs debounce** — `queryEvents(now−10s, now)` with a 20s debounce means a Pango foreground that occurred >10s before monitoring (re-)armed can be missed, so that one background may not prompt. Narrow (only right at enable / re-arm). Tracked here; revisit if it bites in QA.
2. **Detection lifetime** — the JS watcher is mounted in `TasksScreen` and the native poll lives in-process, so detection is active only after the Tasks tab has been visited (tab screens stay mounted) and while the app process is alive. Inherent to the design.
3. **`pangoUsageGranted` optimistic default** — defaults `true` and a thrown `hasUsageAccess()` check leaves it stale, so an errored check would hide the grant CTA. Low impact: the native call resolves `false` rather than throwing.
4. **Multiple transport apps** — v1 is Pango-only (package id is config, not hardcoded). Tracked as a Follow-up in `features.md`.

## Verdict

**Automated verification is green and the feature is code-complete:** typecheck, lint, and 147 tests pass; build-script idempotency verified; privacy P0 (backup exclusion + no usage logging) verified by test + inspection; the adversarial review's findings were fixed pre-commit. Every AC provable without a device is **✅ Verified** (16 of 25 fully or partially).

**Sign-off is pending the on-device QA checklist above** — the remaining criteria (detection latency/debounce, bubble countdown/overdue rendering, permission disclosure/grant/revoke flow, open-Pango, reboot restore, battery, built-manifest `exported=false`, TalkBack, and the Pango package-id confirmation) can only be proven on a real Android device with a native build, which is the user's to run.

Backlog status: **Built · QA pending** — not advanced to *Verified* until the device checklist passes.

➡️ On QA pass: advance the row to **Verified**; on release, move it to the **Shipped** table with key files. If a manual criterion fails, loop back to the relevant stage rather than patching blindly.
