---
name: sdlc-analyze
description: Stage 3 of the feature SDLC flow (idea → brainstorm → analyze → story → design → implement → commit → verify). Pressure-tests a brainstormed feature against the real codebase — resolve the deferred mechanism with evidence, then analyze it across product-depth and non-functional planes (security, privacy, scale, reliability, a11y, …), assess whether a dependency upgrade unlocks a better approach (possibly spawning a side-way enabler story), map affected files, list risks, estimate effort. Trigger after sdlc-brainstorm for a DragonFlow feature, or when the user says "analyze this feature", "is this feasible", "what are the NFRs", "let's scope <feature>". Produces docs/design/features/<slug>/analysis.md. This is where you READ code deeply; still no implementation.
---

# Analyze a feature (SDLC Stage 3)

Input: `docs/design/features/<slug>/brainstorm.md` — especially its "Summary & Handoff to Analyze" (decisions taken + deferred technical questions).
Output: `docs/design/features/<slug>/analysis.md` + a handoff to Story (and possibly a **side-way enabler story**).

Analyze is the **evidence + rigor** stage. Brainstorm decided *what*; Analyze proves *whether/how* and stress-tests the feature across product and non-functional planes. Read code, check versions, run `grep`/`npm view` — don't assume.

## 1. Ground deeply in the actual codebase

For each deferred question and decision, gather concrete evidence:

- **Find the reusable pattern.** Does the repo already do something shaped like this (native module, store action, hook)? Cite the file/symbol.
- **Verify dependencies for real.** Check installed versions and peer ranges (`npm view <pkg> peerDependencies`, read `package.json`/lockfile). A library that doesn't support the project's SDK is a finding, not a footnote.
- **Trace the data path** end to end — where input enters, how it reaches state, what renders. Note missing seams ("the modal has no prefill prop today").

## 2. Resolve the deferred mechanism with an evidence table

Option → finding → verdict (✅ chosen / ❌ ruled out + why). Decide here, backed by evidence — don't punt to Design.

## 3. Analyze product depth (beyond the happy path)

The brainstorm covered the main flow. Now dig into what makes it robust and real:

- **Discoverability & first-use** — how does the user find/enable it? Any permission, onboarding, or one-time hint?
- **State coverage** — empty, loading, error, success, and every edge input (blank, oversized, malformed, wrong type).
- **Interactions with existing features** — how it touches categories, recurrence, sub-tasks, notifications, the bubble, filters, backup.
- **After the action** — confirmation, undo, navigation, where the resulting data lands.
- **Job-stories** — the distinct real situations the feature serves ("when I ___ I want to ___ so I can ___").

## 4. Analyze non-functional requirements (NFR planes)

Go through these planes; **include the ones that materially apply**, each as *finding → requirement*. Don't pad; don't skip a plane that matters just because it's inconvenient.

- **Security** — untrusted/external input, injection, exported components / intent spoofing, permission surface. (Never execute or fetch untrusted content.)
- **Privacy** — could the data be sensitive? Where does it get persisted, logged, backed up, synced, or sent? Data minimization & consent.
- **Performance & Scale** — payload size, latency (esp. cold start), memory, frequency/bursts, effect on existing lists/state.
- **Reliability & Error handling** — null/empty/malformed inputs, native exceptions, races, idempotency, graceful degradation (never crash the host).
- **Accessibility** — screen reader, focus order, contrast, touch targets.
- **Compatibility & Platform** — OS version range, OEM variance, min SDK, and the project's platform-separation rule.
- **Observability & Analytics** — how do we measure success/adoption, and log safely (no PII/secret leakage)?
- **Internationalization** — non-ASCII, RTL, locale/number/date formats.
- **Maintainability & Footprint** — new deps, native surface, prebuild resilience, added test surface.
- **Data integrity & Offline** — local-first correctness, no data loss, migrations.

Add other planes when the feature demands them (e.g. battery, background execution, notifications policy). Each finding should become an acceptance criterion in Story or a design constraint in Design.

## 5. Dependency & upgrade analysis (may spawn a side-way story)

Don't accept the current stack as fixed. Ask: **would upgrading a dependency (or the SDK) enable a materially simpler/better/cross-platform approach?**

- Name the upgrade and what it would unlock (fewer native files, a maintained library, iOS support…).
- Weigh the **cost & blast radius** honestly — major-version jumps touch the whole app and need full native re-test; a one-feature benefit rarely justifies a risky global upgrade.
- **Decide:** ship on the current stack now, OR invest in the upgrade. If the upgrade is compelling but out of proportion for this feature, **recommend a separate "enabler" story** (spike/upgrade) via `add-idea`, note that the feature can be re-approached with the better mechanism afterward, and keep this feature on the low-blast-radius path for now. This "side-way story" keeps the main feature unblocked while capturing the better future.

## 6. Write analysis.md

```
# Analysis — <Feature>
## Feasibility verdict            (feasible? blockers? one-line effort size)
## Mechanism decision             (evidence table resolving the deferred choice)
## How it will work               (approach sketch — enough to map files; details are Design's job)
## Product depth                  (discoverability / states / feature interactions / after-action / job-stories)
## Non-functional analysis        (planes that apply, each finding → requirement)
## Dependency & upgrade analysis  (could an upgrade change the approach? decision → keep current OR side-way enabler story)
## Affected files / change map    (table: area → file → change; mark NEW files & prebuild-resilient edits)
## Risks & mitigations            (table: risk → likelihood → mitigation)
## Effort estimate                (T-shirt + rough split; note if a native rebuild is required to verify)
## Open questions → Story/Design
## Handoff to Story
```

Section rules:
- **Change map** must respect project rules: native/manifest edits go through `scripts/patch-native-config.js` / `copy-native-files.js`, never generated `android/` (memory: prebuild resilience). Flag new files vs edits.
- **Risks** surface project-specific traps (prebuild wipes, cold vs warm start, platform separation, oversized input) with a real mitigation each.
- **Effort** calls out whether verification needs a full native rebuild vs a Metro reload.

## 7. Hand off to Story

End with a **Handoff to Story** paragraph: chosen mechanism in one line, behavior to spec, effort, main risk, and the NFR findings that must become acceptance criteria. List assumptions Story/Design must confirm. If a side-way enabler story was created, name it.

**Show the feasibility verdict, mechanism decision, the top NFR findings, and any side-way story to the user, and confirm before moving on.**

## Done when

- Deferred mechanism resolved with cited evidence.
- Product-depth and the materially-relevant NFR planes analyzed, each with a concrete requirement.
- Dependency-upgrade path evaluated and decided (keep current or spawn a side-way story).
- `analysis.md` has a feasibility verdict, change map, risks, and effort.
- No production code written; findings grounded in real files/versions.

Hand off to the **sdlc-story** skill next.
