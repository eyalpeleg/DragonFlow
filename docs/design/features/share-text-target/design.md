# Design — Share-text target

> Stage 5 of the SDLC flow. The technical blueprint that satisfies every acceptance criterion in [story.md](story.md). Concrete enough to implement from directly. Grounded in the real patterns in this repo.

Input: [story.md](story.md) (16 acceptance criteria) + [analysis.md](analysis.md) (mechanism = custom-native).

## Approach (refined from Analysis)

Custom-native, **Android-only**, no new dependency. Shared `text/plain` intents are routed to `MainActivity` by a manifest `<intent-filter>`, read by a small native module, handed to JS, parsed by a **pure, unit-tested function**, and used to open the existing Add Task modal pre-filled.

**Key refinement over Analysis:** the repo's `FloatingBubbleModule` already captures launch intents by implementing `ActivityEventListener` + `LifecycleEventListener` — `onNewIntent()` for warm start and `onHostResume()` peeking `currentActivity?.intent` for cold start, with a one-shot `removeExtra()` consume. The share module reuses this exact pattern, so **no `MainActivity.kt` patch is needed** (Analysis assumed one — dropped). This shrinks the native footprint and the prebuild-patch surface.

## Data flow

```
[Other app] --share text/plain--> Android share sheet --> MainActivity (intent-filter)
   cold start: onHostResume peeks currentActivity.intent ─┐
   warm start: onNewIntent(intent) ──────────────────────┤
                                                          ▼
                                   ShareIntentModule (Kotlin)
                     reads EXTRA_TEXT (+ EXTRA_SUBJECT), removeExtra() [one-shot]
                        cold → store as `pending`      warm → emit `shareTextReceived`
                                                          ▼
                            src/modules/ShareIntent.ts (typed JS bridge)
                     getInitialShareText() (pull pending)   onShareText(cb) (event)
                                                          ▼
                          src/utils/shareText.ts  parseSharedText({text,subject})
                                     → { title, description } | null      [PURE / TESTED]
                                                          ▼
                     useShareIntent() hook → sets prefill + opens AddTaskModal
                             (initialTitle / initialDescription props)
                                                          ▼
                                 User reviews & Saves → addTask()  (nothing saved before Save)
```

## Component design

### 1. Manifest intent-filter — `scripts/patch-native-config.js`
Add to the manifest patch (alongside the existing service/receiver block). Injected into the **`.MainActivity`** `<activity>` element so it survives prebuild:

```xml
<intent-filter>
  <action android:name="android.intent.action.SEND"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <data android:mimeType="text/plain"/>
</intent-filter>
```
Implementation: a regex insert that adds this filter before the closing `</activity>` of MainActivity, guarded by an `if (!content.includes('android.intent.action.SEND'))` idempotency check (same style as the existing patches). *(Satisfies criteria 1, 16.)*

### 2. `ShareIntentModule.kt` (NEW) — `modules/dragonflow-native/.../`
Mirrors `FloatingBubbleModule`'s intent-capture shape.

- `getName() = "ShareIntent"`
- Implements `ActivityEventListener` + `LifecycleEventListener`; registers both in `init` (like FloatingBubble).
- Companion holds `pendingText: String?`, `pendingSubject: String?`.
- `consumeSendIntent(intent: Intent?)`:
  - Guard: `intent?.action == Intent.ACTION_SEND && intent.type?.startsWith("text/") == true`.
  - Read `intent.getStringExtra(Intent.EXTRA_TEXT)` (+ `EXTRA_SUBJECT`); if text null/blank → return (criterion 13).
  - `removeExtra(EXTRA_TEXT)` / `removeExtra(EXTRA_SUBJECT)` — **one-shot** so a later resume can't re-fire (criterion 12).
  - Store into `pending*`.
- `onHostResume()` → `consumeSendIntent(currentActivity?.intent)` (**cold start** → pending only).
- `onNewIntent(intent)` → `consumeSendIntent(intent)`; if captured, also `emit("shareTextReceived", writableMapOf(text, subject))` (**warm start** → event).
- `@ReactMethod getInitialShareText(promise: Promise)` → return `{text, subject}` map (or null) **and clear** `pending*`. Wrap in try/catch → never crash (criterion 13).
- All reads null-safe; no logging of payload content (criterion 14).

> Cold vs warm split (pending-getter vs event) deliberately avoids double-delivery of the same share.

### 3. `ShareIntentPackage.kt` (NEW)
Identical shape to `FloatingBubblePackage`, returning `listOf(ShareIntentModule(reactContext))`.

### 4. `scripts/copy-native-files.js`
- Add `'ShareIntentModule.kt'` and `'ShareIntentPackage.kt'` to the `kotlinFiles` copy list.
- Register the package: extend the existing `MainApplication.kt` patch to also add `import com.plgsw.dragonflow.ShareIntentPackage` and `add(ShareIntentPackage())` (idempotent `includes()` guards, mirroring the FloatingBubble registration). Apply the same addition in `patch-native-config.js` where it registers `FloatingBubblePackage`, to keep both patch paths consistent.

### 5. `src/modules/ShareIntent.ts` (NEW) — typed JS bridge
```ts
export interface RawShare { text: string; subject?: string }
// Android-only; returns null off-Android or when nothing pending.
async function getInitialShareText(): Promise<RawShare | null>
function onShareText(cb: (raw: RawShare) => void): () => void   // returns unsubscribe
```
Same defensive shape as `FloatingBubble.ts` (Platform guard, try/catch, `NativeEventEmitter`).

### 6. `src/utils/shareText.ts` (NEW) — pure parser (the tested core)
```ts
export const TEXT_MAX = 10_000;
export const TITLE_MAX = 100;
export const TRIMMED_MARKER = '[TRIMMED]';
export interface ParsedShare { title: string; description: string; trimmed: boolean }
export function parseSharedText(raw: { text?: string | null; subject?: string | null }): ParsedShare | null
```
Rules (each maps to a criterion). The function is **pure** — it returns the `trimmed` flag; it does **not** log (logging happens at the hook boundary, §8, to keep this unit-testable):
- Trim `text`; if empty/whitespace → **return null** (criterion 10).
- **Size cap (data loss):** if `text.length > TEXT_MAX`, set `trimmed = true` and truncate the body to `TEXT_MAX` before deriving fields; otherwise `trimmed = false` (criterion 11a).
- **subject present** → `title = subject.trim()`, `description = body` (criterion 5).
- **bare URL** (whole trimmed text is a single URL, no whitespace) → `title = hostname` (fallback: the URL), `description = url`; never fetched (criteria 7, 15 — it's just string handling).
- **multi-line, no subject** → `title = firstNonEmptyLine`, `description = remaining lines` (criterion 6).
- **short single line** → `title = line`, `description = ''` (criterion 8).
- **Title cap (no data loss):** enforce `TITLE_MAX`: if the derived title is longer, truncate the title and ensure the **full body** is in `description` (criterion 11).
- **Trimmed marker:** if `trimmed`, append `\n\n${TRIMMED_MARKER}` to the end of `description`, so the user sees their copied text was cut (criterion 11a).

### 7. `AddTaskModal.tsx` — prefill props (edit)
- Add optional props: `initialTitle?: string; initialDescription?: string`.
- Add an effect keyed on `isVisible`: when it becomes `true`, if initial values are provided, seed `setTitle(initialTitle)` / `setDescription(initialDescription)`. (The existing focus effect already fires on open; seed alongside it.) Leaves the normal "+" open path unchanged when props are absent. *(Satisfies criteria 2, 3, 9 — task stays fully editable with defaults.)*

### 8. `src/hooks/useShareIntent.ts` (NEW) + wiring in `app/(tabs)/tasks.tsx`
`useShareIntent()` owns the glue:
- On mount: `getInitialShareText()` → `parseSharedText()` → if non-null, set prefill + open modal (**cold start**).
- Subscribe `onShareText()` → same handler (**warm start**); unsubscribe on unmount.
- **Trim logging (boundary):** in the shared handler, if `parsed.trimmed`, emit one log line recording **lengths only** — e.g. `console.warn('[shareText] oversized share trimmed to ' + TEXT_MAX + ' chars (was ' + rawLen + ')')`. Never log the payload text (criteria 11a + 14). Keeping the log here (not in the pure parser) preserves `shareText.ts` testability.
- Exposes `{ prefill, clearPrefill }`.
`tasks.tsx` (which already owns `addModalVisible` + `<AddTaskModal>`): open the modal when `prefill` is set, pass `initialTitle`/`initialDescription`, and call `clearPrefill()` on modal close so a later manual "+" isn't pre-filled. Tasks is the default tab, so cold-start lands here with the modal up (criterion 2). *(Satisfies criteria 2, 3, 4.)*

## Acceptance-criteria → design traceability

| Criteria | Satisfied by |
|---|---|
| 1, 16 (share sheet, Android-only, name/icon) | Manifest intent-filter (§1) |
| 2, 3 (cold/warm open prefilled) | Module cold/warm capture (§2) + hook wiring (§8) + modal props (§7) |
| 4 (Save creates / Cancel discards) | Existing modal `handleSubmit`/`handleClose`; nothing persists pre-Save |
| 5–8 (text→field mapping) | `parseSharedText` rules (§6) |
| 9 (defaults, editable) | Modal defaults unchanged; prefill only seeds title/description (§7) |
| 10 (blank → no task) | `parseSharedText` returns null (§6); hook doesn't open modal |
| 11 (title too long, no loss) | `TITLE_MAX` reflow — title shortened, full body kept in description (§6) |
| 11a (oversized → `[TRIMMED]` + log) | `TEXT_MAX` truncation + `[TRIMMED]` marker + `trimmed` flag (§6); length-only log at hook boundary (§8) |
| 12 (exactly once) | `removeExtra` one-shot + getter clears pending + cold/warm split (§2) |
| 13 (malformed → graceful) | Guards + try/catch in module (§2) and bridge (§5) |
| 14 (no payload logging) | No content logging anywhere; analytics content-free |
| 15 (never execute/fetch) | Text treated as string; URL only stored (§6) |

## Test plan (feeds Implement + Verify)

- **Unit (Jest), `src/utils/__tests__/shareText.test.ts`:** empty/whitespace→null; subject+body; multi-line first-line/rest; bare URL→hostname/url; short single line; title-too-long→title shortened + full body in description (`trimmed=false`); text-over-`TEXT_MAX`→description truncated, ends with `[TRIMMED]`, `trimmed=true`. Covers criteria 5–8, 10, 11, 11a.
- **Manual on-device (Verify):** appears in share sheet (1,16); cold-start prefilled (2); warm-start prefilled, no state loss (3); Save/Cancel (4); defaults editable (9); share the *same* text twice / rotate device → no duplicate (12); share blank/whitespace → nothing (10); share a >10k-char text → description ends with `[TRIMMED]` and logcat shows a length-only trim line, not the content (11a, 14); logcat shows no payload (14).

## Design decisions & alternatives

- **No `MainActivity.kt` patch** (vs Analysis assumption): reuse the module-as-`ActivityEventListener` pattern already proven by FloatingBubble. Fewer generated-file patches = less prebuild fragility.
- **Native stays "dumb", JS parses:** all mapping logic in `shareText.ts` so it's pure and unit-testable; the Kotlin side only shuttles raw strings. Directly serves the testability the story demands.
- **Pending-getter (cold) + event (warm) split:** the simplest way to guarantee exactly-once without a dedup token.
- **Trim marker in parser, trim log at the hook:** the parser returns a `trimmed` flag and appends the user-visible `[TRIMMED]` marker (both unit-testable); the length-only log is emitted at the hook boundary so `shareText.ts` stays pure and side-effect-free. *(This edge case's user-visible action was undefined in the first Story draft — Design surfaced it, Story was updated to criterion 11a, then Design followed it.)*

## Handoff to Implement (build order)

1. `src/utils/shareText.ts` + its tests (pure, TDD-friendly, no native needed).
2. `ShareIntentModule.kt` + `ShareIntentPackage.kt` (new native files).
3. `scripts/patch-native-config.js` (intent-filter) + `scripts/copy-native-files.js` (copy list + package registration).
4. `src/modules/ShareIntent.ts` bridge.
5. `AddTaskModal.tsx` prefill props.
6. `src/hooks/useShareIntent.ts` + `tasks.tsx` wiring.
7. `npm run prebuild:clean` → build → device QA per the manual test plan.

No new dependency. Verification requires a **native rebuild**, not just a Metro reload.
