# Story — expo-share-intent migration (Android-only)

## User story
**As** the maintainer of DragonFlow,
**I want** the Android share-to-task target rebuilt on the maintained `expo-share-intent` library instead of the custom `ShareIntentModule.kt` + JS bridge,
**so that** ~194 lines of custom native + brittle manifest-regex are removed, upkeep drops, and an iOS share target becomes a cheap follow-up — with the user-facing share-to-task flow essentially unchanged.

Internal migration. One **accepted** behavior change: subject→title becomes best-effort (see AC5).

## Scope
**In scope**
- Replace the native delivery layer with `expo-share-intent@~8` (SDK 57): add the dep + Android config plugin (`androidIntentFilters: ["text/*"]`, `disableIOS: true`).
- Rewrite `src/hooks/useShareIntent.ts` internals to consume the library hook, mapping `shareIntent` → `parseSharedText` → `prefill`; preserve the `{prefill, clearPrefill}` interface.
- Delete `ShareIntentModule.kt`, `ShareIntentPackage.kt`, `src/modules/ShareIntent.ts`, and the ShareIntent blocks in `copy-native-files.js` + `patch-native-config.js` (incl. our hand-rolled ACTION_SEND filter).
- Re-anchor ParkingWatcher registration onto FloatingBubble in both scripts.

**Out of scope**
- iOS share target (own deferred story).
- New content types (images/files/first-class URLs) — text/plain parity only.
- Any change to `shareText.ts`, `tasks.tsx`, `AddTaskModal`, or other native modules.

## Acceptance criteria
Inherits the shipped Share-text contract; **only criterion 5 changes** (best-effort subject), plus migration-integrity criteria M1–M4.

### Behavior parity (unchanged from Share-text)
1. **Given** DragonFlow installed, **when** the user opens the Android share sheet on text in any app, **then** DragonFlow appears as a share target (now via the library's generated `text/*` filter).
2. **Given** a share while DragonFlow is **closed**, **then** it launches to the Tasks tab with the Add Task modal open, pre-filled from the shared text (cold start).
3. **Given** a share while DragonFlow is **already running**, **then** the modal opens pre-filled without restarting or losing state (warm start).
4. **Given** the pre-filled modal, **when** Save → task created and appears in Ready; **when** Cancel → no task.
5. **(CHANGED — best-effort title)** **Given** a share, **then** the task **title** is `shareIntent.meta.title` (Android `EXTRA_TITLE`) **when the sender provides it**, otherwise it is derived from the shared text (bare URL → host; multi-line → first line); the shared text is preserved in the **description**. *(Regression vs the shipped feature, which used `EXTRA_SUBJECT`; `expo-share-intent` doesn't expose `EXTRA_SUBJECT`. Accepted 2026-08-26.)*
6. **Given** a multi-line share with no title, **then** first line → title, rest → description.
7. **Given** a single bare URL, **then** host → title, full URL → description; the app does **not** open/fetch it.
8. **Given** a short single-line share, **then** it → title, empty description.
9. **Given** a task from a share, **then** app defaults (Medium, Default category, no due date), all fields editable before save.
10. **Given** empty/whitespace-only share, **then** no task, no empty modal.
11. **Title too long:** title shortened, full text kept in description (no data loss).
11a. **Text exceeds size limit:** description truncated + visible `[TRIMMED]` marker; a log line records **lengths only, never content**.
12. **Exactly-once:** the same share is delivered once; `resetShareIntent()` on consume prevents re-fire on remount/activity recreate.
13. **Given** a malformed/unexpected intent, **then** ignored gracefully, no crash.
14. **Privacy:** raw payload **never logged** in release; only lengths / occurrence recorded.
15. **Given** shared text that looks like a URL/command, **then** treated purely as text — never executed/opened/fetched.
16. **Android-only:** `disableIOS: true` — no iOS files/behavior generated or committed.

### Migration integrity (new)
- **M1 — single filter:** the generated `AndroidManifest.xml` has **exactly one** `android.intent.action.SEND` `text/*` filter (the library's; ours removed — no duplicate).
- **M2 — packages intact:** generated `MainApplication.kt` still registers `FloatingBubblePackage` **and** `ParkingWatcherPackage` (the chained-anchor re-anchor worked); no `ShareIntentPackage` reference remains anywhere in `android/`.
- **M3 — clean removal:** no `ShareIntentModule`/`ShareIntentPackage`/`NativeModules.ShareIntent`/`shareTextReceived`/`src/modules/ShareIntent.ts` references remain (grep-clean); `shareText.ts` + its tests unchanged and green.
- **M4 — prebuild-resilient:** `npm run prebuild:clean` reproduces all of the above; scripts idempotent (2nd run = no-op).

## Definition of Done
- All ACs met: unit tests (`shareText.ts`) green; migration-integrity via prebuild reconciliation grep; behavior parity via on-device QA (share-sheet, cold/warm, exactly-once, privacy).
- `npm run check` green; prebuild reconciliation clean (M1–M4).
- Net custom-native reduction achieved; `tasks.tsx`/`AddTaskModal`/`shareText.ts` untouched.
- Backlog → Verified only after device QA.

## Handoff to Design
Specify: the exact `useShareIntent.ts` rewrite (library hook + `parseSharedText({ text: shareIntent.text, subject: shareIntent.meta?.title })` + `resetShareIntent()` + preserved `{prefill, clearPrefill}` + privacy log); the app.json plugin entry; the precise script removals + the ParkingWatcher re-anchor in both scripts; the deletion list; and the reconciliation grep checklist (M1–M4). Note optional Expo-Go `disabled` guard.
