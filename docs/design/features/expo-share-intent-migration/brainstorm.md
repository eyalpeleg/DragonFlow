# Brainstorm — expo-share-intent migration

## The idea in one line
Replace DragonFlow's **custom native** Android share-target stack (`ShareIntentModule.kt` + `ShareIntentPackage.kt` + `src/modules/ShareIntent.ts` + `patch-native-config.js` wiring) with the maintained **`expo-share-intent`** library, preserving the exact share-to-task behavior (all 16 criteria of the shipped Share-text feature) and the app's `useShareIntent() → {prefill, clearPrefill}` interface. **Android-only; iOS deferred.** Unlocked by the SDK 57 upgrade.

## Value & prioritization
- **Who it's for** — the maintainer (delete ~150 lines of custom Kotlin + a hand-rolled JS bridge + brittle `patch-native-config.js` manifest regex, in favor of a maintained config-plugin lib). No user-visible change intended.
- **Impact** — **Medium.** Pure tech-debt reduction + sets up iOS share as a cheap follow-up. The current custom module works (device-verified during the SDK-57 QA), so this is maintenance, not a capability gain.
- **Effort** — **M.** Bounded: keep the pure parser + hook interface + UI; swap only the native-delivery layer; delete custom native + its wiring. Risk is in cold/warm-start + exactly-once semantics and the config-plugin manifest output (device-QA territory).
- **Roadmap fit** — spawned by Share-text analysis + SDK-57 upgrade. Directly enables the **iOS share target** story later at low marginal cost (same lib, add iOS activation rules).
- **Kill criteria** — would defer if `expo-share-intent` didn't support SDK 57 / RN 0.86 (it does, v6+ needs no post-install on SDK 55+), or if it couldn't preserve exactly-once + cold/warm semantics. → none met. Proceed. *(User already weighed "reconsider/defer" at the pick-idea gate and chose to migrate Android-only.)*

## Divergent approaches

### Dimension A — Integration point with the app
- **A1 — Library `useShareIntent()` inside our existing hook.** Our `src/hooks/useShareIntent.ts` internally calls the library's `useShareIntent()` (aliased), maps `shareIntent` → `parseSharedText()` → `prefill`, calls the library's `resetShareIntent()` on consume. Smallest blast radius; `tasks.tsx` untouched. *(Recommended.)*
- **A2 — `ShareIntentProvider` at root `_layout.tsx` + `useShareIntentContext`.** The lib's recommended pattern for multi-screen apps. More moving parts (a provider at root) for a single consumer. Overkill here.
- **A3 — expo-router `+native-intent.ts` redirect.** Route the share to a specific screen via expo-router's native-intent hook. Elegant for deep-routing, but we don't route — we open a modal on the Tasks tab. Unnecessary indirection.

### Dimension B — App-facing interface
- **B1 — Preserve `useShareIntent() → {prefill, clearPrefill}`.** `tasks.tsx` and its effect stay byte-for-byte; only the hook internals change. *(Recommended.)*
- B2 — Adopt the library's `{shareIntent, resetShareIntent}` directly in `tasks.tsx`. Leaks the lib into the UI + rewrites the working consumer + its parsing/prefill glue. Rejected.

### Dimension C — The pure parser
- **C1 — Keep `src/utils/shareText.ts` unchanged.** It satisfies criteria 5–8, 10–11, 11a (title/desc mapping, URL-as-text, size cap + `[TRIMMED]`) and is fully unit-tested. Feed the library's shared text (+ subject if available) into it. *(Recommended.)*
- C2 — Drop it, use the library's pre-parsed `shareIntent` fields. Loses our tested mapping rules + the privacy-safe trimming. Rejected.

### Dimension D — Content types
- **D1 — text/plain parity only** (incl. URLs-as-text, as today). Matches the shipped contract. *(Recommended.)*
- D2 — Expand to first-class URLs / images / files (the lib supports them). Scope creep beyond the migration; separate enhancement story.

## Cross-cutting concerns
- **Subject (EXTRA_SUBJECT).** Criterion 5 maps a shared subject → title. Must confirm `expo-share-intent` surfaces the Android `EXTRA_SUBJECT` (likely via `shareIntent.meta?.title` or similar). If it doesn't, criterion 5's "subject→title" degrades to first-line→title — an **analyze must-resolve** (may need a `meta` field or accepted behavior change).
- **Exactly-once (criterion 12).** The lib's `resetShareIntent()` must be called after consuming so a remount/activity-recreate doesn't re-deliver. Map to our `clearPrefill` flow.
- **Privacy (criterion 14).** Keep the lengths-only oversized-share log in the hook boundary; never log the lib's raw `shareIntent`.
- **Prebuild resilience.** The lib is a config plugin (app.json `plugins`) — it should generate the ACTION_SEND intent-filter itself. We must **remove** our `patch-native-config.js` ShareIntent block + the Kotlin so there's no double intent-filter / dead package registration. Re-verify the generated manifest has exactly one share intent-filter.
- **Naming collision.** Library exports `useShareIntent`; our hook is also `useShareIntent`. Import the lib's aliased (e.g. `useShareIntent as useLibShareIntent`).
- **Expo Go vs dev-client.** Lib needs a native build (dev-client) — fine, we don't use Expo Go. `disabled: true` option exists for Expo Go only.
- **Android-only guard (criterion 16).** Config plugin should add only Android intent filters; ensure no iOS files are generated/committed.

## Recommendation
A1 (library hook inside ours) · B1 (preserve interface) · C1 (keep parser) · D1 (text parity). Minimal blast radius: rewrite `src/hooks/useShareIntent.ts` internals + `src/modules/ShareIntent.ts` (delete or repoint), add `expo-share-intent` + its plugin, delete the Kotlin + `patch-native-config.js` share block. `tasks.tsx`, `shareText.ts`, `AddTaskModal` untouched.

## Open questions → Analyze
- Exact `expo-share-intent` API shape on SDK 57 (`useShareIntent` return, `shareIntent` fields incl. subject/meta, `resetShareIntent`, `ShareIntentProvider` necessity for A1).
- Does the config plugin fully generate the `text/plain` ACTION_SEND intent-filter, or is extra config needed? Any collision with our current MainActivity filter after we remove ours?
- Subject/EXTRA_SUBJECT availability (criterion 5).
- Whether `+native-intent.ts` is required at all for a modal-on-current-tab flow (expect no).
- Exact removal list + prebuild reconciliation deltas (ShareIntentPackage registration removal in `copy-native-files.js`/`patch-native-config.js`).

## ✅ Converged decisions (2026-08-26)
| Dim | Decision | Source |
| --- | --- | --- |
| Scope | **Android-only** migration; iOS deferred | Pick-idea gate |
| A · Integration | **A1** — library hook inside our `useShareIntent` | Autopilot (recommended) |
| B · Interface | **B1** — preserve `{prefill, clearPrefill}`; `tasks.tsx` untouched | Autopilot |
| C · Parser | **C1** — keep `shareText.ts` | Autopilot |
| D · Content | **D1** — text/plain parity only | Autopilot |
| Autonomy | **Autopilot** | Pick-idea gate |

## Summary & Handoff to Analyze
**What we're building** — an internal swap of the Android share-target delivery layer from custom native to `expo-share-intent`, behind the unchanged `useShareIntent() → {prefill, clearPrefill}` interface, preserving all 16 Share-text criteria and text/plain-only scope. Delete the custom Kotlin + JS bridge + `patch-native-config.js` share wiring; add the lib + its config plugin.

**Deferred to Analyze** — the library's exact SDK-57 API + `shareIntent` field shape (esp. subject/EXTRA_SUBJECT for criterion 5); whether the config plugin fully generates the ACTION_SEND filter and how to avoid a double filter after removing ours; `resetShareIntent` → exactly-once mapping; the precise remove/keep/add file list with prebuild-reconciliation deltas; confirm no iOS artifacts.

**Value verdict** — Medium impact (maintenance + iOS enabler), Effort M, low-to-medium risk (device-QA for share-sheet/cold-warm/exactly-once).
