# Design — expo-share-intent migration (Android-only)

Blueprint satisfying `story.md`. Grounded in the resolved library API (analysis.md) + the repo's prebuild-resilience rules. Net effect: delete the custom native share stack, route delivery through `expo-share-intent`, keep the parser + hook interface + UI.

## Data flow (after migration)
```
Android share sheet (text/plain, ACTION_SEND)
  → expo-share-intent native receiver (library) + generated MainActivity <intent-filter>
  → library useShareIntent() → { hasShareIntent, shareIntent, resetShareIntent }
  → src/hooks/useShareIntent.ts (ours):  parseSharedText({ text, subject: meta?.title })
       → prefill {title, description}   + resetShareIntent()  (exactly-once)
  → app/(tabs)/tasks.tsx effect → open AddTaskModal prefilled   [UNCHANGED]
```

## Component-by-component

### 1. Dependency + config plugin
- `npx expo install expo-share-intent` → pins ~8.0.x (SDK 57).
- `app.json` plugins array — add (alongside the existing native plugin):
```json
["expo-share-intent", { "androidIntentFilters": ["text/*"], "disableIOS": true }]
```
Generates the `.MainActivity` ACTION_SEND `text/*` filter; `disableIOS` = no iOS target (criterion 16).

### 2. `src/hooks/useShareIntent.ts` — internals rewrite (interface preserved)
Replace the custom-bridge import/effect; keep `SharePrefill`, `parseSharedText`, the privacy `console.warn`, and the `{prefill, clearPrefill}` return. Target shape:
```ts
import { useCallback, useEffect, useState } from 'react';
import { useShareIntent as useLibShareIntent } from 'expo-share-intent';
import { parseSharedText, TEXT_MAX } from '../utils/shareText';

export interface SharePrefill { title: string; description: string; }

export function useShareIntent() {
    const [prefill, setPrefill] = useState<SharePrefill | null>(null);
    // Native module is absent under Expo Go; we only run dev-client/release, but guard defensively.
    const { hasShareIntent, shareIntent, resetShareIntent } = useLibShareIntent({ disabled: false });

    useEffect(() => {
        if (!hasShareIntent || !shareIntent?.text) return;
        // Best-effort title: EXTRA_TITLE (meta.title) when present, else text-derived (parser).
        const parsed = parseSharedText({ text: shareIntent.text, subject: shareIntent.meta?.title });
        if (parsed) {
            if (parsed.trimmed) {
                console.warn(
                    `[shareText] oversized share trimmed to ${TEXT_MAX} chars (was ${shareIntent.text.length})`,
                );
            }
            setPrefill({ title: parsed.title, description: parsed.description });
        }
        resetShareIntent(); // exactly-once: clear so a remount doesn't re-fire (criterion 12)
    }, [hasShareIntent, shareIntent, resetShareIntent]);

    const clearPrefill = useCallback(() => setPrefill(null), []);
    return { prefill, clearPrefill };
}
```
Notes: `parseSharedText` unchanged (best-effort subject falls out of its existing `if (subject)` branch). Privacy: log lengths only, never `shareIntent.text` content (criterion 14). `resetShareIntent` runs whether or not `parsed` is usable (drains malformed/empty shares → criteria 10, 13).

### 3. Delete files
- `modules/dragonflow-native/android/src/main/java/com/plgsw/dragonflow/ShareIntentModule.kt`
- `modules/dragonflow-native/android/src/main/java/com/plgsw/dragonflow/ShareIntentPackage.kt`
- `src/modules/ShareIntent.ts`

### 4. `scripts/copy-native-files.js` edits
- Remove `'ShareIntentModule.kt', 'ShareIntentPackage.kt',` from the kotlin copy list (`~:29-30`).
- Remove the ShareIntent import-injection block (`~:137-142`) and the `add(ShareIntentPackage())` registration block (`~:157-162`).
- **Re-anchor ParkingWatcher** (`~:165-166`): anchor `/add\(ShareIntentPackage\(\)\)/` → `/add\(FloatingBubblePackage\(\)\)/`; replacement `'add(ShareIntentPackage())\n              add(ParkingWatcherPackage())'` → `'add(FloatingBubblePackage())\n              add(ParkingWatcherPackage())'`.
- Log string (`~:171`): drop `ShareIntent +`.

### 5. `scripts/patch-native-config.js` edits
- Remove the ShareIntentPackage registration block (`~:34-46`).
- **Re-anchor ParkingWatcher** (`~:51-53`): same `/add\(ShareIntentPackage\(\)\)/` → `/add\(FloatingBubblePackage\(\)\)/` swap.
- Remove the ACTION_SEND intent-filter injection block (`~:121-129`) — the library's plugin generates it (avoids double filter, M1).

> Line numbers are guides; match on the anchor strings (they may shift). Edit the script SOURCE, never generated `android/` (prebuild-resilience).

## Criteria → design traceability
| AC | Design element | Verified by |
| --- | --- | --- |
| 1,7,8,10,11,11a,15 | `parseSharedText` (unchanged) + library `text/*` filter | unit tests (shareText) + device |
| 5 | `subject: shareIntent.meta?.title` into parser | code review + device |
| 2,3,12,13 | library cold/warm delivery + `resetShareIntent()` on consume | device QA |
| 4,9 | unchanged `tasks.tsx`/`AddTaskModal` prefill | device QA |
| 14 | lengths-only `console.warn`; never log `shareIntent.text` | code review |
| 16, M1 | plugin `disableIOS:true`, `["text/*"]`; remove our filter | grep generated manifest (one SEND filter, no iOS) |
| M2 | ParkingWatcher re-anchor in both scripts | grep generated MainApplication (FloatingBubble+ParkingWatcher present) |
| M3 | delete files + script blocks | grep src/ scripts/ android/ clean |
| M4 | prebuild:clean + 2× script run | idempotency check |

## Build order (implement)
1. `npx expo install expo-share-intent`; add plugin to `app.json`.
2. Rewrite `src/hooks/useShareIntent.ts` internals.
3. Delete the 3 files.
4. Edit `copy-native-files.js` + `patch-native-config.js` (removals + re-anchor).
5. `npm run check` (typecheck catches the dropped `RawShare`/bridge import; shareText tests stay green).
6. `npx expo-doctor`; clean reinstall if hoisting wobbles (per SDK-57 upgrade learnings).
7. `npm run prebuild:clean` → reconciliation grep (M1–M4).
8. Adversarial review → precommit → 🛑 commit gate.

## Test plan
- **Automated (agent):** `npm run check` (shareText tests unchanged; no dangling imports); `expo-doctor`; `prebuild:clean` + reconciliation grep (one SEND filter; MainApplication has FloatingBubble+ParkingWatcher, no ShareIntent; no `ShareIntent*` in `android/`); script idempotency (2nd run no-op).
- **Consider:** a small unit test for the hook's payload mapping (`shareIntent → parseSharedText` best-effort subject) if it can be done without a heavy native mock; otherwise rely on shareText tests + device QA.
- **Device QA (user):** share-sheet entry, cold + warm start prefill, exactly-once (reshare after background), title best-effort (share from a browser: title now host/first-line unless EXTRA_TITLE set), `[TRIMMED]` on oversized, privacy (no payload in logcat on release), parking watcher still works (regression guard for the re-anchor).
