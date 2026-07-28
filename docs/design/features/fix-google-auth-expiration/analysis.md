# Analysis — Fix Google auth expiration

## Feasibility verdict

**Feasible, low-risk, no new dependency, no native change.** The remedy (`GoogleSignin.clearCachedAccessToken` + refetch, with `signInSilently()` fallback) is fully supported by the installed SDK. Contained to `src/services/cloudBackup/googleAuth.ts` + `googleDrive.ts`, with a test-contract touch-up in `backupService.test.ts`. **Effort: S.** Verifiable by unit tests + hot reload; no native rebuild required.

## Mechanism decision

Deferred question from Brainstorm: *how do we force a fresh token, where does retry live, and how do we tell transient from terminal?* Evidence:

| Option | Finding (evidence) | Verdict |
|--------|--------------------|---------|
| Force fresh token via `clearCachedAccessToken(old)` + `getTokens()` | API present in installed SDK `16.1.2` (`node_modules/@react-native-google-signin/google-signin/lib/typescript/src/signIn/GoogleSignin.d.ts:32`). Android caches the access token ~1h and `getTokens()` returns it without expiry check. | ✅ chosen — the core refresh primitive |
| `signInSilently()` fallback | Already used for cold-start rehydration (`googleAuth.ts:15`, `:66`). Returns `{type:'success'\|...}`. | ✅ chosen — last-ditch before terminal |
| Retry at Drive-call layer via `authorizedFetch` wrapper | Every Drive fn hand-rolls `fetch` + `handleResponse` (`googleDrive.ts:40,83,126,141`); 401→`AuthError` centralized in `handleResponse` (`:19`). A single wrapper owns the 401→refresh→retry-once path for all four calls. | ✅ chosen (A2) |
| Retry by re-running `performBackup` (A3) | `performBackup` uploads up to 3 files (`backupService.ts:68-83`); re-running risks duplicate "ongoing" backups. | ❌ ruled out — not idempotent |
| Proactive expiry tracking (B2) | `expiresAt` is hardcoded `0` everywhere (`googleAuth.ts:23,44`); SDK `getTokens()` exposes no reliable expiry. | ❌ ruled out — nothing trustworthy to track |
| Terminal vs transient signalling | Callers in `backupService.ts` (`performBackup:93`, `performRestore:135`, `initializeBackup:49`) treat any `AuthError` as terminal → `setSignedOut()`. If refresh+retry lives *below* them (inside `authorizedFetch`), only a **post-retry** `AuthError` ever reaches them — which genuinely is terminal. | ✅ No new error type needed; existing `AuthError` semantics become "terminal" for free |

## How it will work

1. **`googleAuth.ts` → new `getFreshToken(): Promise<string>`** — clears the currently cached access token (`getTokens()` → `clearCachedAccessToken(accessToken)`), then re-fetches. If that throws, fall back to `signInSilently()` and one more `getTokens()`. Throws `AuthError` if all fail. (`getValidToken()` stays as the "get a token for the first attempt" path.)
2. **`googleDrive.ts` → new internal `authorizedFetch(token, url, init, onRefresh)`** — runs the fetch; on **HTTP 401**, calls `onRefresh()` (→ `getFreshToken()`), swaps the `Authorization` header, and retries **exactly once**. A second 401 → `handleResponse` throws `AuthError` (terminal). All four Drive functions route their `fetch` through it.
3. **Token plumbing** — Drive functions currently receive a bare `token: string`. Cleanest is to let `authorizedFetch` obtain a refreshed token itself via a callback rather than thread a mutable token around. Exact signature is Design's call; behavior is fixed here.
4. **Callers unchanged in spirit** — `performBackup`/`performRestore`/`initializeBackup` keep treating a propagated `AuthError` as terminal (sign out), which is now correct because refresh already had its chance.

## Product depth

- **Discoverability & first-use** — invisible feature; success = *nothing changes for the user*. No new UI, no onboarding, no permission. The Settings backup status simply stays "signed in / last backup <recent>" instead of silently flipping to signed-out.
- **State coverage** —
  - *Expired-but-refreshable* (the bug): 401 → refresh → retry succeeds → backup completes, user stays signed in. **Primary case.**
  - *Access revoked / refresh token dead*: refresh fails → `signInSilently` fails → terminal `AuthError` → `setSignedOut()` (correct — user must re-consent).
  - *Offline / network drop*: `fetch` throws → `NetworkError` (unchanged), not treated as auth; counts toward `consecutiveFailures`, no wrongful sign-out.
  - *Non-401 Drive errors* (403 quota, 5xx): unchanged path.
- **Interactions with existing features** — touches Cloud sync only: auto-backup debounce (`setupAutoBackup`), on-background flush (`onAppBackground`), manual restore (`performRestore`), cold-start init (`initializeBackup`), and the `MAX_CONSECUTIVE_FAILURES` circuit-breaker. The fix reduces false failures, so the circuit-breaker trips less.
- **After the action** — no user-visible confirmation; the existing status/`lastBackupTime` UI in Settings reflects the successful backup as before.
- **Job-stories** —
  - *When my access token expires after an hour, I want the app to refresh it silently so my data keeps backing up without me re-signing-in.*
  - *When I actually revoked the app's Drive access, I want to be signed out cleanly so I'm prompted to reconnect rather than seeing silent failures.*

## Non-functional analysis

- **Security** — Fix keeps OAuth handling inside the native SDK; no token is logged or persisted beyond what the SDK already caches. Requirement: **never log the access token** (even at debug) in the new refresh/retry path.
- **Privacy** — No new data collected/sent. Refresh uses existing `drive.appdata` scope only. No change to persisted state shape.
- **Reliability & Error handling** — Requirement: retry **at most once** per request (no infinite loop when access is revoked); a second 401 must surface as terminal `AuthError`. `NetworkError` and non-401 errors must not trigger the refresh path. Concurrent callers refreshing simultaneously must be safe — `clearCachedAccessToken` is idempotent, acceptable.
- **Performance & Scale** — Adds at most one extra round-trip (clear+refetch) on the ~hourly expiry boundary; negligible. No cold-start regression — `initializeBackup` already awaits a token.
- **Compatibility & Platform** — Android-only target (per project rules); `clearCachedAccessToken`/`signInSilently` are real on Android. No web. No SDK/version bump.
- **Observability** — Requirement: emit a **non-PII** breadcrumb (e.g. `console.warn('drive auth refreshed after 401')` and `'...refresh failed, signing out'`) so a future support case can tell "refreshed" from "genuinely revoked". No token/email in the log line.
- **Maintainability & Footprint** — No new deps. Net new surface is one auth helper + one fetch wrapper; the wrapper *reduces* duplication across four Drive fns. Build-pipeline untouched (pure TS, no native/`android/` edits → no prebuild/copy-native concern).
- **Data integrity** — Must not create duplicate backups on retry → reason A3 was rejected; retry the single failed HTTP call only.

## Dependency & upgrade analysis

Considered bumping `@react-native-google-signin/google-signin`. **Not needed** — installed `16.1.2` already exposes `clearCachedAccessToken` and `signInSilently`. The separately-planned **Expo SDK 54→57** upgrade is unrelated and must not be coupled to this bugfix (high blast radius; it's already its own backlog enabler). **Decision: ship on the current stack. No side-way enabler story spawned.**

## Affected files / change map

| Area | File | Change |
|------|------|--------|
| Auth refresh primitive | `src/services/cloudBackup/googleAuth.ts` | **Edit** — add `getFreshToken()` (clear cached token → refetch → `signInSilently` fallback → throw `AuthError`) |
| Centralized fetch + 401 retry | `src/services/cloudBackup/googleDrive.ts` | **Edit** — add internal `authorizedFetch` wrapper; route `listBackupFiles`/`uploadBackup`/`cleanupOldBackups`/`downloadBackup` fetches through it |
| (maybe) token typing | `src/services/cloudBackup/types.ts` | **Edit (optional)** — only if Design adds a refresh-callback type |
| Tests — refresh/retry | `src/services/cloudBackup/__tests__/googleDrive.test.ts` | **NEW** — 401→refresh→retry-once success; double-401→terminal AuthError; non-401 untouched |
| Tests — auth helper | `src/services/cloudBackup/__tests__/googleAuth.test.ts` | **NEW** — `getFreshToken` clear+refetch happy path, `signInSilently` fallback, terminal throw |
| Tests — contract check | `src/services/cloudBackup/__tests__/backupService.test.ts` | **Edit** — keep/clarify "terminal AuthError → signs out"; ensure it reflects post-retry semantics |

No `android/`, `modules/dragonflow-native/`, or build-script edits → no prebuild/copy-native resilience concern.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Infinite refresh loop on genuinely revoked access | Med if uncareful | Hard cap: retry once per request; second 401 → terminal `AuthError` |
| `clearCachedAccessToken` needs the *old* token string; wrong arg → no-op | Med | Read current token via `getTokens()` before clearing; unit-test the arg passed |
| Refactoring token-threading breaks the 4 Drive calls | Low | Route all through one `authorizedFetch`; existing Drive tests (new) cover each verb |
| Existing `backupService` AuthError test misread as "no sign-out anymore" | Low | Test edited deliberately with a comment: terminal AuthError still signs out |
| Duplicate backups if retry re-runs whole op | Low (rejected A3) | Retry the single HTTP call only, never re-invoke `performBackup` |

## Effort estimate

**S** — ~1 auth helper + 1 fetch wrapper + wire 4 calls + 2 new test files + 1 test edit. Split: ~40% googleDrive wrapper, ~25% googleAuth helper, ~35% tests. **Verification: unit tests + hot reload; no native rebuild needed.** On-device smoke (let token age >1h, confirm backup continues) is a nice-to-have manual QA item, not a build blocker.

## Open questions → Story/Design

1. Exact `authorizedFetch` signature — does it take a `token` + `refresh` callback, or own token acquisition entirely? (Design decides; behavior is fixed.)
2. Should `initializeBackup` cold-start call `getFreshToken()` directly, or is the existing `getValidToken()` + first-call retry enough? (Lean: existing path is enough once retry exists.)
3. Log verbosity for the refresh breadcrumb — gate behind debug mode or always-on `console.warn`?

## Handoff to Story

Ship a **reactive token refresh**: when a Drive call returns HTTP 401, clear the stale cached access token, mint a fresh one (`getTokens()`, falling back to `signInSilently()`), and retry the request **once**; only sign the user out when that refresh genuinely fails. Mechanism confirmed on installed SDK `16.1.2` — no dependency bump, no native change, Android-scoped, effort **S**. Main risk is an unbounded retry loop — bounded by retry-once. **NFR findings that must become acceptance criteria:** (a) retry at most once per request; (b) non-401 / network errors must not trigger refresh or wrongful sign-out; (c) no token/PII in logs, but a non-PII breadcrumb distinguishing "refreshed" vs "signed out"; (d) no duplicate backups from retry. **Assumptions to confirm in Story/Design:** existing "terminal AuthError → sign out" behavior is retained (only its *timing* moves to post-retry); no UI change. **No side-way enabler story spawned.**
