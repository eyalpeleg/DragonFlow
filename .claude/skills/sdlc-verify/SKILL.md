---
name: sdlc-verify
description: Stage 8 (final) of the feature SDLC flow (idea → brainstorm → analyze → story → design → implement → commit → verify). Checks the built feature against the story's acceptance criteria — runs the automated checks, maps every criterion to a verification method and status, and produces a manual on-device QA checklist for what code can't prove. Trigger after committing a DragonFlow feature, or when the user says "verify", "QA this", "check it against the criteria", "is it done". Produces docs/design/features/<slug>/verification.md. Verifies against the story; does not add features.
---

# Verify the feature (SDLC Stage 8)

Input: `docs/design/features/<slug>/story.md` (acceptance criteria) + `design.md` (test plan) + the implemented/committed code.
Output: `docs/design/features/<slug>/verification.md` — criteria coverage + a manual QA checklist + a verdict.

Verify closes the loop back to the **story**: the contract Verify checks is the numbered acceptance criteria, not the code's internal cleverness. Every criterion must get a verification method and an honest status.

## 1. Run the automated checks

- `npx tsc --noEmit`, `npx eslint app/ src/`, `npm test` — all must be green; report counts.
- For native/manifest work, **dry-run the patch scripts** and assert idempotency + correct injection (the same checks Implement used) — this is verification, so re-run and record the result.
- Confirm project-rule invariants: no unintended dependency added, prebuild-resilient edits, platform scope respected.

## 2. Map every acceptance criterion to a method + status

A table with a row per story criterion: criterion → verification method → status. Statuses:
- **✅ Verified** — proven by an automated test or a definitive code review.
- **📱 Pending** — needs on-device/manual QA (UI, share sheet, cold/warm start, logcat, icon).

Be honest: a criterion that only a device can prove is **Pending**, not Verified, even if the code looks right. Split hybrid criteria (e.g. "marker verified by unit test / log pending on logcat").

## 3. Write the manual QA checklist

For every **Pending** criterion, write a concrete, do-this-then-see-that step the user (or you, if a build is available) can execute after a rebuild. State the rebuild command and whether a full native rebuild is required (vs a Metro reload). Group by the real user action (e.g. "share from another app → …"). Include logcat/privacy checks where criteria demand them.

**Do not run heavy/native builds autonomously** — the user controls build/server startup. Produce the checklist and offer to run the build if they want it.

## 4. Record known limitations & verdict

- **Known limitations** — accepted v1 gaps (e.g. edge cases the story deferred), each pointing to where they're tracked.
- **Verdict** — one of: automated verification green + code-complete, DoD met for automated/review criteria, sign-off pending the manual checklist; or blocked with the specific failures. Never claim "done/verified" for criteria only a device can confirm — say exactly what remains.

## verification.md structure

```
# Verification — <Feature>
## Automated verification            (table: check → command → result)
## Acceptance-criteria coverage      (table: # → method → ✅ Verified / 📱 Pending)
## Manual QA checklist               (one actionable step per Pending criterion; rebuild command)
## Known limitations
## Verdict
```

## Done when

- All automated checks are run and reported (green, or failures surfaced).
- Every acceptance criterion has a method and an honest status.
- A concrete manual QA checklist exists for all Pending criteria.
- The verdict states plainly what's verified and what still needs on-device sign-off — no overclaiming.

This is the final stage. If manual QA later fails a criterion, loop back to the relevant stage (story/design/implement) rather than patching blindly.
