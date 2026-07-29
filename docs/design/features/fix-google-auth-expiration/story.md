# Story — Fix Google auth expiration

## User story

> **As a** DragonFlow user who enabled Google Drive backup and left the app running (or reopened it) more than an hour after signing in, **I want** the app to refresh my expired Google access token silently and keep backing up, **so that** I never lose data or get unexpectedly signed out just because a token aged out.

## Job-stories

- **When** my access token expires after ~an hour of use, **I want** the app to refresh it silently and continue the backup, **so I can** trust that my data is safe without re-signing-in.
- **When** I reopen the app days later, **I want** the cold-start backup init to recover my session, **so I** stay signed in instead of being kicked out.
- **When** I have actually revoked the app's Drive access in my Google account, **I want** the app to sign me out cleanly, **so I'm** prompted to reconnect rather than seeing silent, endless failures.
- **When** I'm offline or Drive is temporarily down, **I want** the app to treat that as a transient network hiccup (not an auth problem), **so I'm** not wrongly signed out.

## Scope

**In scope (v1)**
- Reactive token refresh on **HTTP 401** from any Google Drive API call, followed by a single retry of that same call.
- A refresh primitive that clears the stale cached access token, refetches, and falls back to `signInSilently()` before giving up.
- Correct terminal-vs-transient handling: sign out **only** when refresh genuinely fails.
- Unit test coverage for the refresh + retry paths.

**Out of scope (v1)**
- Proactive expiry tracking / countdown refresh (ruled out in Analyze — SDK exposes no reliable expiry).
- Any UI change (no new banners, prompts, or settings). The existing Settings backup status is untouched.
- The "Backup sign-in prompt on startup" idea (separate backlog item, `features.md`).
- iOS behavior beyond what the shared SDK provides (project is Android-scoped).

## Related & spawned stories

| Story | Relationship | Why | Tracked | Proceeds independently? |
|-------|-------------|-----|---------|------------------------|
| Backup sign-in prompt on startup | **Follow-up** | Prompts when signed *out*; this story prevents wrongful sign-out in the first place. Complementary. | `features.md` (Idea) | Yes — independent |
| Upgrade Expo SDK 54→57 | **Enables** (unrelated) | Broad enabler; not needed for this fix. Must not be coupled. | `features.md` (Idea) | Yes — this ships on current stack |

No **Blocks**-type dependency. This feature ships independently; Definition of Done carries no external-story gate.

## Acceptance criteria

### Core flow
1. **Given** a signed-in user whose cached access token has expired, **when** an auto-backup runs and Drive returns 401, **then** the app clears the stale token, obtains a fresh one, retries the request once, the backup completes, and the user **remains signed in**.
2. **Given** the refresh succeeds, **when** the retried request completes, **then** `lastBackupTime`/`lastBackupFileId` update as on a normal successful backup and `consecutiveFailures` is reset to 0.

### Variations
3. **Given** a 401 on a **manual restore** (`performRestore`), **when** refresh succeeds, **then** the retried download completes and the restore proceeds — same refresh path as backup.
4. **Given** a 401 on **any** of the four Drive operations (list, upload, delete/cleanup, download), **when** it occurs, **then** the same refresh-and-retry-once behavior applies (the retry path is shared, not per-verb duplicated).
5. **Given** cold-start `initializeBackup` after a long gap, **when** the stored session's token is stale, **then** the session is recovered (refreshed) rather than signed out, provided the refresh token is still valid.

### Robustness (from NFR findings)
6. **Given** a request that 401s, **when** the refresh + retry **also** returns 401, **then** the app performs **no further retries** (retry at most once), a terminal `AuthError` propagates, and the user is signed out.
7. **Given** a **non-401** Drive error (e.g. 403 quota, 5xx), **when** it occurs, **then** the refresh path is **not** triggered and existing error handling (`QuotaError`/generic error → `consecutiveFailures++`) is unchanged.
8. **Given** a **network failure** (fetch throws), **when** it occurs, **then** it is treated as `NetworkError` (transient), the user is **not** signed out, and no refresh is attempted.
9. **Given** a retry occurs, **then** at most **one extra** Drive request is made for that operation and **no duplicate backup files** are created (retry re-sends the single failed HTTP call, never re-runs the whole multi-file `performBackup`).
10. **Given** the refresh primitive runs, **when** `clearCachedAccessToken` fails but `signInSilently()` succeeds, **then** a fresh token is still obtained and the retry proceeds.

### Privacy & security
11. **Given** any refresh or retry, **then** **no access token, id token, refresh token, or user email** is written to logs at any level.
12. **Given** a refresh happens, **then** a **non-PII breadcrumb** is logged distinguishing the two outcomes — e.g. "drive auth refreshed after 401" vs "drive auth refresh failed — signing out" — carrying no token/email/payload.
13. The change introduces **no new scopes** (stays `drive.appdata`) and **no new network endpoints**; all token handling remains inside the native Google SDK.

### Platform
14. The change is **pure TypeScript** under `src/services/cloudBackup/`; **no** `android/`, `modules/dragonflow-native/`, or build-script edits — so no prebuild/copy-native resilience concern.
15. **No new runtime dependency** is added; the fix uses APIs already present in the installed `@react-native-google-signin/google-signin` `16.1.2`.

## Definition of Done

- [ ] AC 1–10 covered by **automated unit tests** (new `googleDrive.test.ts`, `googleAuth.test.ts`; updated `backupService.test.ts` for terminal-AuthError semantics).
- [ ] AC 11–13 verified by **test + code review** (assert log calls carry no token; grep for token in log statements).
- [ ] AC 6 (retry-at-most-once) has an explicit test asserting exactly two Drive calls occur on double-401 and no third.
- [ ] AC 5 (cold-start recovery) covered by a `backupService`/`googleAuth` test or documented as **manual QA** if not unit-reachable.
- [ ] AC 14–15 confirmed (no native/build/dep changes) — diff review.
- [ ] `npm run check` (typecheck + lint + test) is green.
- [ ] No **Blocks** dependency outstanding (none exists).
- [ ] **Manual QA (nice-to-have, not a merge gate):** on-device, let a session age past token expiry (or revoke access in Google account) and confirm (a) backup continues after expiry, (b) genuine revocation signs out cleanly.

## Handoff to Design

Design must specify: (1) the **`getFreshToken()`** signature and body in `googleAuth.ts` — order of `getTokens` → `clearCachedAccessToken` → refetch → `signInSilently` fallback → terminal `AuthError`; (2) the **`authorizedFetch`** wrapper in `googleDrive.ts` — its signature (token vs refresh-callback), how it detects 401, swaps the auth header, and enforces **retry-at-most-once** (the criterion behind AC 6 & 9); (3) how all four Drive functions route through it without duplicating retry logic; (4) the exact **log lines** satisfying AC 11–12 (no PII, two distinguishable outcomes); (5) the **test plan** mapping each AC to a specific test, including the double-401 exactly-once assertion and the non-401/network negative cases. The trickiest criterion, **AC 6/9 (exactly-once, no duplicate backups)**, maps to the design decision to retry the single HTTP request inside `authorizedFetch` rather than re-invoking orchestration.
