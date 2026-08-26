# Design — Pango Reminder

> SDLC Stage 5 (Design). Slug: `parking-reminder`. Inputs: [story.md](story.md) (AC1–AC25), [analysis.md](analysis.md). Implementable-from-directly blueprint. Android-only.

## Approach

Detect that **Pango** (`com.unicell.pangoandroid`, v13.1608 — confirmed on-device) moved to the background via **`UsageStatsManager`**, polled from the **existing** `FloatingBubbleService` (no second service). On a debounced background event → JS prompts to arm a **lightweight `parkingSession`** (a store record, *not* a Task) with a chosen duration → schedule an absolute-time OS reminder + drive the floating-bubble **live countdown** → user extends (5/15/30/60) or marks done. **No new JS dependency.** All native additions routed through `copy-native-files.js` + `patch-native-config.js` (idempotent), never into generated `android/`.

**Key division of labor (the load-bearing contract):** *all logic and precedence live in JS; native is dumb.* JS is the single source of truth for `remindAt` (absolute epoch) and for which of the 3 owners drives the bubble; native only renders/ticks the last mode pushed and derives running-vs-overdue from `sign(remindAt − now)`. **Extend = JS re-pushes `startParkingTimer(newRemindAt, …)`** — there is no native extend, no native precedence.

**Refinements of analysis (recorded):**
- **Reuse `FloatingBubbleService`** for the poll loop — no new `<service>`, so no new exported surface (AC18 satisfied for free).
- **No `_schemaVersion` bump** — new fields are optional/nullable and fall through the existing `merge` (analysis §4 confirmed against `appStore.ts`).
- **`exportData()` already excludes parking** (verified: `ExportPayload` = tasks/categories/settings only) — the obligation is a *negative constraint* (never add `pango*` to the settings block) + a regression test, not new exclusion code.
- **Notification-response routing is greenfield** — no `addNotificationResponseReceivedListener` exists anywhere today; we add exactly one in `_layout.tsx`.
- **`<queries>` manifest entry is mandatory** (not in analysis) — under Android 11+ package visibility, `getLaunchIntentForPackage("com.unicell.pangoandroid")` returns null without it, silently breaking AC6.

## Data flow

```
                    ┌──────────────────────── NATIVE (dumb) ────────────────────────┐
 Pango used ──► FloatingBubbleService.pangoPollRunnable (~1.5s, gated on Usage-access)
                    │  queryEvents(now-10s, now) → filter com.unicell.pangoandroid   │
                    │  FG→store ts;  BG→ if (bg-fg) ≥ 20s (DEBOUNCE)  ──► emit ──┐   │
                    │  then SELF-STOP poll (idle→confirm→stop, AC22)             │   │
                    └────────────────────────────────────────────────────────────┼──┘
                                                                                   ▼
                          onPangoBackgrounded  ──►  usePangoReminder hook (JS guardrails:
                                                     enabled? suppressed? session active?)
                                                                  │ pass
                                                                  ▼
                                                       PangoArmModal (30/60/120/custom)
                                          ┌── Not parking → suppress 30m   ── dismiss(kind)
                                          ├── Stop asking today → suppress→ nextLocalMidnight
                                          └── arm(D) ─► store.startParkingSession(D)
                                                          │
   ╔══════════════════ PURE / TESTABLE SEAM: src/utils/parking.ts ══════════════════╗
   ║ isValidDuration · computeRemindAt · computeExtend · isExpired ·                 ║
   ║ formatParkingCountdown · formatOverdue · nextLocalMidnight                      ║
   ╚═════════════════════════════════════════════════════════════════════════════════╝
                                                          │
              parkingSession{id,startedAt,durationMin,remindAt,notifId} ──► persist
                                                          │
                        ┌─────────────────────────────────┼───────────────────────────┐
                        ▼                                  ▼                            ▼
        scheduleParkingReminder(remindAt,id)      syncBubble(state):            (in-app chip
        (DATE trigger, id = sessionId)            resolveBubbleOwner            when foreground)
                        │                          parking>pomodoro>tasks
              OS fires notif @remindAt                     │
              [Extend | Open Pango | Done]     FloatingBubble.startParkingTimer(
                        │                        remindAt, fallbackCount, fallbackMessage)
        addNotificationResponseReceivedListener            │
        (_layout.tsx)  │                          native ticks countdown → "+Xm" overdue
        extend-15 → extendParkingSession(15) ─► computeExtend ─► reschedule + re-push
        open-pango → PangoWatcher.openPango()
        Done       → clearParkingSession() ─► cancel notif + syncBubble hands bubble back
```

## Component design

### NEW — `src/utils/parking.ts`  *(pure core; the [T] seam)*
Single responsibility: all parking time math, store- and native-free. Satisfies **AC2, AC3, AC4a, AC4b, AC5, AC5a, AC11**.
```ts
export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 24 * 60;          // 24h cap from startedAt
export type ExtendDelta = 5 | 15 | 30 | 60;

export function isValidDuration(min: number): boolean;                 // MIN ≤ m ≤ MAX, integer
export function computeRemindAt(startedAt: number, durationMin: number): number;   // startedAt + m*60000
export function computeExtend(
  s: ParkingSession, delta: ExtendDelta, now: number
): { ok: true; remindAt: number } | { ok: false; reason: 'exceeds-cap' };
  // remindAt = max(now, s.remindAt) + delta*60000; reject if > s.startedAt + MAX_DURATION_MIN*60000
export function isExpired(s: ParkingSession, now: number): boolean;    // now >= s.remindAt
export function formatParkingCountdown(msRemaining: number): string;  // "h:mm" if ≥1h else "mm:ss"
export function formatOverdue(msOverdue: number): string;             // "+7m" / "+1h07m"
export function nextLocalMidnight(now: number): number;              // epoch of next 00:00 local
```

### NEW — `src/types.ts` (EDIT: add interface)
```ts
export interface ParkingSession {
  id: string;
  startedAt: number;   // epoch ms
  durationMin: number; // original armed duration
  remindAt: number;    // absolute epoch ms; mutated on extend
  notifId?: string;    // = id (deterministic); the scheduled OS notification identifier
}
```
`overdue` is **derived** (`isExpired`), never stored. Satisfies **AC2**.

### EDIT — `src/store/appStore.ts`
New state beside pomodoro (`:104-108`): `parkingSession: ParkingSession | null`, `pangoReminderEnabled: boolean`, `pangoSuppressedUntil: number | null`. Factory defaults (`:178-192`): `null`, **`false`** (AC12), `null`.

Actions (model `setPomodoroTimer`/`clearPomodoroTimer` `:429-448`; stay **synchronous**, fire-and-forget scheduling with `.catch(()=>{})`; `notifId = id`):
```ts
startParkingSession: (durationMin: number) => ParkingSession | null;  // null if !isValidDuration (AC3)
extendParkingSession: (delta: ExtendDelta) => boolean;               // false if computeExtend !ok (AC5a)
clearParkingSession: () => void;                                     // cancel notif + syncBubble (AC7)
setPangoReminderEnabled: (enabled: boolean) => void;                 // (AC12)
setPangoSuppressedUntil: (until: number | null) => void;            // (AC10/AC11)
```
`extendParkingSession`: `computeExtend` → if ok, `cancelParkingReminder(id)` + `scheduleParkingReminder(new, id)` (same id) + update record + `syncBubble`. Satisfies **AC2, AC5, AC5a, AC7, AC10, AC11, AC12**.

**3-way bubble resolver** — replace `syncNotifications(tasks, showBubbleInBackground, pomodoroEndTime)` (`:56-68`) with:
```ts
function resolveBubbleOwner(s): 'parking' | 'pomodoro' | 'tasks' | 'none';   // parking > pomodoro > tasks
function syncBubble(s): void;   // acts on the winner; passes fallbackCount/fallbackMessage for hand-back
```
`parking` → `FloatingBubble.startParkingTimer(remindAt, fallbackCount, fallbackMessage)` where the fallback carries the *next* owner's content (pomodoro or task-count) so the bubble auto-hands-back on clear. Still honors `AppState.active` → hide overlay. Called from every parking action, pomodoro set/clear, task mutations, and the `_layout.tsx` bg handler. Satisfies **AC4a, AC7a**.

**Persist** (`partialize` `:512-537`): add `pangoReminderEnabled`, `parkingSession`, `pangoSuppressedUntil`. **No `_schemaVersion` bump.** `onRehydrateStorage` (`:633-654`): `parkingSession` non-null → `isExpired` ? leave overdue (no reschedule, no crash) : `scheduleParkingReminder(remindAt, id)`; then `syncBubble`. Satisfies **AC20**.
**Backup** (`exportData` `:464`): negative constraint — never add `parkingSession`/`pango*` to the returned payload/settings. Satisfies **AC16, AC17**.

### NEW — `src/modules/PangoWatcher.ts` (JS bridge, sibling of `FloatingBubble.ts`)
`Platform.OS === 'android'` + try/catch guards on every call:
```ts
startMonitoring(): void; stopMonitoring(): void;
hasUsageAccess(): Promise<boolean>;
requestUsageAccess(): void;               // deep-link to Usage-access settings
openPango(): Promise<boolean>;            // false if not installed (AC6)
onPangoBackgrounded(cb: () => void): () => void;   // NativeEventEmitter, clone onOpenFocus
```
Satisfies **AC1, AC6, AC14, AC15** (JS side).

### EDIT — `src/modules/FloatingBubble.ts` (add one method)
```ts
startParkingTimer(remindAtMs: number, fallbackCount: number, fallbackMessage: string): void;
```
Mirrors `startPomodoroTimer(endTimeMs, label, fallbackCount, fallbackMessage, soundType, volume)` (`:39`) minus sound/label. Satisfies **AC4a, AC4b, AC7a** (bridge).

### EDIT — `src/utils/notifications.ts`
Add `PANGO_CHANNEL = 'pango-3'` to `CHANNEL_DEFS` (`:41-44`, auto-created by `setupNotificationChannels`).
```ts
export async function scheduleParkingReminder(remindAt: number, sessionId: string): Promise<string>;
  // DATE trigger @remindAt (absolute, no drift), identifier=sessionId, data={type:'pango',sessionId},
  // categoryIdentifier:'parking-reminder', channelId: PANGO_CHANNEL
export async function cancelParkingReminder(notifId: string): Promise<void>;
export async function setupPangoNotificationCategory(): Promise<void>;
  // setNotificationCategoryAsync('parking-reminder',
  //   [{id:'extend-15',buttonTitle:'+15 min'},{id:'open-pango',buttonTitle:'Open Pango'}])
```
Model `schedulePomodoroEnd`/`cancelPomodoroNotification` (`:65-89`), DATE trigger like `scheduleTaskReminders` (`:151-154`). Satisfies **AC4, AC5, AC19**.

### NEW — `src/hooks/usePangoReminder.ts` (model `useShareIntent.ts`)
Subscribes `PangoWatcher.onPangoBackgrounded` **only when `pangoReminderEnabled`**; applies JS guardrails (suppress while `parkingSession !== null`; suppress while `now < pangoSuppressedUntil`); owns `start/stopMonitoring` (re-checks `hasUsageAccess()` before each `startMonitoring`, AC15). Exposes `{ promptVisible, arm(durationMin), dismiss(kind: 'not-parking' | 'today') }`. Consumed in `app/(tabs)/tasks.tsx` like `useShareIntent`. Satisfies **AC8(JS side), AC9, AC10, AC11, AC12, AC22(JS gating)**.

### NEW — `src/components/PangoArmModal.tsx`
Durations **30 / 60 / 120 + Custom** (default **60**); custom validated by `isValidDuration` → inline error (AC3). Actions **Not parking** / **Stop asking today**. Namespaced modal `key`s (memory: modal-key collisions). `accessibilityLabel`/`accessibilityRole`, ≥44dp, text+icon not color-only (AC25). Satisfies **AC1, AC3, AC10, AC11, AC25**.

### EDIT — `app/(tabs)/settings.tsx`
New `<CollapsibleSection title="Pango Reminder">`: enable `Switch` (model "Show Bubble" `:340-356`), **disclosure modal shown before first grant** (AC13), **Grant usage access** button + **revoked-state** row (model Google sign-in row `:533-545`). Satisfies **AC12, AC13, AC14, AC15**.

### EDIT — `app/_layout.tsx`
In the main effect (`:42`, teardown `:104`): call `setupPangoNotificationCategory()` beside `setupNotificationChannels()`; add **one** `Notifications.addNotificationResponseReceivedListener` → on `data.type==='pango'`: `extend-15`→`extendParkingSession(15)`, `open-pango`→`PangoWatcher.openPango()`; refactor the inline pomodoro bg gate (`:88-89`) to call `syncBubble`. Satisfies **AC5, AC6, AC7a**.

### NEW — Kotlin: `PangoWatcherModule.kt` + `PangoWatcherPackage.kt` (`modules/dragonflow-native/.../`)
Mirror `ShareIntentModule.kt`/`ShareIntentPackage.kt`. `getName()="PangoWatcher"`. `@ReactMethod`s: `startMonitoring()`/`stopMonitoring()` (fire `startPangoWatch`/`stopPangoWatch` intent at `FloatingBubbleService` via `startForegroundService`, shape of `startPomodoroTimer` `FloatingBubbleModule.kt:154-175`); `hasUsageAccess(promise)` (`AppOpsManager.checkOpNoThrow(OPSTR_GET_USAGE_STATS,…)==MODE_ALLOWED`); `requestUsageAccess()` (clone `requestOverlayPermission` `:82-93`, `ACTION_USAGE_ACCESS_SETTINGS`); `openPango(promise)` (`getLaunchIntentForPackage(PANGO_PACKAGE)`, null→`resolve(false)`). Companion `sendPangoBackgroundedEvent()` emits `"pangoBackgrounded"`; `@Volatile pendingPangoBackground` flushed on `addListener` (mirror `FloatingBubbleModule.kt:192-200`). Satisfies **AC1, AC6, AC14, AC15, AC16**.

### EDIT — Kotlin: `FloatingBubbleService.kt`
- New `onStartCommand` actions (`:105`): `startPangoWatch`→post `pangoPollRunnable` on existing `timerHandler` (~1500ms); `stopPangoWatch`→`removeCallbacks`.
- `pangoPollRunnable`: gate on `checkOpNoThrow(OPSTR_GET_USAGE_STATS)`; `usm.queryEvents(now-10_000, now)`; filter `PANGO_PACKAGE`; FG→store `pangoForegroundTs`; BG→ if `(bg-fg) ≥ DEBOUNCE_MS(20_000)` → `sendPangoBackgroundedEvent()` + **self-stop**. Raw events read + discarded, never logged (AC16).
- New action `startParking` (remindAtEpoch + fallbackCount/fallbackMessage, revert contract of `startPomodoro` `:107-119`): `parkingRunnable` computes remaining → `BubbleView.setParkingText(text, overdue)` (extend monospace timer path `:471-510`); 1Hz while `<1h`/overdue else 1/min. Any `start*`/count intent `removeCallbacks` the other mode's runnable (generalize the pomodoro reset). Bubble-tap adds extra `dragonflow_action="parking"` on the openApp/focus path (`:283-293`).
Satisfies **AC1, AC4a, AC4b, AC5, AC8, AC18, AC22**.

### EDIT — Kotlin: `BootReceiver.kt`
Before the task-score path (`:20-37`): `state.optJSONObject("parkingSession")`; if non-null read `remindAt` → start `FloatingBubbleService` `action=startParking, remindAtEpoch=remindAt, fallbackCount=<task score>` (parking wins). Satisfies **AC21**.

### EDIT — build scripts (AC24)
- `scripts/copy-native-files.js`: add `'PangoWatcherModule.kt'`, `'PangoWatcherPackage.kt'` to `kotlinFiles` (`:23-31`); add `import`+`add(PangoWatcherPackage())` after `add(ShareIntentPackage())` in **both** MainApplication blocks (`:128-153`).
- `scripts/patch-native-config.js`: same `add(PangoWatcherPackage())` (`:21-46`, lockstep); add `'android.permission.PACKAGE_USAGE_STATS'` to `permissionsToAdd` (`:57-62`) **+ `tools:ignore="ProtectedPermissions"` + ensure `tools:` namespace on `<manifest>`**; **no new `<service>`**; **NEW `<queries>` block**: `<queries><package android:name="com.unicell.pangoandroid"/></queries>` (mandatory for AC6). Idempotent `includes()` guards like existing patches.

## Acceptance-criteria → design traceability

| AC | Satisfied by |
|----|--------------|
| AC1 arm prompt | `FloatingBubbleService` poll → `PangoWatcher.onPangoBackgrounded` → `usePangoReminder` → `PangoArmModal` |
| AC2 arm→session | `startParkingSession` + `computeRemindAt` + deterministic `notifId=id` |
| AC3 custom bounds | `isValidDuration` (pure) → modal inline error / action returns null |
| AC4 nudge | `scheduleParkingReminder` (DATE) + `setupPangoNotificationCategory` (Extend/Open Pango) |
| AC4a countdown | `FloatingBubble.startParkingTimer` → `parkingRunnable` + `formatParkingCountdown` |
| AC4b overdue | `parkingRunnable` `remaining<0` → `formatOverdue` + `COLOR_ALERT_BORDER`+text |
| AC5 extend | `extendParkingSession` + `computeExtend` + reschedule + re-push; notif/bubble/in-app entry points |
| AC5a extend cap | `computeExtend` → `{ok:false,'exceeds-cap'}` → action returns false |
| AC6 open Pango | `PangoWatcher.openPango` (`getLaunchIntentForPackage`) + `<queries>` entry |
| AC7 done/clear | `clearParkingSession` → cancel notif + `syncBubble` hand-back |
| AC7a precedence | `resolveBubbleOwner` (parking>pomodoro>tasks) + `syncBubble` fallback |
| AC8 debounce | native `DEBOUNCE_MS` gate in `pangoPollRunnable` |
| AC9 suppress-while-active | `usePangoReminder` (ignore if session≠null) + native self-stop |
| AC10 not-parking cooldown | `setPangoSuppressedUntil(now+30m)` |
| AC11 stop-asking-today | `setPangoSuppressedUntil(nextLocalMidnight(now))` |
| AC12 default off | `pangoReminderEnabled` default false; hook never subscribes when off |
| AC13 disclosure | Settings disclosure modal before grant |
| AC14 grant deep-link | `PangoWatcher.requestUsageAccess` from Settings button |
| AC15 revoked surfaced | `hasUsageAccess()` re-check + Settings revoked-state row |
| AC16 no usage logging | native reads+discards `queryEvents`; nothing logged/persisted beyond derived session |
| AC17 excluded from backup | `exportData` negative constraint + regression test |
| AC18 not exported | reuse `FloatingBubbleService` (already `exported=false`); no new service |
| AC19 intent safety + bounds | fixed-package `openPango`; `computeExtend`/`isValidDuration` bounds |
| AC20 persist/rehydrate | `partialize` + `onRehydrateStorage` re-arm/expiry |
| AC21 reboot restore | `BootReceiver` reads `parkingSession` → `startParking` |
| AC22 poll only when armed | native idle→confirm→stop; JS gates `startMonitoring` |
| AC23 android-only | all new code Android-guarded; no iOS paths |
| AC24 build resilience | `copy-native-files.js` + `patch-native-config.js` idempotent edits |
| AC25 a11y | modal/bubble labels, ≥44dp, text+icon not color-only |

*No gaps — every AC1–AC25 has a concrete owner. No story criteria were found under-specified during design (durations, extend semantics, and precedence were already pinned in the story).*

## Test plan

**Unit (automated — Jest):**
| File (NEW) | Cases | AC |
|---|---|---|
| `src/utils/__tests__/parking.test.ts` | bounds (4/5/1440/1441), `computeRemindAt`, `computeExtend` early vs expired vs cap-reject, `isExpired`, `formatParkingCountdown` (59m→`mm:ss`, 1h→`1:00`), `formatOverdue`, `nextLocalMidnight` (incl. DST-agnostic) — **no mocks** | AC2,3,4a,4b,5,5a,11 |
| `src/store/__tests__/parking.test.ts` | start/extend/clear; default OFF; suppression epochs; notifId=id; sync scheduling mocked | AC2,7,10,11,12 |
| `src/store/__tests__/bubbleResolver.test.ts` | precedence table over {parking?,pomodoro?,tasks?} combos incl. hand-back | AC7a |
| `src/utils/__tests__/notifications.parking.test.ts` | DATE trigger + identifier reuse on extend | AC4,5 |
| `src/utils/__tests__/dataTransfer.test.ts` (extend) | `exportData` lacks `parkingSession` + settings lacks `pango*` | AC16,17 |
| store rehydrate case | un-expired re-arms; expired no-crash | AC20 |

Mocks: `../../utils/notifications`, `../../modules/FloatingBubble`, `../../modules/PangoWatcher`, AsyncStorage (model `focusMode.test.ts` header).

**Manual QA (device — needs full native rebuild):** AC1 detect→prompt, AC4/4a/4b bubble countdown+overdue on-device, AC6 open Pango (installed + uninstalled), AC8 <20s glance no-prompt, AC13/14/15 permission flow + revoke, AC18 manifest `exported=false`, AC21 reboot mid-session, AC22 battery/poll behavior, AC23 iOS unaffected, AC24 `npm run prebuild:clean` re-applies + re-run no-op, AC25 TalkBack.

## Design decisions & alternatives

- **Native is dumb; JS owns precedence + `remindAt`.** Rejected: native deciding the bubble owner (would duplicate task/pomodoro logic in Kotlin; brittle). The `fallbackCount`/`fallbackMessage` params already prove the pattern for pomodoro.
- **Pure `parking.ts` core.** All math is store/native-free → the bulk of ACs are unit-tested without a device (mirrors the ShareIntent `shareText.ts` approach).
- **Reuse `FloatingBubbleService` for polling.** Rejected a second foreground service — more manifest surface, another exported component to secure, duplicate lifecycle.
- **DATE trigger, not TIME_INTERVAL.** Survives process death/drift; absolute `remindAt` is the single clock.
- **Deterministic `notifId = sessionId`.** Lets store actions stay synchronous (no async id round-trip) while satisfying AC2/AC5 reschedule.
- **Extend lives in-app, not a 4-way notification submenu.** Notification stays a simple `+15 / Open Pango / Done`; the 5/15/30/60 chooser is the in-app sheet (cleaner, and the bubble tap already routes into the app).
- **No `_schemaVersion` bump** — avoids a migration for purely additive optional state.

## Handoff to Implement — build order

1. **`src/utils/parking.ts`** (pure) + **`src/utils/__tests__/parking.test.ts`** — TDD the core first.
2. **`src/types.ts`** `ParkingSession`.
3. **`src/utils/notifications.ts`** helpers + channel/category + **`notifications.parking.test.ts`**.
4. **`src/store/appStore.ts`** state/actions/resolver/persist + **`store/__tests__/parking.test.ts`** + **`bubbleResolver.test.ts`**; extend **`dataTransfer.test.ts`**.
5. **`src/modules/PangoWatcher.ts`** + **`FloatingBubble.ts`** `startParkingTimer`.
6. **`src/hooks/usePangoReminder.ts`** + **`src/components/PangoArmModal.tsx`**; wire in `tasks.tsx`.
7. **`app/(tabs)/settings.tsx`** section + disclosure; **`app/_layout.tsx`** category setup + response listener + `syncBubble` refactor.
8. **Kotlin**: `PangoWatcherModule.kt`, `PangoWatcherPackage.kt`; edit `FloatingBubbleService.kt`, `BootReceiver.kt`.
9. **Build scripts**: `copy-native-files.js` + `patch-native-config.js`; then `npm run prebuild:clean` and a full Android rebuild for device QA.

**New dependency: none.** JS-only steps (1–4) verify via `npm run check` (hot). Steps 8–9 require a full native rebuild.

➡️ **Next:** `sdlc-implement`.

## Amendment (2026-08-26) — default-on + first-launch disclosure

Implements story.md's Amendment (AC12/AC13/AC13a). Mechanism, no new native surface:

- **`appStore.ts`**: `parkingReminderEnabled` factory default flips `false → true`. New persisted boolean `parkingDisclosureSeen` (default `false`) with setter `setParkingDisclosureSeen`, added to `partialize` alongside the other parking fields.
- **Disclosure UI extracted.** The inline `Modal` previously local to `app/(tabs)/settings.tsx` moved verbatim (copy, styling, `useColors` theming) into `src/components/ParkingDisclosureModal.tsx` (`{visible, onCancel, onContinue}` props) so it can be mounted from two places without duplicating the P0 privacy copy. Settings keeps its own `parkingDisclosureVisible` local state and `confirmParkingDisclosure` handler (AC13, manual-toggle path) — only the JSX moved.
- **First-launch trigger lives in `app/_layout.tsx`** (the always-mounted root), not Settings, since the app can open on any tab. A dedicated `useEffect` waits for `hasHydrated` (same subscribe-until-hydrated pattern already used there for the `extend-15` notification-action race), then shows the modal once if `parkingReminderEnabled && !parkingDisclosureSeen`. Continue and Cancel both set `parkingDisclosureSeen = true` (never re-prompt); Continue additionally calls `ParkingWatcher.hasUsageAccess()` → `requestUsageAccess()` if not granted, identical to Settings' `confirmParkingDisclosure`.
- **No native change.** `useParkingReminder.ts` already gates `startMonitoring()` on `ParkingWatcher.hasUsageAccess()`, so a default-enabled flag with no grant yet is a safe no-op — monitoring simply won't start until the user grants access (immediately via the new first-launch flow, or later via Settings' existing "Grant usage access" banner, AC15).
- **Hydration-gate fix (found in review).** `useParkingReminder.ts`'s monitoring effect now also reads `hasHydrated` and includes it in its stop/start condition. Without this, the zustand `persist` middleware's synchronous factory default (`parkingReminderEnabled: true`, pre-rehydrate) reached the effect on every cold start before the real persisted value replaced it a beat later — for an upgrading user who'd previously granted Usage access and then explicitly toggled the feature OFF, that transient `true` briefly re-armed native monitoring each launch. Gating on `hasHydrated` closes the window entirely.
- **Existing users unaffected.** The store default only applies to the zustand `persist` middleware's pre-rehydrate initial state; anyone with `dragonflow-tasks` already in `AsyncStorage` rehydrates their own persisted `parkingReminderEnabled`/`parkingDisclosureSeen` values, so upgraders keep whatever they'd already set (including a prior explicit OFF) and never see an unexpected auto-prompt.
- **Tests**: `store/__tests__/parking.test.ts` — default-true assertion re-derived via `jest.isolateModules` (a fresh store instance, since the suite's `beforeEach` deliberately forces `parkingReminderEnabled: false` for test isolation elsewhere) + a `setParkingDisclosureSeen` toggle test. No test targets `app/_layout.tsx` directly (matches the file's existing untested-integration-shell convention); covered by manual QA below.
- **Manual QA (new)**: fresh install shows the disclosure once, unprompted, before any other interaction; Cancel leaves the toggle ON in Settings but Usage access ungranted (banner shows); Continue deep-links to Usage-access settings and returns granted; second cold launch does not re-show the disclosure; an upgrade from a build predating this change (toggle previously OFF) does not auto-enable or auto-prompt.
