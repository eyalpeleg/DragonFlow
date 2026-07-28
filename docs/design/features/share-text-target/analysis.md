# Analysis — Share-text target

> Stage 3 of the SDLC flow. Takes the brainstorm's converged decisions and the deferred technical questions, and turns them into a grounded feasibility verdict: mechanism, affected files, risks, effort. No code yet — that's Design/Implement.

Input: [brainstorm.md](brainstorm.md) → "Summary & Handoff to Analyze".

## Feasibility verdict

**Feasible, Android-only, effort M.** No blockers. All required native building blocks already exist in the repo (event-emitting native module pattern, manifest-patching prebuild step). No new runtime dependency needed.

## Mechanism decision — resolve the deferred question

Brainstorm deferred D1 (`expo-share-intent`) vs D2 (custom-native). **Decision: D2 — custom-native.**

Evidence gathered:

| Option | Finding | Verdict |
|--------|---------|---------|
| `expo-share-intent` (D1) | Peer `expo` ranges: v≤4.0.0 → `^53`; current v8.0.1 → `^57`. Project is **expo 54.0.34** — falls in the unsupported gap (no published line targets 54). | ❌ Ruled out — incompatible with SDK 54; adds a dependency that fights the custom prebuild pipeline. |
| `expo-linking` | Handles `VIEW` / deep-link intents, **not** `ACTION_SEND`. | ❌ Can't receive shares. |
| Custom-native (D2) | Repo already has the pattern: `FloatingBubbleModule.kt` exposes `@ReactMethod` getters + emits events via `DeviceEventManagerModule.RCTDeviceEventEmitter`, consumed by `NativeEventEmitter` in `src/modules/FloatingBubble.ts`. Manifest edits already scripted in `patch-native-config.js`. | ✅ Chosen — reuses proven plumbing, no new deps, prebuild-resilient. |

## How it will work (approach sketch — details in Design)

1. **Manifest:** add an `ACTION_SEND` + `text/plain` `<intent-filter>` to the `.MainActivity` block. `MainActivity` is `launchMode="singleTask"`, so a share while the app is alive arrives via `onNewIntent`; a cold share arrives in `onCreate`'s intent.
2. **Native read:** capture `Intent.EXTRA_TEXT` (+ optional `Intent.EXTRA_SUBJECT`) and hold it as a pending value in a native module.
3. **Bridge to JS:** mirror FloatingBubble — a `getInitialShareText()` `@ReactMethod` (Promise) for cold start + a `shareTextReceived` emitted event for warm start.
4. **JS handling:** an app-entry hook reads the pending share on mount and subscribes to the event, then parses text→fields (subject/first line → title, rest → description, bare-URL aware) and opens the **Add Task modal pre-filled** (A1). Nothing is persisted until the user saves.

## Product depth (beyond the happy path)

- **Discoverability & first-use:** appears in the Android share sheet automatically once the intent-filter ships — no in-app onboarding required. Optional future nicety: a one-time hint ("You can now share text to DragonFlow"). Not needed for v1.
- **State coverage:**
  - *Blank / whitespace-only* share → ignore, create no task.
  - *URL-only* → title = URL (or domain); description = URL.
  - *Subject + body* (browser tab share) → subject → title, body → description.
  - *Very long text* → title trimmed to a sane length; full text in description.
  - *Non-text* (image/file) → excluded by `mimeType="text/plain"`; never reaches us.
- **Interactions with existing features:** the shared task is a normal task — user can set category, priority, due date, recurrence, and sub-tasks in the prefilled modal. No notifications/bubble effects until it's actually saved with a due date (review-then-save guarantees that).
- **After the action:** on save the task lands in the Ready list on the Tasks tab; if the app was cold-started by the share, it opens straight to Tasks with the modal up. Cancel discards — no undo needed because nothing is persisted pre-save.
- **Job-stories:**
  - *When I read an article, I want to save its link as a task so I can act on it later.*
  - *When a friend sends me a place/idea in chat, I want to capture it in one tap without leaving the conversation for long.*

## Non-functional analysis (NFR planes)

| Plane | Finding | Requirement |
|-------|---------|-------------|
| **Security** | Shared text is **untrusted external input** from any app. It's only ever placed in a plain `TextInput` (no WebView/eval), so no injection surface. A shared string that looks like a URL is stored as text — **we never auto-open or fetch it.** Adding `ACTION_SEND` to the already-`exported` MainActivity doesn't meaningfully widen the attack surface. | Treat as a string; never execute/fetch. Cap length. No new exported components. |
| **Privacy** | Shared content can be sensitive (a private message, a personal note). Once saved it's persisted to AsyncStorage **and** synced to Google Drive backup if enabled — same as any task, and gated by explicit user save. | Do **not** log the share payload (no `console.log` of content in release). Analytics may count "task created from share" but **never** the text. Review-then-save = consent. |
| **Performance & Scale** | Payloads are tiny; cold-start reads a single intent extra (negligible latency). Bursts are last-one-wins. No impact on task-list scale (one task). | Cap payload (~10k chars) to avoid pathological memory/UI cost. |
| **Reliability & Error handling** | Missing/empty `EXTRA_TEXT`, wrong mime, or a native exception must never crash `MainActivity`. Cold-start delivery must not be lost if JS isn't mounted yet; remounts must not re-add the same task. | Guard all extras; wrap native read in try/catch. Native holds pending text; JS pulls on mount; **clear-after-read** for idempotency. |
| **Accessibility** | Prefilled modal must be screen-reader navigable; focus should land predictably. | Reuse existing modal a11y; focus the title field on open. |
| **Compatibility & Platform** | `ACTION_SEND text/plain` is universal across Android OEMs/versions; Android 13+ share sheet needs no special handling. | Android-only (C1); no iOS files touched (platform-separation rule). Verify against current `minSdk`. |
| **Observability** | We'll want to know if the feature gets used. | Optional privacy-safe counter of shares-created via the existing analytics util — content-free. |
| **Internationalization** | Shared text may be non-ASCII / RTL; URLs may contain unicode. | `TextInput` handles RTL/unicode; URL detection must not choke on unicode — keep parsing permissive. |
| **Maintainability & Footprint** | **No new npm dependency** (custom-native). Adds ~2 Kotlin files + a JS bridge + a manifest patch — consistent with the existing FloatingBubble pattern. | New native files must be registered in `copy-native-files.js`; re-copy before gradle (memory: native-copy-after-edit). |
| **Data integrity & Offline** | Fully local; no network needed. Nothing saved without user action. | No migration needed; no data-loss path. |

## Dependency & upgrade analysis (side-way story)

Is the custom-native path a symptom of an out-of-date stack — would an upgrade unlock a better approach?

- **What an upgrade unlocks:** bumping **Expo SDK 54 → 57** would make `expo-share-intent@8` (peer `expo ^57`) usable. That's a config-plugin + JS hook — it would **remove the ~2 Kotlin files, the manifest patch, and the MainActivity patch**, and (bonus) provide an **iOS share extension**, unblocking the deferred iOS scope (C2).
- **Cost & blast radius:** SDK 54 → 57 is a **three-major-version jump** — React Native bump plus breaking changes rippling through `expo-audio`, `@react-native-google-signin`, the custom native modules, and a full prebuild/native regression pass across the whole app. High cost, high risk, almost entirely **unrelated to this one feature**.
- **Decision:** **Ship share-text on the current stack now** via custom-native (low blast radius, no deps). **Do not couple** the feature to a global SDK upgrade.
- **Side-way enabler story (recommended):** *"Upgrade Expo SDK 54 → 57"* — its own value case (security patches, newer RN, unlocks `expo-share-intent` + iOS share, and lets us later **replace** this feature's custom-native code with the library). Added to Planned as an enabler; share-text can be re-approached with the simpler mechanism once it lands.

## Affected files / change map

| Area | File | Change |
|------|------|--------|
| Manifest | `scripts/patch-native-config.js` | Add the `ACTION_SEND text/plain` intent-filter to the MainActivity block (prebuild-resilient; **not** the generated manifest directly). |
| Native module | `modules/dragonflow-native/.../ShareIntentModule.kt` (new) + `ShareIntentPackage.kt` (new) | Hold pending share text; expose `getInitialShareText()`; emit `shareTextReceived`. |
| Native activity | `MainActivity.kt` handling | Forward `onCreate`/`onNewIntent` `ACTION_SEND` intents to the module. Patched via `scripts/copy-native-files.js` (same mechanism used for `MainApplication.kt`), never edited in generated `android/`. |
| Package registration | `MainApplication.kt` patch in `copy-native-files.js` | Register `ShareIntentPackage` alongside `FloatingBubblePackage`. |
| Copy script | `scripts/copy-native-files.js` | Add the two new `.kt` files to the copy list. |
| JS bridge | `src/modules/ShareIntent.ts` (new) | Typed wrapper: `getInitialShareText()`, `addShareTextListener()`. |
| Text parsing | `src/utils/shareText.ts` (new) | Pure fn: shared text (+subject) → `{ title, description }`, URL-aware. **Unit-testable core.** |
| Prefill entry | `src/components/AddTaskModal.tsx` | Add optional `initialTitle` / `initialDescription` props (modal currently has none). |
| App wiring | `app/_layout.tsx` or `app/(tabs)/tasks.tsx` | On mount + on event: parse share, open Add Task modal prefilled. |

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Manifest/native edits wiped by `expo prebuild` | High if done wrong | Route **all** edits through `patch-native-config.js` / `copy-native-files.js` (project rule + memory `feedback_prebuild_resilience`). |
| Cold-start race (JS not mounted when share arrives) | Medium | Native holds pending text; JS pulls via `getInitialShareText()` on mount, so no event is missed. |
| Duplicate delivery (getter **and** event both fire) | Medium | Native clears the pending value once read; event only for warm-start deliveries. |
| Editing generated `MainActivity.kt` | Medium | Patch it from `copy-native-files.js` like `MainApplication.kt`; re-run copy before gradle (memory `feedback_native_copy_after_edit`). |
| Empty / oversized shared text | Low | Guard in `shareText.ts`: ignore empty; cap length; trim. |
| iOS scope creep | Low | Explicitly Android-only (C1); no iOS files touched. |

## Effort estimate

**M (~½–1 day).** Native module + activity patch (~⅓), JS bridge + parsing + tests (~⅓), modal prefill + wiring + manual QA (~⅓). Verification needs a native rebuild (`npm run prebuild:clean` + install), not just Metro reload.

## Open questions carried to Story / Design

- **Priority/category on a shared task:** use app defaults (Medium / Default) and let the user change them in the prefilled modal? (Assumed yes.)
- **URL handling specifics:** bare URL → title = URL or its domain? subject present → subject = title, URL = description? (Design to specify exact parse rules; `shareText.ts` tests will pin them.)
- **Multiple rapid shares:** last-one-wins is fine for v1.

## Handoff to Story

Build a share target on Android using a **custom native module** (no new deps). Shared text opens the Add Task modal pre-filled via smart parsing; user reviews and saves. Effort M; main risk is prebuild-resilient native wiring, already a solved pattern in this repo.

Story stage should turn the A1 + B2/B3 behavior into a user story with concrete acceptance criteria, and fold in the NFR findings above as testable criteria, notably:
- Blank/whitespace share creates no task; oversized text is capped; wrong mime never reaches the app.
- Cold-start and warm-start both deliver exactly once (clear-after-read → no duplicate task on remount).
- Share payload is never logged; nothing persists until the user saves.
- URL-only and subject+body shares map to title/description per B3.

**Side-way story spawned:** *Upgrade Expo SDK 54 → 57* (added to Planned) — an enabler that would later let this feature drop its custom-native code for `expo-share-intent` and unlock an iOS share target. Independent of shipping share-text now.
