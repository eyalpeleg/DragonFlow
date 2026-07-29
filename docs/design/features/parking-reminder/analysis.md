# Analysis — Pango Reminder

> SDLC Stage 3 (Analyze). Slug: `parking-reminder`. Input: [brainstorm.md](brainstorm.md). Feeds `sdlc-story`.
> Android-only. Mechanism **A5** (detect Pango usage → on background, prompt to arm a reminder). Data model **B2** (lightweight `parkingSession` record).

## 1. Resolved mechanism (was the deferred make-or-break)

**Decision: detect Pango's foreground→background via `UsageStatsManager`, polled from the existing `FloatingBubbleService` foreground service.**

| Candidate | Signal | Verdict |
|-----------|--------|---------|
| **`UsageStatsManager`** | `queryEvents()` → `MOVE_TO_BACKGROUND`/`ACTIVITY_PAUSED` for the Pango package. Historical only — **no push callback**, must poll (~1.5s window) from a foreground service. Permission: `PACKAGE_USAGE_STATS` (special access, granted at *Settings → Apps → Special app access → Usage access*, not a runtime dialog). | ✅ **CHOSEN.** Minimum-necessary data (only *which* package ran + when, never content). Reuses our existing FGS + overlay-permission flow pattern. |
| NotificationListenerService | Pango notification posted/removed only. | ❌ Wrong signal — tells us nothing about background state unless Pango posts a notification at that instant, which we can't assume. Also "sees all notifications" privacy cost. |
| AccessibilityService | `TYPE_WINDOW_STATE_CHANGED` — real-time, most reliable. | ❌ **Policy landmine.** Play restricts Accessibility API to disability tools; non-declared use risks app/account suspension, and Android 17 auto-revokes it for non-accessibility apps. Unacceptable given a possible future Play publish (memory: DragonFlow may be published). Documented as the explicit rejected alternative. |
| `ActivityManager.getRunningAppProcesses` | — | ❌ Since Android 5.1 returns only the caller's own processes. Dead end. |

**Winner spec (concrete):**
- APIs: `UsageStatsManager.queryEvents(begin, end)` → `UsageEvents.Event` (`getEventType()`, `getPackageName()`, `getTimeStamp()`); permission check via `AppOpsManager.checkOpNoThrow(OPSTR_GET_USAGE_STATS)`; grant deep-link via `Settings.ACTION_USAGE_ACCESS_SETTINGS` (mirror `FloatingBubble.requestOverlayPermission()`).
- **Reuse the existing `FloatingBubbleService`** foreground service — add a poll loop (Handler/coroutine ~1.5s) gated by "monitoring enabled"; do **not** add a second service.
- **Pango package id ≈ `com.unicell.pangoandroid`** (from Play listing) — **must be verified on-device** (`adb shell pm list packages | grep -i pango`) and treated as **config/constant**, not hardcoded in logic (rebrand-safe; also lets us add other transport apps later).
- Latency realistically **1–5s**; `queryEvents` returns null while device locked (Android R+).
- Bridge a `pangoBackgrounded` event to JS via `NativeEventEmitter`, mirroring `FloatingBubble.ts`'s `onDismissed`/`onOpenFocus`.

## 2. Product-depth analysis

**Core flow:** monitoring armed (opt-in) → user opens Pango, does their thing, backgrounds it → within ~1–5s DragonFlow gets `pangoBackgrounded` → **prompt** "Started parking? Remind me to stop in [30m / 1h / 2h / custom]? · Not parking · Stop asking today" → on confirm, create a `parkingSession` (B2) + schedule an OS reminder + show the floating-bubble chip → at fire time, notify + bubble "Stop your Pango parking" with *Snooze* / *Open Pango* → user opens Pango & stops it, then marks done (bubble/notification action or in-app) → session cleared.

**Why the confirm step exists:** Pango is multi-purpose (parking *and* public-transport payment), so we cannot assume a Pango session is parking. The human confirm both disambiguates trip type and captures the duration — this is the core product insight, not a bolt-on.

## 3. Non-functional analysis (prioritized)

- **P0 · Privacy — minimum scope + never leaves device.** UsageStats can observe *all* app usage; we read only to detect the Pango transition, then **discard** the raw query — store only the derived "parking started at T for N min," never other apps. Nothing logged (`console.log`) about app usage. **Parking data MUST be excluded from `exportData()`** (`src/utils/dataTransfer.ts`) so it never syncs to Google Drive. Permission UI must honestly state: "we only detect that Pango ran; we never read content; nothing leaves your device."
- **P0 · Prompt-fatigue is an adoption kill.** Most Pango backgrounds aren't parking. Guardrails (all first-class acceptance criteria): (a) debounce — ignore Pango foreground < ~15–20s; (b) prompt actions *Yes / Not parking / Stop asking today*; (c) cooldown after a dismissal; (d) suppress while a session is already active; (e) global on/off in Settings, **default OFF** until opt-in.
- **P0 · Mechanism = UsageStats only** (see §1) — accessibility/notification-listener are kill-level for publishability/correctness.
- **P1 · Reliability — survive service death & reboot.** OEM battery-killers (Xiaomi/Samsung) kill FGS; Usage access can be silently revoked. Mitigations: (a) `parkingSession` persisted in store so it survives process death; (b) **extend `BootReceiver.kt`** to detect an active session and restore bubble/notification on reboot (concrete native change — spawns a side-way story); (c) schedule the reminder as an **OS notification/alarm** from `startedAt + durationMin` using absolute epoch math (survives service death, no TZ drift); (d) if permission revoked, surface it in Settings rather than silently no-op.
- **P1 · Security.** New/extended service stays `android:exported="false"`; "Open Pango" uses a fixed-package `getLaunchIntentForPackage(<pango pkg>)` with graceful fallback if not installed — never an implicit intent. Validate `durationMin` bounds before scheduling.
- **P1 · Battery.** Poll only when armed; state machine **idle (no poll) → poll briefly to confirm background → stop polling once a session is armed or the prompt is declined**. No 24/7 loop.
- **P2 · Accessibility.** Prompt + nudge use shared components / `ScreenHeader` pattern, `accessibilityLabel`+`accessibilityRole`, ≥44dp targets, never color-only state.

## 4. Affected files (code map)

**JS/TS**
- `src/store/appStore.ts` — new `parkingSession: ParkingSession | null` + `pangoReminderEnabled: boolean` in `TaskStore` (`:90-160`, near pomodoro `:104-108`); defaults in factory (`:164-192`); actions `startParkingSession`/`clearParkingSession`/`setPangoReminderEnabled` (model on `setPomodoroTimer`/`clearPomodoroTimer` `:429-448`, setters `:396-398`); `partialize` add `pangoReminderEnabled` (+optionally `parkingSession`) (`:512-537`); `onRehydrateStorage` re-validate stale session (`:633-654`). **Persist migration: NOT required** — new optional pref + nullable transient fall through `merge` cleanly; only bump `_schemaVersion` (`:532` & `:622`) if forcing a reset.
- `src/utils/notifications.ts` — `scheduleParkingReminder(durationMin, sessionId)` + `cancelParkingReminder(id)` modeled on `schedulePomodoroEnd` (`:65-84`) / `cancelPomodoroNotification` (`:86-89`); reuse `REMINDERS_CHANNEL` (`:10`) or add a `PANGO_CHANNEL` entry to `CHANNEL_DEFS` (`:41-44`).
- `src/modules/FloatingBubble.ts` — reuse `show`/`hide`; add a sibling JS bridge `PangoWatcher.ts` (`onPangoBackgrounded(cb)`, `requestUsageAccess()`, `hasUsageAccess()`, `startMonitoring`/`stopMonitoring`) mirroring `onDismissed`/`onOpenFocus` (`:49-68`).
- `app/_layout.tsx` — subscribe `PangoWatcher.onPangoBackgrounded(...)` in the main effect (`:42-110`, model on `onOpenFocus` `:74-77`) with teardown (`:104-109`); channel setup already at `:44`.
- `app/(tabs)/settings.tsx` — new `<CollapsibleSection title="Pango Reminder">` with an enable `Switch` (model on "Show Bubble" `:340-356`) + a "Grant usage access" button (model on Google sign-in row `:533-545`); destructure new store bits at `:193`.
- `src/types.ts` — `ParkingSession` interface **only if** shared across ≥2 modules; else define inline in `appStore.ts` (repo convention: pomodoro transient lives inline).
- Prompt UI — a small `usePangoReminder()` hook + a confirm modal/prompt (model on `useShareIntent` consumed in `app/(tabs)/tasks.tsx:42`); reuse existing modal patterns.

**Native (`modules/dragonflow-native/`)**
- New `PangoWatcherModule.kt` + `PangoWatcherPackage.kt` (copy `ShareIntentModule.kt`/`ShareIntentPackage.kt` structure — the purpose-built "detect Android signal → typed JS event" model).
- Extend `FloatingBubbleService.kt` with the gated UsageStats poll loop; extend `BootReceiver.kt` for session restore.

**Build resilience (must edit — never touch generated `android/`)**
- `scripts/copy-native-files.js` — add the two new `.kt` to `kotlinFiles` (`:23-31`); add `PangoWatcherPackage` to MainApplication import + registration blocks (`:127-153`).
- `scripts/patch-native-config.js` — add `android.permission.PACKAGE_USAGE_STATS` to `permissionsToAdd` (`:57-62`); register `PangoWatcherPackage` (`:21-46`, keep in sync with copy script); add `<service>`/receiver if needed (`:84-89`).

**Tests (co-located `__tests__/`)**
- Store action test for `startParkingSession`/`clearParkingSession` (model `src/store/__tests__/focusMode.test.ts` mock header).
- `scheduleParkingReminder`/`cancelParkingReminder` unit test (model `notifications.sound.test.ts`).
- Pure duration/expiry helper test if extracted (model `shareText.test.ts`).
- Native Kotlin has no test harness (consistent w/ FloatingBubble/ShareIntent) → detection verified via manual QA.

## 5. Risks & open items

| # | Risk | Severity | Mitigation / owner |
|---|------|----------|--------------------|
| R1 | Pango package id unconfirmed (`com.unicell.pangoandroid`?) | High | Verify on-device; store as config constant. Blocks native impl until confirmed. |
| R2 | Prompt-fatigue → user disables/uninstalls | High (P0) | Debounce + cooldown + "not parking"/"stop asking" + suppress-while-active + default-off. |
| R3 | Usage-access data syncing to Drive / logged | High (P0) | Exclude `parkingSession` from `exportData()`; never log usage; discard raw query. |
| R4 | FGS killed by OEM / permission revoked → silent failure | Med (P1) | Persist session; OS-alarm reminder; BootReceiver restore; surface revoked permission in Settings. |
| R5 | Bubble ownership contention (task-urgency vs pomodoro vs parking) | Med | Explicit priority order in Design; precedent = pomodoro guard (`appStore.ts:58`, `_layout.tsx:88-89`). |
| R6 | Poll battery cost | Low-Med (P1) | Idle→confirm→stop state machine; only when armed. |
| R7 | Locked-device null `queryEvents` (Android R+) / 1–5s latency | Low | Acceptable; reminder is minutes-scale, not seconds. |

## 6. Side-way enabler stories (spawned)

1. **Usage-access permission-request UX + prominent-disclosure screen** — honest disclosure copy, deep-link to Usage access settings, granted/revoked state. Its own story (gated, reused if we later publish).
2. **`BootReceiver` extension for parking-session restore** — native + `copy-native-files.js` pipeline change; scope separately from the JS feature.

*(These can be folded into the main story as sub-scope for a personal app, or split — Story stage decides.)*

## 7. Effort & verdict

- **Effort: M** (native UsageStats poll + JS bridge + store slice + prompt UI + Settings + tests). No dependency upgrades needed — pure native + RN, fits current Expo SDK 54 without ejecting further.
- **No enabler dependency upgrade** unlocks a materially better approach here (this is native-Android-capability-bound, not library-bound).
  - **Expo SDK 54→57 is orthogonal to this feature** — no Expo/RN library wraps `UsageStatsManager`, so 57 unlocks nothing to simplify/delete here (unlike the share-text feature, which had `expo-share-intent`). The only interaction is the generic one hitting *all* custom native modules: if 57 forces the New Architecture/TurboModule migration, `PangoWatcherModule` migrates in the same sweep as `FloatingBubbleModule`/`ShareIntentModule`, owned by the upgrade story — building on the current bridge pattern now adds no pango-specific rework. Do not block pango on the upgrade, nor vice versa.
- **Verdict: feasible, advance to Story.** Kill-conditions from brainstorm are NOT met (UsageStats mechanism is viable and publishable). The P0 privacy + prompt-fatigue items become mandatory acceptance criteria.

➡️ **Next:** `sdlc-story` — turn this into a user story with testable acceptance criteria (fold the P0/P1 NFRs into Given/When/Then; decide whether the two enabler stories are in-scope sub-tasks or split).
