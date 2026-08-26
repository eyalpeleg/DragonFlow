# Analysis — expo-share-intent migration (Android-only)

Input: `brainstorm.md` (Android-only swap, keep parser + hook interface, autopilot). Pressure-tests the migration against the library's real API and the repo's removal surface. **No code written here.**

## Mechanism, resolved with evidence
- **Library:** `expo-share-intent@8.0.1` — the SDK-locked version for **SDK 57 / RN 0.86** (SDK 56→v7, 55→v6). Deps pin `@expo/config-plugins ~57`, `expo-constants ~57`, `expo-linking ~57`, peer `expo: ^57`. **No post-install/patch script** (dropped at v6). New-arch clean.
- **Hook (standalone, no provider needed):** `const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent(options?)`. `ShareIntentProvider`/`useShareIntentContext` are only for multi-consumer apps — DragonFlow has one consumer, so the plain hook suffices.
- **`shareIntent` fields (Android text/plain):** `text` (=`EXTRA_TEXT`), `type` (`"text"`), `webUrl` (URL parsed from text or null), `files` (null), `meta.title` (=`EXTRA_TITLE`, **not** `EXTRA_SUBJECT`; usually null).
- **Exactly-once:** read on `hasShareIntent`, then call `resetShareIntent()` — clears the stored intent so remount/re-render doesn't re-fire. Cold + warm start both delivered via the module's activity-lifecycle singleton.
- **Config plugin AUTO-GENERATES the ACTION_SEND filter:** `withAndroidIntentFilters` injects onto `.MainActivity` an `<intent-filter>` (`action.SEND` + `category.DEFAULT` + `<data mimeType>` per entry; default `["text/*"]`). → We MUST remove our hand-rolled filter or get a **double filter**.
- **`+native-intent.ts`: not required** (only for expo-router deep-routing; we open a modal on the current tab).
- **scheme:** app.json already has `"scheme": "dragonflow"` (library uses expo-linking) ✓.
- **launchMode:** expo-router's generated MainActivity is already `singleTask`; plugin sets no default. Verify the generated manifest keeps `singleTask` (warm-start routing).

## The subject decision (criterion-5 regression — accepted)
`expo-share-intent` cannot read `EXTRA_SUBJECT`, which our custom module used for subject→title (criterion 5). **Decision (user, 2026-08-26): accept the loss, best-effort.** Implementation is clean and needs **no parser change**:
```ts
parseSharedText({ text: shareIntent.text, subject: shareIntent.meta?.title })
```
`parseSharedText` already does `if (subject) title = subject; else <text-derived>`. So `meta.title` (when the sender set `EXTRA_TITLE`) becomes the title; otherwise it falls back to host-for-URL / first-line — exactly the agreed behavior. Criterion 5 must be **rewritten** in the story to reflect best-effort (title from `meta.title` when present, else text-derived). All other criteria (2–4, 6–15) preserved; criterion 16 (Android-only) preserved via `disableIOS: true`.

## Removal & reconciliation surface (Android-only)
**REMOVE**
- Native: `modules/dragonflow-native/.../ShareIntentModule.kt` (137L), `ShareIntentPackage.kt` (14L) — delete files.
- JS bridge: `src/modules/ShareIntent.ts` (43L) — delete; **only importer is `src/hooks/useShareIntent.ts:2`** (confirmed).
- `scripts/copy-native-files.js`: remove the two Kotlin names from the copy list (`:29-30`), the ShareIntent import-injection (`:137-142`), the `add(ShareIntentPackage())` registration (`:157-162`), and drop `ShareIntent +` from the log (`:171`).
- `scripts/patch-native-config.js`: remove the ShareIntentPackage registration block (`:34-46`) and the **ACTION_SEND intent-filter injection** (`:121-129`).

**⚠️ CRITICAL — chained-anchor re-anchor (silent-break risk):** packages register as a chain `FloatingBubble → ShareIntent → ParkingWatcher`, where **ParkingWatcher is anchored on `add(ShareIntentPackage())`**. Removing ShareIntent naively makes ParkingWatcher's regex miss → parking module silently unregistered, no build error. **Fix: re-anchor ParkingWatcher onto FloatingBubble** in BOTH scripts:
- `copy-native-files.js:165-166`: anchor `/add\(ShareIntentPackage\(\)\)/` → `/add\(FloatingBubblePackage\(\)\)/`, replacement string ShareIntent→FloatingBubble.
- `patch-native-config.js:52-53`: same re-anchor.

**KEEP (unchanged)**
- `src/utils/shareText.ts` + `src/utils/__tests__/shareText.test.ts` (no native mock — stays green).
- `src/hooks/useShareIntent.ts` — **interface `{prefill, clearPrefill}` preserved**, internals rewritten (swap the custom bridge import for the library hook; keep `parseSharedText` + the lengths-only oversized-share `console.warn` for privacy criterion 14).
- `app/(tabs)/tasks.tsx` (consumer), `AddTaskModal` — untouched.
- FloatingBubble/Sound/Boot/ParkingWatcher Kotlin, permissions, `<queries>`, service/receiver decls.

**ADD**
- `package.json`: `expo-share-intent` (~8.0.x, via `expo install`).
- `app.json` plugins: `["expo-share-intent", { "androidIntentFilters": ["text/*"], "disableIOS": true }]`.

## Affected files (map)
- Delete: 2 Kotlin + `src/modules/ShareIntent.ts`.
- Edit: `scripts/copy-native-files.js`, `scripts/patch-native-config.js` (removals + re-anchor), `src/hooks/useShareIntent.ts` (internals), `app.json` (plugin), `package.json` (dep).
- Untouched: `shareText.ts` (+test), `tasks.tsx`, `AddTaskModal`, all other native.

## Risks & mitigations (ranked)
1. **Chained-anchor silent break of ParkingWatcher** — re-anchor in both scripts; reconciliation grep must confirm `add(ParkingWatcherPackage())` present after prebuild.
2. **Double ACTION_SEND filter** — remove our injection; grep generated manifest for **exactly one** `action.SEND`.
3. **Subject regression** — accepted (best-effort via `meta.title`); story criterion 5 updated; note in verification for device QA.
4. **Library plugin ↔ FloatingBubble MainActivity/MainApplication coexistence** — confirm the plugin's MainActivity edits don't collide with our registrations; verify generated MainApplication still has FloatingBubble + ParkingWatcher.
5. **Exactly-once across background→reshare** — `resetShareIntent()` on consume; device-QA (criterion 12).
6. **Expo Go** — lib throws under Expo Go; we run dev-client/release only. Optional defensive `disabled` guard via `Constants.appOwnership`.
7. **New-arch/RN 0.86 open issues** — not exhaustively triaged; a device build is the real test (can't build here — no JDK/SDK).

## Effort & feasibility
- **Feasible, no blocker.** Effort **M**. Net: **−194 lines custom** (137+14+43) + brittle script blocks, **+1 dep + 1 plugin line + ~15-line hook rewrite**. The pure parser + tests + UI are untouched, so automated verification stays strong; device QA covers the native-delivery behaviors.

## Handoff to Story
Rewrite **criterion 5** to best-effort (`meta.title` when present, else text-derived); keep criteria 2–4, 6–16. Add criteria: (a) no double ACTION_SEND filter; (b) ParkingWatcher (+ FloatingBubble) still registered post-removal; (c) no `ShareIntentPackage`/`NativeModules.ShareIntent` references remain; (d) Android-only — no iOS artifacts (`disableIOS:true`). "Done" = `npm run check` green, prebuild reconciliation clean (one filter, packages intact), device share-to-task parity.
