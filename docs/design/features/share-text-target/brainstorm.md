# Brainstorm — Share-text target

> Stage 2 of the SDLC flow. Diverge on approaches, surface open questions, converge with the user. No code, no final decisions on *how* to build — that's Analyze/Design.

## The idea in one line

Register DragonFlow as an Android **share target** so that when a user shares text from another app (browser URL, a note, a message), DragonFlow appears in the share sheet and turns that text into a new task.

## Value & prioritization

- **Who it's for:** the everyday user capturing something they just saw elsewhere — a link in the browser, a line from a chat, a note — without breaking flow to switch into DragonFlow.
- **Impact: High.** Zero-friction capture is the #1 retention lever for personal task apps; this removes the "switch app → tap + → type" ceremony and fits the app's quick-capture personality (floating bubble, Pomodoro).
- **Effort: M.** JS-side is small (prefill an existing modal); the real cost is the native share-intent plumbing and prebuild-resilient manifest edits. Android-only keeps it bounded.
- **Roadmap fit:** complements the floating bubble (both are "capture fast"); independent of the other Planned ideas, unblocks nothing but overlaps nothing either.
- **Kill criteria:** none met. Would reconsider if the only viable mechanism forced abandoning the custom prebuild pipeline, or if it required an iOS-scale native target (it doesn't — Android only).

**Verdict:** High impact / M effort / Android-focused → worth carrying into Analyze.

## Divergent approaches

### A. What happens when text arrives?
- **A1 — Review-then-save (prefill modal):** Open the existing Add Task modal pre-filled with the shared text; user tweaks priority/category/due, then saves. Safe, familiar, no "silent" surprises. Slightly more taps.
- **A2 — Instant task + toast:** Silently create a task with defaults (Medium / Default category / no due) and show a toast with an "Edit"/"Undo" action. Fastest capture; risks junk tasks and hidden state.
- **A3 — Hybrid:** Instant-create but land the user *inside* the app on that task's edit view. Fast but jarring on cold start.

### B. Text → fields mapping
- **B1:** Whole shared text → title. Simple; long shares make ugly titles.
- **B2:** First line → title, remainder → description. Handles multi-line notes nicely.
- **B3:** URL-aware: if the share is a bare URL, title = URL (or its domain), description = URL. Browser shares are the most common source.
- Android also passes an optional `EXTRA_SUBJECT` (e.g. page title when sharing a browser tab) — could map subject→title, text→description.

### C. Platform scope
- **C1 — Android only** (recommended). App is Android-focused; iOS share extensions need a separate native target + app group — out of proportion for now. Aligns with the platform-separation rule.
- **C2 — Android + iOS.** Much larger; defer iOS to its own idea.

### D. Technical mechanism (light — decided in Analyze/Design)
- **D1 — `expo-share-intent` community package:** config plugin adds the intent-filter + a JS hook delivers the shared text. Least native code; one more dependency; must play nice with the custom prebuild/copy-native pipeline.
- **D2 — Custom native (own module):** add the `ACTION_SEND` intent-filter to `AndroidManifest.xml` via the existing `patch-native-config`/`copy-native-files` step, read the intent in `MainActivity`, and surface the text through the existing native bridge. Full control, consistent with the "own your native code" pattern, but more code to maintain.

## Cross-cutting concerns to remember

- **Cold start vs warm start:** intent must be handled both when the app is launched by the share and when it's already running in the background.
- **Native prebuild resilience:** any `AndroidManifest.xml` change must live in the copy/patch scripts, never in generated `android/` (per project rule), or it's wiped on the next prebuild.
- **Empty/oversized text:** guard against empty shares and cap very long text.

## Recommendation going into Analyze

A1 (review-then-save) + B2/B3 mapping (first line/subject → title, rest → description, URL-aware) + C1 (Android only). Mechanism (D1 vs D2) is the main thing to settle in Analyze, weighing the dependency against the maintenance cost.

## Open questions for the user

1. **Capture behavior** — review-then-save (A1) or instant-create-with-toast (A2)?
2. **Field mapping** — first line → title / rest → description (B2), URL-aware (B3), or just dump it all in the title (B1)?
3. **Scope** — Android only for this pass (C1)?
4. **Mechanism preference** — try the `expo-share-intent` package (D1), or keep it fully in-house with a native intent-filter + bridge (D2)? (Can also defer to Analyze.)

## ✅ Converged decisions (user, 2026-07-28)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Capture behavior | **A1 — Review-then-save.** Open the Add Task modal pre-filled; user confirms/tweaks before it's saved. No silent tasks. |
| 2 | Field mapping | **B2 + B3 — Smart.** `EXTRA_SUBJECT` or first line → title; remaining text → description; bare URLs handled specially. |
| 3 | Scope | **C1 — Android only.** iOS share extension deferred to its own idea. |
| 4 | Mechanism | **Deferred to Analyze** — compare `expo-share-intent` vs custom-native against the real codebase and recommend. |

**Carried into Analyze:** the modal has no prefill prop today (Stage-2 grounding) — Analyze must scope adding one. Cold-start vs warm-start intent handling and prebuild-resilient manifest edits are the main technical risks to size.

## Summary & Handoff to Analyze

**What we're building:** an Android-only share target. When the user shares text (or a URL) from another app, DragonFlow opens with the Add Task modal pre-filled from that text, and the user reviews and saves it as a task.

**Decisions taken:**
- A1 — Review-then-save: pre-fill the existing Add Task modal; nothing is saved without user confirmation.
- B2 + B3 — Smart mapping: `EXTRA_SUBJECT` or first line → title; remaining text → description; bare URLs handled specially.
- C1 — Android only; iOS share extension deferred to its own idea.

**Deferred to Analyze (must be sized):**
- Mechanism: `expo-share-intent` vs custom-native. ⚠️ Early probe: `expo-share-intent@8` peer-requires `expo ^57`, but this project is **SDK 54** — confirm whether any compatible version exists, else lean custom-native.
- Where the intent-filter is injected so it survives prebuild (`patch-native-config.js`, alongside the existing manifest patches).
- Cold-start vs warm-start intent delivery, and adding a prefill prop / entry path to `AddTaskModal`.
- Empty/oversized text guards.

**Value verdict:** High impact / M effort / Android-focused → proceed.
