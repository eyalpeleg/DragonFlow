# Story — Share-text target

> Stage 4 of the SDLC flow. Turns the analysis into a user-facing story with **testable acceptance criteria**. This is the contract Design builds to and Verify checks against. Written from the user's perspective; the NFR findings from Analyze become criteria here.

Input: [analysis.md](analysis.md) → "Handoff to Story".

## User story

**As a** DragonFlow user who just came across something worth doing (a link, a message, a note) in another app,
**I want to** share that text into DragonFlow and have it become a new task I can review before saving,
**so that** I can capture it in a couple of taps without breaking my flow to switch apps and retype it.

## Job-stories (the real situations)

- When I read an article in my browser, I want to share its link to DragonFlow so I can act on it later.
- When a friend messages me a place or idea, I want to capture it as a task fast, then get back to the chat.
- When I copy a few lines of notes, I want them turned into a task with the detail preserved.

## Scope

**In scope (v1)**
- Android share target for `text/plain` (incl. shared URLs).
- Review-then-save: open the Add Task modal **pre-filled**; nothing is saved without the user confirming.
- Smart mapping of shared text → title/description.
- Works whether the app is closed (cold start) or already running (warm start).

**Out of scope (v1)**
- iOS share extension (see Related & spawned stories).
- Instant/silent task creation with undo (we chose review-then-save).
- Sharing images, files, or other non-text content.

## Related & spawned stories

| Story | Relationship | Why | Tracked | Independent? |
|-------|-------------|-----|---------|--------------|
| **Upgrade Expo SDK 54 → 57** | **Alternative** (+ Enables) | Would let this feature drop its custom-native code for `expo-share-intent`, and **Enables** an iOS share target (currently out of scope). If it lands, share-text's *mechanism* is reconsidered — in that story's Design, not here. | Planned row in [features.md](../../features.md); spawned by [analysis.md](analysis.md) → "Dependency & upgrade analysis". Runs its own Idea→…→Verify pipeline when prioritized. | **Yes.** Share-text v1 ships on the current stack via custom-native and does **not** wait on this. No *Blocks* dependency. |

> No related story is a **Blocks**, so the Definition of Done below carries no external dependency.

## Acceptance criteria

Written Given/When/Then. Each is independently verifiable (→ maps to a test or a manual QA step in Verify).

### Core capture flow
1. **Given** DragonFlow is installed, **when** the user opens the Android share sheet from any app on a piece of text, **then** DragonFlow appears as a share target.
2. **Given** the user shares text while DragonFlow is **closed**, **when** they pick DragonFlow, **then** the app launches to the Tasks tab with the Add Task modal open and pre-filled from the shared text.
3. **Given** the user shares text while DragonFlow is **already running**, **when** they pick DragonFlow, **then** the Add Task modal opens pre-filled without restarting the app or losing existing state.
4. **Given** the pre-filled modal, **when** the user taps Save, **then** a task is created with the entered content and appears in the Ready list; **when** the user cancels, **then** no task is created.

### Text → field mapping (B2 + B3)
5. **Given** a share that includes a subject/title (e.g. a browser tab), **then** the subject becomes the task **title** and the shared body becomes the **description**.
6. **Given** a multi-line share with no subject, **then** the first line becomes the **title** and the remaining lines become the **description**.
7. **Given** a share that is a single bare URL, **then** the URL is used as the **title** (or its domain) and preserved in the **description**; the app does **not** open or fetch the URL.
8. **Given** a short single-line share, **then** it becomes the **title** with an empty description.

### Defaults & integration
9. **Given** a task created from a share, **then** it uses app defaults (priority Medium, Default category, no due date) and the user can change any field in the prefilled modal before saving — including due date, recurrence, and sub-tasks.

### Robustness (from NFR analysis)
10. **Given** an empty or whitespace-only share, **then** no task is created and the app does not present an empty modal.
11. **Title too long (no data loss):** **Given** a shared text longer than the title cap but within the size limit, **then** the title is shortened to a sane length while the **full** text remains in the description (no content lost, no runaway UI).
11a. **Text exceeds size limit (data loss → must be visible):** **Given** a shared text that exceeds the maximum size limit, **then** the description is truncated at the limit and a visible **`[TRIMMED]`** marker is appended to the end of the description so the user knows some of their copied text was dropped, **and** the app writes a log line noting that trimming happened — recording **only lengths, never the content** (consistent with criterion 14). *(Surfaced during Design: the original criterion said only "capped" and left the user-visible action undefined.)*
12. **Given** the same share is delivered once, **when** the app remounts or the activity is recreated, **then** the task is **not** created twice (delivered exactly once; pending share cleared after read).
13. **Given** any malformed/unexpected intent (missing text extra, wrong type), **then** the app ignores it gracefully and never crashes.

### Privacy & security (from NFR analysis)
14. **Given** shared content that may be sensitive, **then** the raw payload is **never written to logs** in a release build, and analytics (if any) records only that a share-task occurred, never its content.
15. **Given** shared text that looks like a URL or command, **then** it is treated purely as text — never executed, opened, or fetched automatically.

### Platform
16. **Given** this is an Android-only feature, **then** no iOS behavior or files are affected, and the Android share-sheet entry uses the app's name and icon.

## Definition of Done

- All acceptance criteria pass (unit tests for mapping/robustness in `shareText.ts`; manual QA on-device for the share-sheet, cold/warm start, and privacy/log checks).
- Native changes are prebuild-resilient (survive `npm run prebuild:clean`).
- `npm run check` (typecheck + lint + test) is green.
- No new runtime dependency added.

## Handoff to Design

Design must specify: the exact `text/plain` intent-filter and where it's injected (`patch-native-config.js`); the native module surface (`getInitialShareText()` + `shareTextReceived` event) and the MainActivity intent-forwarding patch; the `shareText.ts` parsing rules that satisfy criteria 5–8, 10–11; the `AddTaskModal` prefill props; and the app-entry wiring that opens the modal on cold/warm start with exactly-once semantics (criterion 12).
