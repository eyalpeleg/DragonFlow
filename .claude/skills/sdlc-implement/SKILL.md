---
name: sdlc-implement
description: Stage 6 of the feature SDLC flow (idea → brainstorm → analyze → story → design → implement → commit → verify). Builds the feature by following the design's ordered build plan — pure testable core first (with tests), then native, then wiring — matching the repo's conventions, keeping native edits prebuild-resilient, and verifying continuously (typecheck, lint, unit tests, script idempotency). Trigger after sdlc-design for a DragonFlow feature, or when the user says "implement", "build it", "write the code". Writes production code + tests; hands off to precommit.
---

# Implement the feature (SDLC Stage 6)

Input: `docs/design/features/<slug>/design.md` — the component specs, traceability matrix, test plan, and **Handoff to Implement (build order)**.
Output: production code + tests that satisfy every acceptance criterion; a green `npm run check`.

Build exactly what the design specifies. If you find yourself inventing behavior the design didn't cover, that's a design/story gap — resolve it upstream (update the story/design), don't wing it.

## 1. Follow the design's build order

Typically: **pure/testable core first**, then native, then UI wiring. Starting with the pure logic lets you TDD it with no native build in the loop, and everything downstream builds on a verified core.

## 2. Match the repo, don't reinvent

- Mirror the existing pattern the design cited (module shape, bridge shape, script-patch style). Read it, copy its idioms, comment density, and naming.
- Keep new pure logic in a **side-effect-free module** with co-located tests in `__tests__/`; keep native code "dumb" (shuttle data, no business logic).
- Reuse existing store actions / components; add minimal, additive props (don't break existing call sites).

## 3. Honor the native / prebuild rules (non-negotiable)

- Native source lives in `modules/dragonflow-native/`; **never** hand-edit generated `android/` as the source of truth.
- Manifest/registration/gradle changes go through `scripts/patch-native-config.js` / `scripts/copy-native-files.js`, with **idempotency guards** (`if (!content.includes(...))`) so repeated prebuilds don't double-inject.
- Add new native files to the `copy-native-files.js` copy list and register packages in both patch paths.
- After editing `modules/dragonflow-native/`, re-run the copy script before any gradle build (memory: native-copy-after-edit).

## 4. Write the tests from the design's test plan

Implement the unit cases the design enumerated, each tied to an acceptance criterion (map the criterion # in a comment or test name). Cover the edge cases the story pinned (empty/oversized/malformed, exactly-once, mapping variants). The pure core should be exhaustively tested; native/UI get manual QA in Verify.

## 5. Verify continuously (everything short of a device build)

Run as you go, and again at the end:
- `npx tsc --noEmit` — clean.
- `npx eslint <changed files>` — no errors.
- `npm test` — full suite green (new + existing; don't regress).
- **Dry-run the patch scripts** against generated `android/` and assert idempotency (e.g. re-run twice, grep that the injected block appears exactly once). This catches broken regex without a full gradle build.
- Inspect the resulting generated file (manifest/MainApplication) to confirm the injection landed in the right place.

A full native rebuild + on-device QA is the **Verify** stage's job; note it rather than skipping it.

## 6. Track criteria coverage

Every acceptance criterion should now have code behind it. Keep the design's traceability honest — if a criterion has no implementation, it's not done. Note which criteria remain **manual-QA-only** (need the device) so Verify knows what to exercise.

## 7. Hand off to Commit

Summarize what was built (files added/edited), the automated-verification results (typecheck/lint/tests/idempotency), and what still needs a native rebuild + device QA. Then invoke **precommit** before committing.

## Done when

- The design's build order is fully implemented, matching repo conventions.
- Native edits are prebuild-resilient and idempotent; new files are in the copy list and registered.
- Unit tests from the design's test plan pass; `tsc`, `eslint`, and the full `npm test` are green.
- Every criterion has code (or is explicitly flagged manual-QA-only for Verify).

Hand off to **precommit** (Stage 7), then the **sdlc-verify** skill (Stage 8).
