# Design — Fix Google auth expiration

## Approach

Reactive, layered inside `src/services/cloudBackup/`, Android-scoped, **no new dependency** (uses `@react-native-google-signin/google-signin@16.1.2` APIs already installed). Two additions:

1. **`googleAuth.getFreshToken()`** — the refresh primitive: clear the stale cached access token and refetch; on failure, fall back to `signInSilently()`; only then throw a terminal `AuthError`.
2. **`googleDrive.authorizedFetch()`** — an internal wrapper every Drive request routes through: on **HTTP 401** it calls `getFreshToken()` and retries the *same* request **exactly once**.

**Refinement of Analysis (recorded decision):** `googleDrive.ts` may import `googleAuth` directly — `googleAuth` imports only `./types`, so there is **no import cycle**. This lets `authorizedFetch` own the refresh internally and keeps the **four public Drive function signatures unchanged** (`listBackupFiles`/`uploadBackup`/`cleanupOldBackups`/`downloadBackup` still take `token: string`). Consequence: `backupService.ts` needs **no change**, and its existing test file stays valid (the `AuthError` it sees is now always post-retry/terminal — same behavior, sign out). This supersedes the analysis's "maybe thread a refresh callback through callers" option.

## Data flow

```
performBackup / performRestore / initializeBackup   (backupService.ts — UNCHANGED)
        │ getValidToken()  → first-attempt token
        ▼
listBackupFiles / uploadBackup / cleanupOldBackups / downloadBackup   (googleDrive.ts)
        │ route their fetch through ↓
        ▼
┌──────────────────────── authorizedFetch(token, build) ────────────────────────┐
│  resp = build(token)                                                           │
│  if resp.status !== 401 → return resp        ── non-401: untouched (AC7)        │
│  console.warn('drive: 401, refreshing access token')   ── breadcrumb (AC12)    │
│  try fresh = getFreshToken()  ──────────────┐                                  │
│     fail → warn('auth refresh failed…'); return original 401 → terminal (AC6)  │
│  return build(fresh)   ── retry ONCE; a 2nd 401 propagates, no 3rd try (AC6/9) │
└────────────────────────────────────────────────────────────────────────────────┘
        │ Response
        ▼
handleResponse(resp)   (UNCHANGED — 401→AuthError, 403→QuotaError, ok→JSON)
        ▼
back to backupService: terminal AuthError → setSignedOut()

getFreshToken()   (googleAuth.ts — the pure-ish SDK seam)
   Path 1: getTokens() → clearCachedAccessToken(old) → getTokens() → fresh   (AC1)
   Path 2 (if Path 1 throws): signInSilently() → getTokens() → fresh          (AC10)
   else: throw AuthError('Session expired…')                                  (AC6)
```

The **testable seam** is (a) `authorizedFetch` (test via public Drive fns with mocked `global.fetch` + mocked `googleAuth`), and (b) `getFreshToken` (test with mocked `GoogleSignin`).

## Component design

### EDIT — `src/services/cloudBackup/googleAuth.ts`
Single responsibility: token acquisition. Add one exported function; leave `loadStoredAuth`/`signIn`/`signOut`/`getValidToken` unchanged.

```ts
/**
 * Force a fresh access token. Called after a Drive call returns 401.
 * Path 1: clear the stale cached token so the SDK mints a new one from its refresh token.
 * Path 2: if that fails, rehydrate the session with a silent sign-in.
 * Throws AuthError only when both fail (access genuinely revoked / no session).
 */
export async function getFreshToken(): Promise<string> {
    // Path 1 — clear cached access token, refetch.
    try {
        const current = await GoogleSignin.getTokens();
        await GoogleSignin.clearCachedAccessToken(current.accessToken);
        const refreshed = await GoogleSignin.getTokens();
        return refreshed.accessToken;
    } catch {
        // fall through to silent re-auth
    }
    // Path 2 — silent re-sign-in, then fetch.
    try {
        const res = await GoogleSignin.signInSilently();
        if (res.type !== 'success') throw new AuthError('Session expired. Please sign in again.');
        const tokens = await GoogleSignin.getTokens();
        return tokens.accessToken;
    } catch (e) {
        if (e instanceof AuthError) throw e;
        throw new AuthError('Session expired. Please sign in again.');
    }
}
```
Satisfies **AC1, AC5 (silent re-auth on cold start), AC10, AC6 (terminal), AC11 (no token logged — no logging here)**.

### EDIT — `src/services/cloudBackup/googleDrive.ts`
Add `import * as googleAuth from './googleAuth';`. Add internal (non-exported) `authorizedFetch`; route all four functions' `fetch` calls through it. `handleResponse` unchanged.

```ts
/**
 * Run an authorized Drive request. On HTTP 401, refresh the access token once
 * and retry the SAME request exactly once. Non-401 responses and network
 * failures are passed through untouched (no refresh, no wrongful sign-out).
 * `build` must construct the request fresh from the given token (used twice on retry).
 */
async function authorizedFetch(
    token: string,
    build: (token: string) => Promise<Response>,
): Promise<Response> {
    let response: Response;
    try {
        response = await build(token);
    } catch (e: any) {
        throw new NetworkError(e.message ?? 'Network request failed'); // AC8
    }
    if (response.status !== 401) return response; // AC7

    console.warn('drive: 401, refreshing access token'); // AC12 (no PII)
    let fresh: string;
    try {
        fresh = await googleAuth.getFreshToken();
    } catch {
        console.warn('drive: auth refresh failed, session terminal'); // AC12 (no PII)
        return response; // original 401 → handleResponse throws terminal AuthError (AC6)
    }
    try {
        return await build(fresh); // retry ONCE; a 2nd 401 propagates, no 3rd attempt (AC6/AC9)
    } catch (e: any) {
        throw new NetworkError(e.message ?? 'Network request failed');
    }
}
```

Each function's fetch is rewritten to use it, e.g.:
```ts
// listBackupFiles
const response = await authorizedFetch(token, (t) =>
    fetch(url, { headers: { Authorization: `Bearer ${t}` } }));
const data = await handleResponse(response);
```
```ts
// uploadBackup — body/boundary unchanged, header uses the (possibly refreshed) token `t`
const response = await authorizedFetch(token, (t) =>
    fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
    }));
```
```ts
// downloadBackup
const response = await authorizedFetch(token, (t) =>
    fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${t}` } }));
if (!response.ok) await handleResponse(response); // existing size/parse checks follow unchanged
```
```ts
// cleanupOldBackups — wrap each per-file DELETE (best-effort; still swallows errors)
const response = await authorizedFetch(token, (t) =>
    fetch(`${DRIVE_API}/files/${backup.fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }));
```
The pre-existing `try/catch`+`NetworkError` blocks in each function are removed (now owned by `authorizedFetch`); `cleanupOldBackups` keeps its outer `try {} catch {}` swallow. Satisfies **AC1–4, AC6–9, AC13/14/15**.

### EDIT — `src/services/cloudBackup/__tests__/backupService.test.ts`
No behavior change; add a clarifying comment on the existing `'on AuthError: signs the user out'` test that a propagated `AuthError` is now **post-retry / terminal**, so sign-out remains correct. Confirms **AC6** end-to-end at the orchestration layer.

### NEW — `src/services/cloudBackup/__tests__/googleDrive.test.ts`
Mock `global.fetch` and `jest.mock('../googleAuth')` (`getFreshToken`). Cases below.

### NEW — `src/services/cloudBackup/__tests__/googleAuth.test.ts`
Mock `@react-native-google-signin/google-signin` `GoogleSignin` (`getTokens`, `clearCachedAccessToken`, `signInSilently`, `getCurrentUser`). Cases below.

## Acceptance-criteria → design traceability

| AC | Satisfied by |
|----|--------------|
| 1 core refresh+retry success | `authorizedFetch` 401→`getFreshToken`→retry; Path 1 of `getFreshToken` |
| 2 state updates on success | unchanged `performBackup` success path (retry returns 200) |
| 3 restore 401 refresh | `downloadBackup` routes through `authorizedFetch` |
| 4 all four verbs share path | each Drive fn uses `authorizedFetch` (one helper) |
| 5 cold-start recovery | `getValidToken` (existing `signInSilently`) + `getFreshToken` Path 2 on first 401 |
| 6 retry at most once → terminal | `authorizedFetch` retries once; 2nd 401/refresh-fail → returns 401 → `AuthError` |
| 7 non-401 untouched | `if (response.status !== 401) return response` before any refresh |
| 8 network error transient | `build` throw → `NetworkError`, no refresh |
| 9 exactly-once, no dup backups | retry re-sends the single HTTP request; `performBackup` never re-invoked |
| 10 clear fails, silent succeeds | `getFreshToken` Path 1 catch → Path 2 |
| 11 no token/PII in logs | `getFreshToken` logs nothing; `authorizedFetch` logs fixed strings only |
| 12 non-PII breadcrumb, 2 outcomes | `'drive: 401, refreshing access token'` vs `'drive: auth refresh failed, session terminal'` |
| 13 no new scope/endpoint | only existing `drive.appdata`; SDK handles tokens |
| 14 pure TS, no native/build edits | edits confined to two `.ts` files under `src/services/cloudBackup/` |
| 15 no new dependency | `clearCachedAccessToken`/`signInSilently` present in installed 16.1.2 |

Every criterion is covered — no gaps, no undefined edge-case outcomes surfaced, so **no push-back to Story** was needed.

## Test plan

**Unit (automated) — `googleDrive.test.ts`** (mock `global.fetch`, mock `../googleAuth`):
- `listBackupFiles`: fetch → 401 then 200 ⇒ returns files; `getFreshToken` called once; `fetch` called twice; 2nd call's `Authorization` header uses the fresh token. (AC1, AC4)
- Double 401 (fetch returns 401 both times) ⇒ throws `AuthError`; `fetch` called **exactly twice**; `getFreshToken` once (no 3rd call). (AC6, AC9)
- `getFreshToken` rejects ⇒ original 401 surfaces as `AuthError`; `fetch` called once. (AC6)
- 403 `storageQuotaExceeded` ⇒ `QuotaError`; `getFreshToken` **not** called. (AC7)
- `fetch` rejects (network) ⇒ `NetworkError`; `getFreshToken` **not** called. (AC8)
- `downloadBackup` and `uploadBackup`: 401→retry→200 success. (AC3, AC4)

**Unit (automated) — `googleAuth.test.ts`** (mock `GoogleSignin`):
- Path 1: `getTokens`→`clearCachedAccessToken`→`getTokens` returns fresh accessToken; `clearCachedAccessToken` called with the *old* token string. (AC1)
- Path 1 throws (e.g. `clearCachedAccessToken` rejects) → `signInSilently` `success` → returns fresh. (AC10)
- Path 1 throws + `signInSilently` non-success → `AuthError`. (AC6)

**Unit (automated) — `backupService.test.ts`** (edit): existing terminal-`AuthError`→`setSignedOut` test remains green with clarified comment. (AC6 at orchestration)

**Manual QA (not a merge gate):**
- On-device: sign in, leave app idle >1h (or force token expiry), trigger a task change, confirm auto-backup completes and Settings still shows signed-in. (AC1, AC5)
- On-device: revoke app access at myaccount.google.com → next backup signs out cleanly. (AC6)
- Grep the diff to confirm no token/email in any log statement. (AC11)

**Rebuild scope:** pure-TS change → **hot reload** for dev; unit tests via `npm test`. No native/prebuild rebuild required (AC14).

## Design decisions & alternatives

- **`authorizedFetch` owns refresh internally (via direct `googleAuth` import)** rather than threading a refresh callback through the four public signatures + `backupService`. Chosen because no import cycle exists and it keeps callers + their tests untouched. Trade-off: `googleDrive` now depends on `googleAuth` (one-directional, fine).
- **Sequential calls in `performBackup` may each hit one 401→refresh on the expiry boundary** (list, then upload use the same stale first-attempt `token`). Accepted: after the first refresh the SDK cache is fresh, so each subsequent `getFreshToken` is cheap, and each request is still bounded to one retry (AC6 holds per-request; AC9 holds — no duplicate files). Optimizing to share the refreshed token across calls was rejected as premature for an ~hourly event.
- **Retry the single HTTP request, never re-run `performBackup`** — prevents duplicate "ongoing" backups (why A3 was rejected in Analyze). (AC9)
- **No proactive expiry tracking** — `expiresAt` stays `0`; SDK exposes no reliable expiry. (Story out-of-scope)
- **`getFreshToken` logs nothing; breadcrumbs live in `authorizedFetch` as fixed strings** — guarantees no token/PII leak. (AC11/12)
- **`getValidToken` left unchanged** — it supplies the first-attempt token; the 401 path handles staleness. Minimal surface.

## Handoff to Implement — build order

1. **`googleAuth.ts`** — add `getFreshToken()`. Then write **`googleAuth.test.ts`** (Path 1 / Path 2 / terminal) and make it green. *(pure SDK seam first, TDD)*
2. **`googleDrive.ts`** — add `authorizedFetch` + `import * as googleAuth`, route all four functions through it, drop their now-redundant `try/catch` NetworkError blocks. Then write **`googleDrive.test.ts`** (401-retry, double-401 exactly-once, non-401, network, per-verb) and make it green.
3. **`backupService.test.ts`** — add the clarifying comment; confirm the suite still passes.
4. **Verify:** `npm run check` (typecheck + lint + full test). No new dependency. No native/prebuild rebuild needed; on-device token-expiry smoke test is manual QA at Verify stage.
