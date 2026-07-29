# Brainstorm — Pango Reminder

> SDLC Stage 2 (Brainstorm). Slug: `pango-reminder`. Reuses the **"Parking app awareness"** backlog row (features.md). Feeds `sdlc-analyze`.

## The idea in one line

Remind me to **close/stop my Pango parking session** when I'm done, so I stop being charged for parking I'm no longer using.

Pango (פנגו) is the Israeli parking-payment app on the user's Android phone. You open a session when you park and are supposed to stop it when you leave — forgetting means real money wasted. DragonFlow has **no API relationship** with Pango.

## Value & prioritization

- **Who it's for** — the user + family (personal app). Job-to-be-done: *don't overpay for parking because I forgot to close the session.*
- **Impact** — **Medium-High.** Recurring, real-money pain with a clear moment of failure. Not a daily event, but each miss costs money and mild stress.
- **Effort** — depends heavily on mechanism: **S–M** (manual/hybrid) to **L** (background location). First instinct: prefer the cheapest mechanism that captures most of the value.
- **Roadmap fit** — directly realizes the "Parking app awareness" idea. Reuses existing notification channels, the floating-bubble overlay, the native-module + `copy-native-files.js`/`patch-native-config.js` resilience pattern, and (in the hybrid) the Task/Done lifecycle + recurrence. No overlap/conflict with other planned work; adjacent to the Share-to-task target pattern.
- **Kill criteria** — kill/deprioritize if: (a) the only mechanisms the user will accept are auto-detect ones AND none prove feasible on-device (e.g. Pango posts no persistent notification *and* location is rejected); or (b) effort balloons to L for marginal value over the S–M hybrid. Neither is met today — the hybrid (C) is always a viable floor, so the feature survives.

## Divergent approaches

### Dimension A — Detection / trigger mechanism (the core decision)

| id | Option | How | Effort | Verdict |
|----|--------|-----|--------|---------|
| **A1** | **Notification-listener (true auto-detect)** | New `NotificationListenerService` (Kotlin) reads Pango's ongoing notification: posted → session active, removed → likely ended. Bridge events to JS like `FloatingBubble.ts`. | M | Best auto-detect value *if* the core assumption holds. Two make-or-break unknowns. |
| **A2** | **Geofence + activity recognition** | One-tap "I'm parking" captures GPS anchor; background geofence exit→re-entry and/or `in_vehicle→on_foot→in_vehicle` transitions fire the reminder; time-based backstop. | L | Heaviest permission surface (background location); fails in garages; still needs a manual start. Weakest ROI. |
| **A3** | **Low-friction hybrid ("session as a one-tap task")** | One tap (App Shortcut / bubble action) arms a parking session = a specialized Task with `dueTime = arm + Xh`; reuse `scheduleTaskReminders()` + floating bubble to nudge; mark Done to clear. | S–M | Cheapest, most reliable, all-reuse. Recovers "forgot to close" fully but **zero** of "forgot to arm". |
| **A4** | **Staged: A3 now → A1 as auto-detect follow-on** | Ship A3 first (reliable close-reminder + manual arm). Cheaply verify on-device whether Pango posts a persistent notification; if yes, layer A1 to auto-arm (kills the "forgot to arm" gap) reusing A3's session model + nudge surface. | S–M then +M | Wildcard; superseded by A5. |
| **A5** | **✅ CHOSEN — App-usage detection + confirm-to-arm** | Detect that **Pango was used** (foregrounded), and when it **goes to the background**, DragonFlow prompts *"Start a parking reminder? For how long?"*. User confirms it's parking (vs public-transport) and picks a duration → arms a lightweight session (B2). Nudge via bubble + notification; mark done / open Pango to clear. | M | **Converged pick.** Sidesteps the multi-purpose ambiguity (user confirms parking) AND the persistent-notification unknown (we detect app usage, not read Pango's notification content). |

**The central tension (resolved by A5):** user leaned *auto-detect* (A1/A2); A3 argued most value is in the cheap "forgot to close" case. **A5 threads the needle** — it auto-*notices* Pango usage (the auto-detect the user wanted) but keeps a human confirmation because **Pango is multi-purpose (parking + public transport)**, so not every session is parking. The confirmation both disambiguates the trip type and captures the duration. This also dodges A1's make-or-break "does Pango post a persistent notification" unknown, since A5 keys off app foreground/background, not notification content.

### Dimension B — Parking-session data model

- **B1 — Specialized Task** (category `Parking`, `dueTime = arm + Xh`). DRY: inherits reminders, bubble urgency, recurrence, Done lifecycle. Cost: clutters the task list and **bleeds into stats/progress** dashboards unless filtered/hidden.
- **B2 — Lightweight parallel record** (a small `parkingSession` slice in `appStore.ts`: `active`, `startedAt`, `remindAt`). Clean separation from tasks/stats; costs a bit of bespoke reminder wiring instead of reusing the task scheduler wholesale.
- *(Deferred sizing to Analyze — the stats-bleed question decides it.)*

### Dimension C — Nudge surface (low stakes)

- **C1 — Reuse floating bubble + a reminders notification** with **Snooze** and **Stop/Open Pango** actions ("Stop" deep-links to open Pango — we can't close the session for the user). Recommended; all reuse. A dedicated parking notification channel is a nice-to-have (distinct sound), deferred.

## Cross-cutting concerns

- **We can never *close* Pango for the user** — any "Stop" action can at best deep-link/open Pango. The feature is a *reminder*, not an integration. Set expectations accordingly.
- **Build-pipeline resilience** — any manifest/`shortcuts.xml`/`<service>`/Kotlin additions must go through `patch-native-config.js` + `copy-native-files.js` (kotlinFiles whitelist, MainApplication.kt registration), never into generated `android/`. Both A1 and A3 fit the existing idempotent-regex pattern.
- **Platform** — Android-only (Pango is Israel/Android context; floating bubble is Android). No iOS work.
- **A1 unknowns (make-or-break)** — (1) does Pango post a *persistent* notification while active? (2) exact package id (`com.pango`/`il.co.pango`? — treat as config, verify on-device). If (1) is false, A1 collapses.
- **A1/A2 permission optics** — Notification-access ("sees all notifications") and background-location are both scary, off-by-default toggles; OEM battery optimization kills listeners (need `BootReceiver` rebind — already exists). Privacy: filter Pango-only in native, never log/store other apps' notifications.
- **Cold/boot state** — a parking session armed before a reboot must survive (persist in store; bubble restore via existing BootReceiver).

## Recommendation

- **Dimension A → A5** (app-usage detection + confirm-to-arm), per the user's shaping. Drop A1/A2/A4.
- **Dimension B → B2** (lightweight `parkingSession` record), per the user.
- **Dimension C → C1** — reuse bubble + reminders notification; dedicated channel deferred.

## ✅ Converged decisions

_(2026-07-29)_

| Dimension | Decision | Notes |
|-----------|----------|-------|
| A — mechanism | **A5 — App-usage detection + confirm-to-arm** | Notice Pango was used; on Pango→background, prompt "Start a parking reminder? For how long?"; user confirms (parking vs transit) + duration → arm. Auto-*notices* but keeps a human confirm because Pango is multi-purpose. |
| B — data model | **B2 — Lightweight `parkingSession` record** | Small slice in `appStore.ts` (`active`, `startedAt`, `remindAt`, maybe `label`). Keeps parking out of the task list & stats/progress. |
| C — nudge surface | **C1 — Floating bubble + reminders notification** | Reuse existing bubble + `REMINDERS_CHANNEL`; actions Snooze / Stop→open Pango. Dedicated parking channel deferred. |

## Summary & Handoff to Analyze

**What we're building.** An Android reminder that **notices when the Pango app has been used** and, when Pango moves to the background, **prompts the user to arm a "stop parking" reminder for a chosen duration**. Because Pango is multi-purpose (parking *and* public-transport payment), the prompt requires a human confirmation so we only nag for actual parking. The session is a lightweight store record (not a Task); nudges reuse the floating bubble + reminders notification. We can never *close* Pango — "Stop" deep-links to open it.

**Decisions taken.**
- **A5** mechanism: detect Pango usage → on background, prompt to arm (confirm parking + duration).
- **B2** data model: lightweight `parkingSession` record in `appStore.ts`, kept out of tasks/stats.
- **C1** nudge: reuse floating bubble + `REMINDERS_CHANNEL` notification (Snooze / open-Pango actions).
- Android-only. Reminder-not-integration (no ability to close Pango for the user).

**Deferred to Analyze (Stage 3 must resolve with evidence).**
1. **Core mechanism feasibility — the make-or-break.** How to reliably detect another app's foreground→background transition on Android. `UsageStatsManager` (`PACKAGE_USAGE_STATS` "Usage access") gives *polled* history, not a real-time background callback — so does A5 need a foreground service polling usage stats, an `AccessibilityService`, or can the notification-listener signal (Pango notification posted/removed) stand in as the "Pango was used" trigger? Resolve the actual mechanism with evidence.
2. **Pango package id(s)** — verify on-device (`com.pango` / `il.co.pango`?); treat as config, not a code literal. Consider supporting multiple transport apps later.
3. **Permission optics & battery** — `PACKAGE_USAGE_STATS` is a scary special-access toggle; a polling foreground service has battery cost. Off by default + one-time explainer.
4. **Prompt-fatigue guardrail** — every Pango background would trigger a prompt; need easy dismiss / "not parking" / disable, and debounce so quick app-switches don't spam.
5. **B2 reminder wiring** — schedule/cancel reminders for a non-Task record: reuse `scheduleTaskReminders()` shape or a small dedicated helper in `notifications.ts`.
6. **Cold/boot survival** — armed session persists across reboot (store persist + BootReceiver bubble restore).

**Value verdict.** Impact **Medium-High** (recurring real-money pain), Effort **M**, Priority **worth advancing** — realizes the "Parking app awareness" backlog idea with mostly-reused infrastructure.

➡️ **Next stage:** `sdlc-analyze` (resolve deferred item #1 first — it gates the whole design).
