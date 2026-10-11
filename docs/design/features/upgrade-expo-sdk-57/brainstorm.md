# Brainstorm — Upgrade Expo SDK 54 → 57

## The idea in one line
Incrementally upgrade the app from Expo SDK 54 to SDK 57 (RN 0.81 → 0.86, React 19.1 → 19.2), one SDK major at a time, as an **enabler** that unlocks `expo-share-intent` (SDK 55+) and keeps the app current on React Native + security patches.

## Value & prioritization
- **Who it's for** — the developer (maintainability) and, indirectly, users (iOS share target, RN fixes, security). No direct end-user UI change ships with the upgrade itself.
- **Impact** — **Medium/High.** Unblocks two backlog items (expo-share-intent migration, iOS share target), keeps the app on a supported SDK, pulls in RN 0.86 rendering/layout fixes and security patches. High *strategic* value, low *visible* value.
- **Effort** — **L.** Three sequential SDK majors, each with its own dependency bumps, prebuild, native-module re-verification, and build. High blast radius because of the custom native module + `copy-native-files` pipeline.
- **Roadmap fit** — Enabler spawned by the Share-text analysis. Directly unblocks: *expo-share-intent migration* and *iOS floating bubble / iOS share target*. Overlaps nothing already shipped; touches everything at build level.
- **Kill criteria** — Would drop/defer if: (a) a critical dependency (Google Sign-In, expo-notifications, the custom native module) has no SDK-57-compatible version; (b) RN 0.86 breaks the FloatingBubble overlay or boot receiver with no fix. → **None met at brainstorm time.** All Expo-managed deps here are first-party and track the SDK; the custom native module is our own code we can patch. Proceed.

## Divergent approaches

### Dimension A — Upgrade path *(decided at pick-idea gate)*
- **A1 — Incremental to 57 (54→55→56→57), commit+verify each hop.** ✅ chosen. Follows Expo's explicit guidance; each hop is independently verifiable and revertible.
- A2 — Incremental, stop at 55. Smaller, unlocks share-intent, defers 56/57. *Not chosen — user wants to land on 57.*
- A3 — Big-bang 54→57. Against Expo guidance; compounding hard-to-trace bugs. *Rejected.*

### Dimension B — Scope of *this* feature
- **B1 — Pure upgrade, no behavior change.** Land on SDK 57 with the app building and all existing behavior intact. The `expo-share-intent` migration and iOS share target are **separate spawned stories** this upgrade unlocks. *(Recommended.)*
- B2 — Upgrade **+** migrate share to `expo-share-intent` in the same effort. Fewer round-trips, but couples a risky rewrite to a risky upgrade and violates one-feature-at-a-time. *Not recommended.*
- B3 — Upgrade + broader modernization (drop other custom natives, adopt new Expo APIs). Scope creep. *Rejected.*

### Dimension C — Custom native module strategy
- **C1 — Keep the custom native module as-is; make it survive each hop.** Re-verify FloatingBubble/Boot/Sound/Parking/ShareIntent Kotlin against each RN version; fix via `modules/dragonflow-native/` + `copy-native-files.js` only. *(Recommended — matches prebuild-resilience rule.)*
- C2 — Opportunistically replace custom natives with Expo equivalents during the upgrade. Couples migrations to the upgrade. *Rejected (see B2).*

### Dimension D — Commit / verification granularity *(decided at pick-idea gate)*
- **D1 — One commit per SDK hop**, each behind the 🛑 commit gate, each preceded by typecheck+lint+test (and prebuild where native changed). ✅ chosen. Keeps history bisectable and each hop revertible.
- D2 — One squashed commit at the end. Loses per-hop revertibility. *Rejected.*

## Cross-cutting concerns
- **Prebuild resilience** — `android/` is regenerated on prebuild; all native fixes must live in `modules/dragonflow-native/` + `scripts/copy-native-files.js`, never in generated `android/` directly. New RN template changes (e.g. Gradle/AGP, `MainApplication.kt`, manifest) must be re-reconciled with `patch-native-config` after each hop.
- **Pre-existing version skew** — `expo-audio ^55`, `jest-expo ^55` already float ahead of `expo ~54` (caret ranges). The upgrade must realign every Expo-managed dep to the target SDK via `npx expo install --fix`, not manual edits.
- **Native build, not dev server** — verification uses typecheck/lint/jest + gradle `assembleRelease`/prebuild. The Expo **dev server is the user's to start**; no autonomous `expo start`. Device QA is the user's.
- **High-risk deps** — `@react-native-google-signin/google-signin` (native, Drive backup), `expo-notifications`, `expo-audio`, and the custom FloatingBubble overlay + BootReceiver are the areas most likely to break across RN majors.
- **EAS** — `eas.json` pins `cli >= 16.0.0`; confirm EAS CLI + build image still satisfy SDK 57.
- **React 19.1 → 19.2** — minor; watch for any `react-dom`/renderer peer pins.

## Recommendation
A1 (incremental to 57) · **B1 (pure upgrade, share-intent migration deferred to its own story)** · **C1 (keep custom native module, patch to survive)** · D1 (commit per hop). This keeps the enabler tightly scoped: land on 57 with zero behavior change, then let the already-backlogged expo-share-intent and iOS-share-target stories consume the unlocked capability.

## Open questions
- **Q-B (scope):** Pure upgrade only, or bundle the expo-share-intent migration? → default **B1**.
- **Q-C (native):** Keep custom native module, or migrate opportunistically? → default **C1**.
- Deferred to Analyze: exact per-dep target versions across 55/56/57, breaking changes per hop, whether the FloatingBubble/Boot Kotlin needs changes for RN 0.86, EAS image compatibility.

## ✅ Converged decisions (2026-07-30)
| Dimension | Decision | Source |
| --- | --- | --- |
| A · Path | **A1** — incremental 54→55→56→57, verify each hop | Pick-idea gate |
| B · Scope | **B1** — pure upgrade; expo-share-intent migration & iOS share target are separate spawned stories | Autopilot (recommended default) |
| C · Native | **C1** — keep custom native module, patch via `modules/` + `copy-native-files.js` to survive each hop | Autopilot (recommended default) |
| D · Commits | **D1** — one gated commit per SDK hop | Pick-idea gate |
| Goals | Unlock expo-share-intent (SDK 55+) + stay current on RN 0.86/React 19.2 + security | Pick-idea gate |

## Summary & Handoff to Analyze
**What we're building** — A pure, incremental Expo SDK upgrade from 54 to 57 (RN 0.81→0.86, React 19.1→19.2), advancing one SDK major at a time with a verify+commit checkpoint at each hop, ending with the app building and all existing behavior intact. No user-facing behavior change ships in this effort.

**Decisions taken**
- Incremental path 54→55→56→57 (not big-bang), commit+verify each hop.
- Pure upgrade only — `expo-share-intent` migration and iOS share target are **deferred to their own spawned stories** that this upgrade unlocks.
- Keep the custom native module (FloatingBubble/Boot/Sound/Parking/ShareIntent) and patch it to survive each hop, edits only in `modules/dragonflow-native/` + `scripts/copy-native-files.js`.

**Deferred to Analyze** (Stage 3 must size these)
- Exact target versions for every Expo-managed dep at each hop; resolve the pre-existing `expo-audio`/`jest-expo ^55` skew via `expo install --fix`.
- Breaking changes per hop (55, 56, 57) — especially RN 0.82→0.86 Gradle/AGP/manifest template changes and any `expo-notifications`/`expo-audio` API changes.
- Whether the custom Kotlin (FloatingBubble overlay, BootReceiver, foreground service) needs changes for RN 0.86 / new Android build tooling.
- `@react-native-google-signin/google-signin` compatibility with SDK 57 / RN 0.86.
- EAS CLI + build-image compatibility with SDK 57; `patch-native-config` reconciliation after each prebuild.
- Map of affected files (build scripts, native module, package.json) with `file:line`.

**Value verdict** — Medium/High strategic impact (unblocks 2 backlog items + keeps app supported), Effort **L**, high blast radius. Worth doing; scope kept tight to de-risk.
