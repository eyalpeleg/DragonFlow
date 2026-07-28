# Brainstorm — Fix Google auth expiration

## The idea in one line

Handle an expired Google auth token so Drive backup keeps working automatically, without forcing the user to sign in again.

## Value & prioritization

- **Who it's for** — Any user who has enabled Google Drive cloud backup. Job-to-be-done: "my data keeps backing up in the background; I never have to think about it."
- **Impact** — **High.** This is a silent data-loss risk. The whole point of cloud backup is that it survives an uninstall/device loss. If the token silently expires and the app signs the user out (`setSignedOut()`), backups stop, and the user isn't actively watching the Settings screen to notice. The next time they need the backup, it's stale or gone.
- **Effort** — **S.** Localized to `src/services/cloudBackup/` (auth + orchestration). No UI redesign, no data-model change, no native module change. The SDK already exposes the refresh mechanism.
- **Roadmap fit** — Directly hardens the shipped **Cloud sync** feature. Complements the planned **Backup sign-in prompt** idea (that prompts when signed *out*; this prevents getting wrongly signed out in the first place). No overlap with the Expo SDK upgrade.
- **Kill criteria** — Would drop if: (a) the bug can't reproduce because the SDK already auto-refreshes transparently (investigated — it does *not*; see mechanism below), or (b) the fix required a Firebase/`google-services` dependency (it does not — `clearCachedAccessToken` is built into the current SDK). Neither kill criterion is met. **Proceed.**

### Mechanism grounding (light recon, confirmed)

- On Android, `@react-native-google-signin/google-signin` caches the OAuth **access token** (~1 hour lifetime). `GoogleSignin.getTokens()` returns that cached token — it does **not** proactively check expiry, so it can hand back a token that Drive will reject with **HTTP 401**.
- `src/services/cloudBackup/googleDrive.ts` → `handleResponse()` maps a 401 to `AuthError('Authentication expired')`.
- Every caller in `backupService.ts` (`performBackup`, `performRestore`, `initializeBackup`) treats `AuthError` as terminal → `setSignedOut()`. So a merely-expired-but-refreshable token wrongly logs the user out.
- The SDK exposes **`GoogleSignin.clearCachedAccessToken(oldToken)`** — clears the stale cached access token so the next `getTokens()` mints a fresh one from the still-valid refresh token held by the native SDK. This is the intended remedy and needs no new dependency.

## Divergent approaches

### Dimension A — Where the refresh/retry lives

- **A1 — Retry inside `getValidToken()` (auth layer).** `getValidToken()` proactively/reactively clears the cached token and re-fetches. *Pro:* one choke point, all callers benefit, Drive layer stays dumb. *Con:* `getValidToken()` can't see the 401 (that happens later, in the Drive fetch), so this alone only helps at the *start* of an operation, not mid-flight.
- **A2 — Retry at the Drive-call layer (per request).** Wrap each Drive fetch so a 401 triggers `clearCachedAccessToken` + fresh token + one retry. *Pro:* catches the real failure point (mid-operation 401). *Con:* retry logic sprinkled across every Drive function unless centralized.
- **A3 — Retry at the orchestration layer (`backupService`).** On `AuthError`, refresh once and re-run the whole `performBackup`/`performRestore`. *Pro:* simple, few touch points. *Con:* re-runs the entire multi-file upload (wasteful, non-idempotent-ish — could create duplicate "ongoing" files), and still needs the auth layer to actually force a fresh token.

### Dimension B — Proactive vs reactive refresh

- **B1 — Reactive only.** Let the call fail with 401, then refresh + retry once. *Pro:* simplest; only refreshes when genuinely needed. *Con:* one wasted round-trip per expiry (~hourly at most).
- **B2 — Proactive only.** Track `expiresAt` and refresh before it lapses. *Con:* the SDK's `getTokens()` doesn't reliably expose real expiry (current code hardcodes `expiresAt: 0`); we'd be guessing. Brittle.
- **B3 — Hybrid.** Reactive 401→refresh→retry as the safety net, plus a cheap clear on a known-stale path. *Pro:* robust. *Con:* marginal added value over B1 given B1 already covers the real case.

### Dimension C — What "give up" means (terminal vs transient)

- **C1 — Only sign out on a *true* auth failure.** Distinguish "token refreshable" (transient — refresh & retry, stay signed in) from "refresh itself failed / user revoked access" (terminal — then `setSignedOut()`). *Pro:* stops the wrongful sign-outs, which is the actual bug.
- **C2 — Never auto sign out; surface an error banner instead.** *Con:* leaves a broken session lingering; worse UX when access truly is revoked.

### Wildcard — W1: Silent-refresh via `signInSilently()` fallback

If `clearCachedAccessToken` + `getTokens()` still fails, fall back to `signInSilently()` (which the code already uses on cold start) before declaring the session dead. Cheap belt-and-suspenders; no UI.

## Cross-cutting concerns

- **Retry-once discipline** — a refresh-and-retry loop must retry **exactly once** to avoid an infinite loop when access is genuinely revoked.
- **Don't create duplicate backups** — argues against A3 (re-running the whole `performBackup`); prefer refreshing the token and retrying the *single* failed HTTP call (A2).
- **Concurrent callers** — auto-backup debounce + a manual restore could both refresh at once; `clearCachedAccessToken` is idempotent so this is safe, but avoid stampede logging noise.
- **Platform** — Android is the only target; `clearCachedAccessToken` is Android/iOS-real (no-op on web, which we don't ship). Per the platform-separation rule, this is an Android-scoped change.
- **Existing test contract** — `backupService.test.ts` currently asserts "on AuthError: signs out and does NOT increment failures." If we make `AuthError` recoverable, that test's intent shifts to "on *terminal* AuthError (refresh failed) → sign out." Must update deliberately in Story/Design, not silently.
- **`initializeBackup` on cold start** — should attempt a refresh before deciding the user is signed out, so a launch after >1h doesn't nuke the session.

## Recommendation

- **A2** (retry at the Drive-call layer) — centralized via a small `authorizedFetch` helper so the 401→refresh→retry lives in one place, not copied per function.
- **B1** (reactive) — refresh on 401; skip fragile proactive expiry tracking.
- **C1** (only sign out on a genuinely terminal auth failure).
- **W1** — include `signInSilently()` as the final fallback inside the refresh path.

## Open questions (→ resolve in Analyze/Design)

1. Exact factoring: a new `authorizedFetch(url, init)` wrapper in `googleDrive.ts` vs. a `getFreshToken()` in `googleAuth.ts` that the wrapper calls. (Leaning: both — wrapper owns retry, auth layer owns the clear+refetch.)
2. How to signal "terminal vs transient" cleanly — a second error type, or a flag on `AuthError`.
3. Whether `initializeBackup` should also route through the new refresh path.

## ✅ Converged decisions (2026-07-28)

Decided autonomously per the user's "run the full flow" request; these are the recommended picks and are low-risk for a bugfix. Anything genuinely code-dependent is deferred to Analyze.

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| A — Where retry lives | **A2** — centralized `authorizedFetch` at the Drive layer | Catches the real mid-flight 401; one place, not per-function |
| B — Proactive vs reactive | **B1** — reactive 401→refresh→retry | SDK doesn't expose reliable expiry; refresh only when needed |
| C — Terminal vs transient | **C1** — sign out only on genuinely terminal auth failure | This *is* the bug — stop wrongful sign-outs |
| Wildcard | **W1** — `signInSilently()` as last-ditch fallback before giving up | Cheap, no UI, reuses existing cold-start path |

## Summary & Handoff to Analyze

**What we're building** — When a Drive API call fails because the cached Google access token expired, transparently clear the stale token, mint a fresh one from the SDK's refresh token, and retry the call **once** — keeping the user signed in and backups flowing. Only sign the user out when the refresh itself genuinely fails (access revoked / no valid session).

**Decisions taken**
- Retry lives in a centralized `authorizedFetch` helper at the Drive-call layer (A2).
- Reactive refresh on HTTP 401 (B1); no fragile proactive expiry tracking.
- Sign out only on a *terminal* auth failure; a refreshable expiry is transient (C1).
- Fallback chain: `clearCachedAccessToken` + `getTokens()` → `signInSilently()` → only then terminal (W1).

**Deferred to Analyze**
- Precise factoring of `authorizedFetch` vs a `getFreshToken()`/refresh helper in `googleAuth.ts`.
- How to represent terminal-vs-transient auth failure without breaking existing typed-error handling.
- Whether `initializeBackup` cold-start path should also route through refresh.
- Impact on `backupService.test.ts`'s existing AuthError assertion; new tests needed for the 401-retry path.

**Value verdict** — Impact **High** (silent data-loss prevention), Effort **S**, contained to `src/services/cloudBackup/`. **Priority: do it.**
