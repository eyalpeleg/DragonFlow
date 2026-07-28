---
name: sdlc-story
description: Stage 4 of the feature SDLC flow (idea → brainstorm → analyze → story → design → implement → commit → verify). Turns the analysis into a user-facing story with testable acceptance criteria — the contract Design builds to and Verify checks against. Folds the NFR findings from Analyze into concrete Given/When/Then criteria, sets scope (in/out), and defines "done". Trigger after sdlc-analyze for a DragonFlow feature, or when the user says "write the story", "acceptance criteria", "define done for <feature>". Produces docs/design/features/<slug>/story.md. Still no code or technical design — that's sdlc-design.
---

# Write the story (SDLC Stage 4)

Input: `docs/design/features/<slug>/analysis.md` — its "Handoff to Story" plus the product-depth and NFR findings.
Output: `docs/design/features/<slug>/story.md` — the testable contract for the feature.

The story is written from the **user's perspective** and is **verifiable**. Every acceptance criterion must be checkable by a test or a concrete manual QA step; if you can't check it, rewrite it. This is where the analysis's findings become obligations.

## 1. State the user story

Classic form, but make it specific and honest:

> **As a** <specific user in a real situation>, **I want to** <capability>, **so that** <the outcome/why>.

Add 2-4 **job-stories** ("When I ___, I want to ___, so I can ___") capturing the distinct real situations from the analysis. These keep the criteria grounded in reality.

## 2. Set scope explicitly

- **In scope (v1)** — the behavior this story delivers.
- **Out of scope (v1)** — what's deliberately excluded, with a pointer to where it's tracked. Explicit non-goals prevent scope creep in Design/Implement. Excluded work that has a *spawned story* goes in the Related section (below), not buried here.

## 3. Capture related & spawned stories (first-class, not a footnote)

Analyze may spawn **side-way / enabler stories** (e.g. a dependency or SDK upgrade that would enable a better approach). A side-way story is **its own story with its own pipeline** — it is NOT designed or built as part of this feature. The Story stage's job is to name it and pin down the relationship, so the linkage isn't lost.

Write a **"Related & spawned stories"** section. For each, give a **typed relationship**:

- **Blocks** — must be completed before this feature (or a specific version of it) can ship.
- **Enables** — unlocks a future capability/version but does not block v1.
- **Alternative** — offers a different implementation path; if it lands, this feature's mechanism would be reconsidered (in that story's Design, not here).
- **Follow-up** — desirable work that naturally comes after this feature.

For each, record: the relationship type, a one-line why, where it's tracked (Planned row link, and its own `docs/design/features/<slug>/` folder if/when started), and — critically — **an explicit statement of whether this feature proceeds independently of it**. If any related story is a *Blocks*, the Definition of Done must reflect that dependency.

The enabler itself runs its own Idea→…→Verify pipeline later when prioritized; do not stub its design here.

## 4. Write acceptance criteria as Given/When/Then

Group them so they're easy to verify. Cover:

- **Core flow** — the main happy path, step by step.
- **Variations** — the different inputs/situations from product depth (e.g. each text→field mapping case).
- **Defaults & integration** — how the feature meets existing features (defaults, editing, related state).
- **Robustness** — turn each relevant NFR finding into a criterion: empty/oversized/malformed input, exactly-once/idempotency, graceful failure (never crash the host). For every edge case, specify the **user-visible action/outcome**, not just that it's detected — e.g. not "oversized text is capped" but "the description is truncated with a visible `[TRIMMED]` marker so the user knows, and a length-only log line is written." An edge case with an undefined outcome is an incomplete criterion; if a later stage (Design/Implement) surfaces one, fix it here first, then let that stage follow.
- **Privacy & security** — no logging of sensitive payloads, never execute/fetch untrusted content, no widened attack surface.
- **Platform** — platform-separation obligations (e.g. Android-only; no iOS files touched).

Each criterion should be atomic and independently checkable. Number them so Design and Verify can reference them.

## 5. Define "Done"

A short checklist: all acceptance criteria pass (name which are unit tests vs manual QA), project rules honored (prebuild resilience, no unwanted deps), any *Blocks*-type related story satisfied, and `npm run check` green.

## 6. Hand off to Design

End with a **Handoff to Design** paragraph naming exactly what Design must specify to satisfy the criteria (the seams identified in Analyze: native surface, parsing rules, component props, wiring). Map the trickiest criteria (e.g. exactly-once delivery) to the design decision that will satisfy them.

Show the user story + the acceptance-criteria list and confirm before moving on.

## story.md structure

```
# Story — <Feature>
## User story
## Job-stories
## Scope                       (in / out, with pointers for out-of-scope)
## Related & spawned stories   (typed relationship: Blocks/Enables/Alternative/Follow-up + independence statement)
## Acceptance criteria         (numbered Given/When/Then, grouped: core / variations / defaults / robustness / privacy+security / platform)
## Definition of Done
## Handoff to Design
```

## Done when

- A specific user story + job-stories are written.
- Scope in/out is explicit.
- Every side-way/enabler story spawned in Analyze is captured with a typed relationship and an explicit independence statement (a *Blocks* is reflected in Definition of Done).
- Acceptance criteria are numbered, atomic, and each maps to a test or manual QA step — including criteria derived from every material NFR finding.
- "Done" is defined and the handoff names what Design must specify.
- No technical design or code yet.

Hand off to the **sdlc-design** skill next.
