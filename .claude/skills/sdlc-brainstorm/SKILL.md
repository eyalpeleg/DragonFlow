---
name: sdlc-brainstorm
description: Stage 2 of the feature SDLC flow (idea → brainstorm → analyze → story → design → implement → commit → verify). Explore a rough FEATURE idea for this app before committing to it — assess its value, diverge on product/UX approaches, converge with the user on the shaping decisions, and end with a summary that becomes the input to Analyze. Trigger when the user wants to develop a feature idea for DragonFlow: "brainstorm this feature", "let's think through <app idea>", or when picking an idea from docs/design/features.md to advance. NOT for general/unrelated brainstorming. Produces docs/design/features/<slug>/brainstorm.md. Do NOT write code or pick an implementation here — that's sdlc-analyze / sdlc-design.
---

# Brainstorm a feature idea (SDLC Stage 2)

Input: a one-line feature idea (often from the Planned table in `docs/design/features.md`).
Output: `docs/design/features/<feature-slug>/brainstorm.md` ending in a summary handed to Analyze.

Pick a short kebab-case `<feature-slug>` and reuse it for every later stage's artifact.

## 1. Ground yourself lightly (not deeply)

Brainstorm is about *product/UX shape*, not implementation. Do just enough codebase reconnaissance to make the options realistic — how the relevant area is built today, what store action / component you'd reuse, whether a dependency already exists. A few `grep`s, not a full audit. Deep feasibility is Stage 3 (`sdlc-analyze`).

## 2. Assess value & priority — decide if it's worth continuing

Before generating options, judge whether the idea earns the next stages. Write a **Value & Prioritization** block:

- **Who it's for** — which user/persona and the job-to-be-done.
- **Impact** — what it improves and how much. Rate **High / Medium / Low**.
- **Effort** — rough T-shirt size (**S / M / L / XL**), first instinct only.
- **Roadmap fit** — how it relates to shipped features and other Planned ideas; does it unblock or overlap anything?
- **Kill criteria** — the conditions under which we should *not* build this (too costly, low impact, duplicates existing behavior, violates a project constraint). If any are already met, say so plainly and recommend dropping/deferring rather than pushing forward.

If the idea survives, continue. If not, stop here and tell the user why.

## 3. Diverge — write the approaches

In `brainstorm.md`, group the real choices into labelled **dimensions** (A/B/C…), each with 2-3 concrete options and their trade-offs. Cover behavior/UX, data mapping, scope/platform, and (lightly) mechanism. Give each option a stable id (A1, A2…) to reference later. Include at least one **non-obvious / wildcard** option where it's warranted. Then add:

- **Cross-cutting concerns** — edge cases and project gotchas (platform-separation rule, prebuild-resilient native edits, cold vs warm start, empty/oversized input…).
- **Recommendation** — your default pick per dimension, one line of reasoning each.

Respect project constraints from CLAUDE.md and memory (Android-focused, "keep it simple / no over-engineering", platform separation).

## 4. Converge — decide with the user

List the **open questions**, then ask with `AskUserQuestion` — one question per genuine decision, options mirroring your A1/B2… ids, recommended option first and marked "(Recommended)". Let low-stakes or code-dependent choices be **deferred to Analyze** rather than forced now. Record answers in a **"✅ Converged decisions"** table (dated).

## 5. Summarize & hand off (required final step)

End the brainstorm by writing a **"Summary & Handoff to Analyze"** section at the bottom of `brainstorm.md`, then **show that same summary to the user in chat**. It must contain:

- **What we're building** — 1-2 sentences reflecting the converged decisions.
- **Decisions taken** — the bulleted choices (from the table).
- **Deferred to Analyze** — open technical questions/risks Stage 3 must size (e.g. dependency compatibility, native handling).
- **Value verdict** — impact/effort/priority in one line.

This summary is the explicit input to the `sdlc-analyze` skill. Confirm with the user before handing off.

## brainstorm.md structure

```
# Brainstorm — <Feature>
## The idea in one line
## Value & prioritization        (who / impact / effort / roadmap fit / kill criteria)
## Divergent approaches          (dimensions A/B/C… with option ids)
## Cross-cutting concerns
## Recommendation
## Open questions
## ✅ Converged decisions          (dated table)
## Summary & Handoff to Analyze   (the input to Stage 3)
```

## Done when

- `brainstorm.md` has a value/priority assessment, divergent options, a converged-decisions table, and a Summary & Handoff section.
- The summary has been shown to the user and confirmed.
- No implementation was chosen or code written.

Hand off to the **sdlc-analyze** skill next.
