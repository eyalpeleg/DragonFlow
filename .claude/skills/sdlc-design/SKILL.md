---
name: sdlc-design
description: Stage 5 of the feature SDLC flow (idea → brainstorm → analyze → story → design → implement → commit → verify). Produces the technical blueprint that satisfies every acceptance criterion in the story — data flow, component-by-component design with concrete APIs/signatures, a criteria→design traceability matrix, and a test plan — grounded in the repo's real patterns. Trigger after sdlc-story for a DragonFlow feature, or when the user says "design this", "tech design", "how do we build <feature>". Produces docs/design/features/<slug>/design.md. Specify precisely; still no production code (that's sdlc-implement).
---

# Technical design (SDLC Stage 5)

Input: `docs/design/features/<slug>/story.md` (numbered acceptance criteria) + `analysis.md` (chosen mechanism, change map).
Output: `docs/design/features/<slug>/design.md` — concrete enough to implement from directly.

Design turns the story's *what* into a precise *how*. It is specification, not prose: exact signatures, file paths, XML, data shapes. If a developer (or the implement skill) couldn't build it without guessing, it's not done.

## 1. Read the real patterns you'll mirror or edit

Before specifying anything, read the actual code you'll touch or imitate — the existing module you'll copy the shape of, the script you'll patch, the component you'll extend, the store action you'll call. Cite them. **Deeper reading here often refines an Analyze assumption** (e.g. "an existing module already captures intents this way, so no MainActivity patch is needed") — when it does, say so explicitly and record it as a design decision that supersedes the analysis.

## 2. State the approach + draw the data flow

- **Approach** — one paragraph: mechanism, platform, dependency stance, and any refinement of the analysis.
- **Data flow** — an ASCII/mermaid diagram from input source to persisted result, showing each hop (native → bridge → pure logic → UI → store). Mark where the *pure/testable* seam is.

## 3. Component-by-component design

For each file (mark NEW vs EDIT), specify precisely:
- Its single responsibility.
- The exact surface: function signatures / `@ReactMethod`s / props / TS interfaces / the literal XML or gradle snippet.
- Which acceptance criteria it satisfies (inline).
- Project-rule compliance: native/manifest edits go through `scripts/patch-native-config.js` / `copy-native-files.js` with idempotency guards — never generated `android/` (memory: prebuild resilience). Keep logic in pure, testable modules; keep native "dumb".

Prefer reusing an existing pattern over inventing one; match the surrounding code's idioms.

## 4. Traceability matrix — every criterion is covered

A table: acceptance criterion # → the component(s)/mechanism that satisfies it. Every story criterion must appear. A criterion with no design behind it is a gap to fix now, not in Implement.

**Feedback to Story (don't silently invent behavior).** Designing to the criteria often exposes an edge case whose *user-visible action* the story left undefined (e.g. "capped" — but capped how, and does the user know?). When that happens, **push it back to the story first**: update/add the acceptance criterion there (note it was surfaced during Design), then design to the now-complete criterion. Record the same refinement in your design decisions. Never resolve an undefined behavior by quietly picking one in the design — the story is the contract Verify checks, so the decision must live there too.

## 5. Test plan

Split **unit (automated)** vs **manual/native QA**, and tie each to criteria. Name the test file(s) and the concrete cases. This plan is the direct input to Implement (write these tests) and Verify (run this QA). Call out anything needing a full native rebuild vs a Metro reload.

## 6. Design decisions & alternatives

Briefly record the non-obvious choices and what you rejected (e.g. "native stays dumb, JS parses — so logic is unit-testable"; "getter for cold start + event for warm start — avoids double-delivery"). This is where a reviewer challenges the design.

## 7. Handoff to Implement — build order

An ordered file-by-file build sequence, ideally starting with the pure/testable core (TDD-friendly, no native needed) and ending with wiring + rebuild. Restate: any new dependency (should usually be none) and whether verification needs a native rebuild.

Show the approach, the data-flow diagram, and the traceability matrix to the user; confirm before implementing.

## design.md structure

```
# Design — <Feature>
## Approach                         (mechanism / platform / refinements of analysis)
## Data flow                        (diagram; mark the pure/testable seam)
## Component design                 (per file: NEW/EDIT, responsibility, exact API/signatures/XML, criteria satisfied)
## Acceptance-criteria → design traceability   (matrix — every criterion covered)
## Test plan                        (unit vs manual, tied to criteria + file names)
## Design decisions & alternatives
## Handoff to Implement             (ordered build sequence)
```

## Done when

- Every acceptance criterion appears in the traceability matrix with a concrete design behind it.
- Each file to add/edit has an exact, unambiguous spec (signatures/props/XML), honoring prebuild-resilience and testability rules.
- A test plan (unit + manual) is tied to criteria and file names.
- Any refinement of the analysis is recorded as a design decision.
- No production code written yet.

Hand off to the **sdlc-implement** skill next.
