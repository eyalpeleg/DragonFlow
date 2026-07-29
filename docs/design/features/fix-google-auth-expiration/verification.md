# Verification — Fix Google auth expiration

## Automated verification

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ Pass (0 errors) |
| ESLint | `npx eslint app/ src/` | ✅ Pass (0 errors, 0 warnings) |
| Tests | `npm test` | ✅ Pass — **15 suites, 111 tests** (incl. new `googleAuth.test.ts` +3, `googleDrive.test.ts` +7) |
| No new dependency | `git diff HEAD -- package.json package-lock.json` | ✅ Empty — no dep change (AC15) |
| No native/build edits | commit `--name-only` vs `android/`,`modules/`,`scripts/`,`.gradle` | ✅ None present (AC14) |

## Acceptance-criteria coverage

| # | Criterion | Method | Status |
|---|-----------|--------|--------|
| 1 | 401 → refresh → retry succeeds, stays signed in | `googleDrive.test` (401→200 retry) + `googleAuth.test` Path 1 **+ on-device** (forced stale → backup completed, stayed signed in) | ✅ Verified (unit + device) |
| 2 | State (`lastBackupTime`/failures reset) updates on success | Code review + **on-device** ("Last backup" advanced to "Just now" after forced-401 backup) | ✅ Verified |
| 3 | 401 on manual restore refreshes | `googleDrive.test` `downloadBackup` 401→200 | ✅ Verified |
| 4 | All four verbs share the retry path | `googleDrive.test` (list/download/upload) + code review (cleanup uses same `authorizedFetch`) | ✅ Verified |
| 5 | Cold-start session recovery | **On-device** — force-stopped app, reopened, forced-401 backup completed & advanced "Last backup" | ✅ Verified (device) |
| 6 | Retry at most once → terminal AuthError | `googleDrive.test` double-401 (exactly 2 fetches / 1 refresh) + `backupService.test` terminal sign-out **+ on-device** (forced refresh-fail → single `401, refreshing` then `session terminal` → app signed out) | ✅ Verified (unit + device) |
| 7 | Non-401 error does not refresh | `googleDrive.test` 403 quota → `QuotaError`, `getFreshToken` not called | ✅ Verified |
| 8 | Network failure is transient, no sign-out | `googleDrive.test` fetch-throws → `NetworkError` **+ on-device** (airplane mode → stayed signed in, backup did not succeed, no refresh breadcrumb) | ✅ Verified (unit + device) |
| 9 | Exactly-once, no duplicate backups | `googleDrive.test` fetch called exactly twice; code review — retry re-sends single request, `performBackup` never re-invoked | ✅ Verified |
| 10 | Clear fails but silent sign-in succeeds | `googleAuth.test` Path 2 fallback | ✅ Verified |
| 11 | No token/PII in logs | Code review + **on-device logcat** — breadcrumb lines carried no token/email | ✅ Verified (code + device) |
| 12 | Non-PII breadcrumb, two distinct outcomes | **On-device logcat** — observed both `drive: 401, refreshing access token` (success path) and `drive: auth refresh failed, session terminal` (terminal path) | ✅ Verified (device) |
| 13 | No new scope/endpoint | Code review — only `drive.appdata`, no new URLs; tokens stay in SDK | ✅ Verified |
| 14 | Pure TS, no native/build edits | Commit stat — no `android/`/`modules/`/scripts | ✅ Verified |
| 15 | No new runtime dependency | No `package.json`/lockfile change | ✅ Verified |

**Summary: 15/15 ✅ Verified — all criteria proven by automated tests, code review, and/or on-device QA on a Pixel 8 Pro (Android 14).**

## On-device QA (executed 2026-07-29, Pixel 8 Pro, debug build)

Exercised via temporary `__DEV__`-only test triggers (a forced-stale-token hook and a forced-refresh-failure hook), since natural token expiry takes ~1h. Scaffolding was reverted after testing; the committed fix is unchanged.

| Test | Observed logcat | UI outcome | Criteria |
|------|-----------------|------------|----------|
| Force stale token + backup (warm) | `[DEV] returning intentionally stale token` → `drive: 401, refreshing access token` ×3 → (no terminal) | "Test Backup Done", stayed signed in | AC1, AC6, AC11, AC12 |
| Same after force-stop (cold start) | same 401-refresh sequence | "Last backup" 7 min ago → **Just now**; stayed signed in | AC1, AC2, AC5 |
| Back Up Now under airplane mode | (no drive/refresh breadcrumbs) | stayed signed in; "Last backup" unchanged (no false success) | AC8 |
| Force stale + force refresh-fail | `401, refreshing` **once** → `[DEV] forcing getFreshToken failure` → `drive: auth refresh failed, session terminal` | account row cleared → "Sign in with Google" (clean sign-out) | AC6 (terminal), AC12 |

## Pre-existing bugs found

Surfaced during on-device QA; **predates this feature** (not a failed criterion for this fix) and filed to the backlog for its own pipeline:

- **False "Backup Complete" alert.** `handleCloudBackup()` in `app/(tabs)/settings.tsx` shows "Backup Complete" even when the backup failed, because `performBackup()` swallows all errors internally and never throws (`backupService.ts` catches `NetworkError`/generic and only sets state). Confirmed on-device: tapping "Back Up Now" while in airplane mode still showed "Backup Complete" though `lastBackupTime` did not advance. Filed as `Fix false "Backup Complete" alert` (Idea) in `docs/design/features.md`. Fix direction: have `performBackup` return/throw a status, or gate the alert on `backupStatus`/`lastError`.
- **"Last backup: Never" after re-sign-in.** After a sign-out→sign-in cycle, Settings shows "Last backup: Never" even though backups exist in Drive. `backupStore.setSignedOut()` wipes `lastBackupTime`/`lastBackupFileId`, and `setSignedIn()` never restores them (sign-in doesn't query Drive for the newest backup). Confirmed on-device after re-signing in following the terminal test. Filed as `Fix "Last backup: Never" after re-sign-in` (Idea) in `docs/design/features.md`. Fix direction: hydrate `lastBackupTime` from the newest `listBackupFiles()` entry on sign-in, or don't wipe it on sign-out. Files: `src/services/cloudBackup/backupStore.ts`, `backupService.ts`.

## Manual QA checklist — ✅ EXECUTED (2026-07-29, Pixel 8 Pro debug build)

All items below were run on-device (see "On-device QA" table above). Results:

1. **AC1 — token-expiry refresh (primary).** ✅ Forced-stale-token backup completed; `drive: 401, refreshing access token` in logcat; stayed signed in.
2. **AC5 — cold-start recovery.** ✅ Force-stopped, reopened, forced-401 backup completed and "Last backup" advanced to "Just now".
3. **AC6 — genuine revocation / terminal.** ✅ Simulated via forced refresh-failure (deterministic equivalent of revocation): single `401, refreshing` → `drive: auth refresh failed, session terminal` → app signed out of backup cleanly, no loop. *(A real myaccount.google.com revocation would follow the identical code path; not separately re-run.)*
4. **AC8 — offline.** ✅ Airplane mode → stayed signed in; backup did not falsely succeed (`lastBackupTime` unchanged); no refresh breadcrumb.
5. **AC11/AC12 — log privacy.** ✅ Only the two fixed breadcrumb strings appeared; no token/id-token/email in any log line.

**Follow-up for the user:** the terminal test left the app *signed out of Drive backup* — re-tap **Settings → Sign in with Google** to restore backup.

## Known limitations

- **On-device facets** (cold-start, real SDK) can't be proven in Jest — closed by the on-device QA above.
- **Sequential-call double-refresh** (accepted in Design): on the expiry boundary, `performBackup`'s successive Drive calls may each hit one 401→refresh since they share the stale first-attempt token. Bounded to one retry per request and creates no duplicate files; optimizing to share the refreshed token was deferred as premature.
- **Proactive expiry refresh** intentionally out of scope v1 (SDK exposes no reliable expiry) — tracked in `story.md` Scope.

## Verdict

**Verified.** Automated verification is green (typecheck + lint + 111 tests) and the code is committed locally (`fix/google-auth-expiration`, commit `739ef42`). **All 15 acceptance criteria are Verified** — by unit tests, code review, and on-device QA on a Pixel 8 Pro (Android 14) covering the happy-path refresh, cold-start recovery, offline transient handling, and the terminal sign-out path, with breadcrumbs confirmed PII-free in logcat. One **pre-existing** bug (false "Backup Complete" alert) was found and filed to the backlog; it is out of scope for this fix. **Status: Verified.** Remaining before Shipped: push the branch and release; user to re-sign-in to Drive backup (left signed out by the terminal test).
