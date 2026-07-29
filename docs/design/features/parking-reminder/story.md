# Story — Pango Reminder

> SDLC Stage 4 (Story). Slug: `parking-reminder`. Input: [analysis.md](analysis.md). The testable contract for Design + Verify. Android-only.

## User story

**As a** driver who pays for street parking with the Pango app, **I want** DragonFlow to notice when I've used Pango and offer to remind me to stop the session after a duration I choose, **so that** I don't forget to close it and keep getting charged for parking I've left.

## Job-stories

1. **When I** park and start a Pango session then background the app, **I want** a quick "remind me to stop in 1h?" prompt, **so I can** arm a reminder in one tap without opening DragonFlow.
2. **When I** used Pango for a *bus/train* fare (not parking), **I want** to dismiss the prompt easily and not be nagged, **so I** don't get trained to ignore it.
3. **When** my chosen time is nearly up, **I want** a clear notification (and the floating bubble) with a one-tap way to open Pango, **so I can** go stop the session immediately.
4. **When** I've stopped parking, **I want** to mark it done so the reminder and bubble clear, **so** nothing lingers.
5. **When** my phone reboots mid-parking, **I want** the reminder to survive, **so I'm** still nudged.

## Scope

**In scope (v1)**
- Detect Pango moved to background (UsageStatsManager polled in the existing FloatingBubbleService) and, subject to guardrails, show an **arm prompt**.
- Arm prompt: durations **30m / 1h / 2h + custom**, default **1h**; actions **Not parking** and **Stop asking today**.
- Lightweight `parkingSession` store record (B2) — **not** a Task; excluded from stats/progress and from Drive backup.
- Reminder at `startedAt + durationMin` via OS notification + floating-bubble chip; nudge actions **Extend** and **Open Pango**; **mark done** clears everything.
- **Live countdown on the floating bubble** to the parking-end time while a session is active, switching to an **overdue** state once the end passes.
- **Shared bubble with a defined precedence.** The single floating bubble now has **three** possible owners — urgent **task-count**, **pomodoro**, and **parking-timer**. Precedence: **parking-timer > pomodoro > task-count** (a missed parking reminder has real monetary cost and happens while the user is away from the app; the suppressed owner keeps its own in-app surface and reclaims the bubble when parking clears).
- **Extend** the parking end by **5 / 15 / 30 / 60 min**, available in *both* states — proactively while the timer is still running, and after it's expired (still parking) — from the bubble, the nudge notification, or in-app. Extend supersedes the earlier standalone "Snooze 15m".
- Prompt-fatigue guardrails: <20s debounce, dismissal cooldown, suppress-while-active, global enable toggle (**default OFF**).
- **Usage-access permission-request UX** + honest prominent-disclosure copy (folded in).
- **BootReceiver** extension to restore an active session's bubble/notification after reboot (folded in).
- Settings section: enable toggle + grant/permission-state affordance.

**Out of scope (v1)**
- **Multiple watched apps** — v1 is Pango-only, but the package id is stored as **config, not hardcoded** so adding apps later is a small change. Tracked as Follow-up below.
- Any ability to **close/stop the Pango session for the user** — impossible without a Pango integration; "Open Pango" only deep-links.
- iOS (Pango context + floating bubble are Android).
- Reading Pango notification **content** (zone/plate) — not needed with the usage-based approach.
- Auto-guessing duration from Pango's own end-time — Follow-up.

## Related & spawned stories

| Story | Relationship | Why | Tracked | Independent? |
|-------|--------------|-----|---------|--------------|
| Usage-access permission-request UX + disclosure | **In-scope sub-task** (was spawned) | Feature cannot function without the `PACKAGE_USAGE_STATS` grant; the honest-disclosure screen is a P0 privacy obligation. | This story | N/A — built here. |
| BootReceiver session-restore | **In-scope sub-task** (was spawned) | Reboot mid-parking must not silently drop the reminder (P1 reliability). Small native tweak. | This story | N/A — built here. |
| Multiple transport/parking apps | **Follow-up** | Config already supports a package list; UI + testing deferred until Pango is proven. | features.md backlog | Yes — v1 ships Pango-only. |
| Duration from Pango's shown end-time | **Follow-up** | Could pre-fill duration, but needs reading Pango content (privacy cost). | features.md backlog | Yes. |

No **Blocks**-type dependency — the feature proceeds and ships on its own.

## Acceptance criteria

> Numbered for Design/Verify traceability. **[T]** = automatable test, **[M]** = manual QA (device/native).

### A. Core flow
- **AC1** *(Arm prompt)* **[M]** **Given** the feature is enabled and Usage access is granted, **when** Pango is used and then moved to the background (for ≥ the debounce window), **then** within ~5s DragonFlow shows an arm prompt with duration options **30m / 1h / 2h / Custom** (default **1h** pre-selected) and actions **Not parking** / **Stop asking today**.
- **AC2** *(Arm)* **[T]** **Given** the arm prompt, **when** the user confirms a duration D, **then** a `parkingSession` record is created with `startedAt = now`, `durationMin = D`, `remindAt = startedAt + D*60000` (absolute epoch), a unique id, and the scheduled reminder's notification id stored on the record.
- **AC3** *(Custom duration)* **[T]** **when** the user picks Custom and enters a value, **then** the value is accepted only within bounds **5 min ≤ D ≤ 24h**; out-of-bounds input is rejected with an inline message and no session is created.
- **AC4** *(Nudge)* **[M]** **when** `remindAt` is reached, **then** a notification fires on the reminders channel titled "Stop your Pango parking" with actions **Extend** and **Open Pango**, and the floating bubble switches to the overdue state (AC4b).
- **AC4a** *(Live countdown on bubble)* **[M]** **Given** an active session, **then** the floating bubble displays a live countdown to `remindAt` (format `h:mm` when ≥1h remaining, else `mm:ss`), updating at least once per minute; the countdown persists while DragonFlow is backgrounded (bubble overlay).
- **AC4b** *(Overdue state)* **[M]** **when** `remindAt` passes without the session being closed, **then** the bubble shows an overdue indicator (elapsed-since-end, e.g. `+7m`, with a distinct attention color **paired with text/icon**, not color alone) and remains until the user Extends or marks done.
- **AC5** *(Extend — supersedes Snooze)* **[T]** **Given** an active session (reminder fired *or not*), **when** the user extends by `delta ∈ {5, 15, 30, 60}` min from the bubble, the nudge notification, or in-app, **then** `remindAt = max(now, remindAt) + delta*60000` (so extending early adds to the existing end; extending after expiry adds to *now*), the OS reminder is rescheduled to the new `remindAt`, the stored notification id is updated, the session stays active, and the bubble countdown reflects the new end.
- **AC5a** *(Extend bounds)* **[T]** **then** an extend is rejected (no-op with feedback) if it would push `remindAt` beyond **24h from `startedAt`**, so the reminder can't be pushed indefinitely.
- **AC6** *(Open Pango)* **[M]** **when** the user taps **Open Pango**, **then** DragonFlow launches Pango via a fixed-package `getLaunchIntentForPackage("com.unicell.pangoandroid")`; **and** if Pango is not installed, a graceful message is shown and DragonFlow does not crash.
- **AC7** *(Done / clear)* **[T]** **when** the user marks the parking session done (bubble/notification action or in-app), **then** the scheduled reminder is cancelled, the `parkingSession` is set to null, and the bubble parking-state (countdown/overdue) is cleared.
- **AC7a** *(Bubble precedence — 3 owners)* **[T/M]** The floating bubble resolves its content by fixed precedence **parking-timer > pomodoro > task-count**: **given** an active parking session, the bubble shows the parking countdown/overdue even if a pomodoro is running and/or urgent tasks exist; **when** the parking session is cleared, the bubble immediately reverts to pomodoro (if running) else the urgent-task count. The suppressed owner is never lost — pomodoro retains its in-app mini-bar; task-count returns automatically.

### B. Prompt-fatigue guardrails (P0)
- **AC8** *(Debounce)* **[T]** **Given** Pango was foregrounded for **< 20s** before backgrounding, **then** no arm prompt is shown (treated as a glance/mis-tap).
- **AC9** *(Suppress while active)* **[T]** **Given** a `parkingSession` is already active, **when** Pango is backgrounded again, **then** no new arm prompt is shown.
- **AC10** *(Not parking → cooldown)* **[T]** **when** the user taps **Not parking**, **then** no session is created and arm prompts are suppressed for **~30 min** from that dismissal.
- **AC11** *(Stop asking today)* **[T]** **when** the user taps **Stop asking today**, **then** arm prompts are suppressed until **local midnight**, after which the feature resumes automatically (the global enable stays ON).
- **AC12** *(Global toggle default off)* **[T]** **Given** a fresh install / user who never opted in, **then** `pangoReminderEnabled` defaults **false** and no monitoring/polling occurs until the user enables it.

### C. Permission & disclosure (P0)
- **AC13** *(Disclosure before grant)* **[M]** **when** the user enables the feature, **then** a prominent-disclosure screen is shown first stating in plain language: DragonFlow only detects **that** Pango ran (not content), the data **never leaves the device**, and why Usage access is needed — with an explicit continue/cancel.
- **AC14** *(Grant deep-link)* **[M]** **when** the user proceeds, **then** DragonFlow deep-links to **Settings → Usage access** (`ACTION_USAGE_ACCESS_SETTINGS`); on return, the granted state is reflected in Settings.
- **AC15** *(Revoked surfaced)* **[M]** **Given** the feature is enabled but Usage access is later revoked, **then** Settings shows a clear "permission needed" state (not a silent no-op), and no prompts fire until re-granted.

### D. Privacy & security (P0/P1)
- **AC16** *(No usage logging)* **[T/M]** No app-usage data (package names, foreground/background timestamps, raw `queryEvents` results) is ever written to logs (`console.log`) or persisted beyond the derived session; the raw query result is read and discarded.
- **AC17** *(Excluded from backup)* **[T]** `exportData()` output (the Google Drive backup + JSON export payload) contains **no** `parkingSession` / parking data; a test asserts the key is absent.
- **AC18** *(Service not exported)* **[M]** Any new/extended Android service is declared `android:exported="false"`.
- **AC19** *(Intent safety)* **[T/M]** "Open Pango" uses a fixed package launch intent only — never an implicit/user-supplied intent; `durationMin` is validated before scheduling (see AC3).

### E. Reliability (P1)
- **AC20** *(Persist across process death)* **[T]** An active `parkingSession` is persisted (store `partialize`) and, on rehydrate, an un-expired session re-arms its reminder while an already-expired one is handled gracefully (fires immediately / cleaned up, no crash).
- **AC21** *(Reboot restore)* **[M]** **Given** an active session, **when** the device reboots, **then** BootReceiver restores the bubble/notification and the reminder still fires at the original `remindAt`.
- **AC22** *(Battery — poll only when armed)* **[M]** UsageStats polling runs only while monitoring is enabled and follows idle→confirm→stop (no 24/7 loop); polling stops once a session is armed or the prompt is declined.

### F. Platform & build resilience
- **AC23** *(Android-only, no iOS regression)* **[M]** Feature is Android-only; no iOS code paths are added and iOS build is unaffected.
- **AC24** *(Build resilience)* **[T/M]** All native additions (new `.kt`, `PACKAGE_USAGE_STATS`, service/package registration) are applied via `scripts/copy-native-files.js` + `scripts/patch-native-config.js` (idempotent), **never** edited into generated `android/`; a clean `npm run prebuild:clean` re-applies them, and re-running the scripts is a no-op.

### G. Accessibility (P2)
- **AC25** *(a11y)* **[M]** Arm prompt and nudge controls have `accessibilityLabel`/`accessibilityRole`, touch targets ≥44dp, and never convey state by color alone (pair with text/icon, matching the bubble's count+label pattern).

## Definition of Done

- [ ] All acceptance criteria satisfied — automated (**AC2, AC3, AC5, AC5a, AC7, AC8, AC9, AC10, AC11, AC12, AC16, AC17, AC20, AC24**) green in Jest; manual (device/native, incl. **AC4a/AC4b** bubble countdown/overdue) walked through and recorded in `verification.md`.
- [ ] Both in-scope sub-tasks (Usage-access permission UX, BootReceiver restore) delivered.
- [ ] No new JS dependency added; native done via the copy/patch scripts (no generated-file edits).
- [ ] `parkingSession` confirmed absent from `exportData()` (AC17 test).
- [ ] `npm run check` (typecheck + lint + tests) green.
- [ ] No **Blocks** dependency outstanding (there are none).

**Pre-implementation checklist (not a code AC):**
- [x] **R1 — Pango package id CONFIRMED** on the user's device: **`com.unicell.pangoandroid`** (App info shows version 13.1608). Set as the config constant `PANGO_PACKAGE = 'com.unicell.pangoandroid'` (single source, not scattered literals).

## Handoff to Design

Design must specify:
1. **Detection surface** — the `PangoWatcherModule`/bridge API (`onPangoBackgrounded`, `requestUsageAccess`, `hasUsageAccess`, `startMonitoring`/`stopMonitoring`) and how the UsageStats poll loop lives inside `FloatingBubbleService` as an idle→confirm→stop state machine (satisfies AC1, AC8, AC22); the package id as a config constant (R1).
2. **`parkingSession` model + store actions** — exact fields, `startParkingSession`/`clearParkingSession`/snooze, persist `partialize` inclusion + `onRehydrateStorage` re-arm/expiry logic (AC2, AC5, AC7, AC20), and the `exportData()` exclusion (AC17).
3. **Reminder scheduling + extend** — `scheduleParkingReminder`/`cancelParkingReminder`/`extendParkingSession(delta)` (absolute epoch, reminders channel, notification actions) modeled on the pomodoro helpers; the `remindAt = max(now, remindAt) + delta` rule and the 24h-from-start cap (AC4, AC5, AC5a, AC19).
   - **Bubble countdown/overdue rendering** — how `FloatingBubbleService` renders and ticks a live countdown to `remindAt` and flips to the overdue state, and where the extend presets (5/15/30/60) surface on the bubble + notification + in-app (AC4a, AC4b). Native tick/update strategy and battery note.
4. **Guardrail state** — where debounce/cooldown/"stop asking today"/suppress-while-active live and how midnight reset is computed (AC8–AC11).
5. **Bubble ownership priority (decided)** — implement the fixed precedence **parking-timer > pomodoro > task-count** (AC7a). Specify *where* the decision is centralized (extend the existing `syncNotifications` guard at `appStore.ts:56-68` / `_layout.tsx:88-89` pomodoro gate to a 3-way resolver), and the automatic hand-back when parking clears (AC4, AC4a, AC7).
6. **Permission & disclosure flow** — the disclosure screen, deep-link, and revoked-state surfacing in Settings (AC13–AC15).
7. **BootReceiver restore** — how it detects an active session and restores bubble/notification (AC21).
8. **Native build wiring** — exact edits to `copy-native-files.js` + `patch-native-config.js` (AC24).
9. **Test plan** — mapping each **[T]** criterion to a unit test.

➡️ **Next:** `sdlc-design`.
