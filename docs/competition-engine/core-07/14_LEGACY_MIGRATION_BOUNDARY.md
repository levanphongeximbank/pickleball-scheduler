# CORE-07 — Legacy Migration Boundary

**Phase:** 1B Architecture Freeze
**Status:** Documentation only — **do not modify** legacy or Phase 3G/CC-04B implementations in Phase 1B

---

## 1. Purpose

Document exact roles for Phase 3G `seeding/**`, CC-04B `seed/**`, and legacy production SSOT engines so Phase 1C+ adaptation has a clear boundary.

---

## 2. Phase 3G — `src/features/competition-core/seeding/**`

**Role:** Preferred **runtime migration target** for CORE-07 (Owner-approved). Must be **adapted** to canonical contracts — not copied blindly.

| Component | Classification | Notes |
|-----------|----------------|-------|
| `SeedingResolver.js` | **reusable after adaptation** | Align request/result to `core07-seeding-contracts-v1`; inject eligibility/rule ports |
| `contracts/seedingRequest.js` | **reusable after adaptation** | Expand to SeedingScope (competition boundary only), snapshot, overrides, explicit effectiveAt; policy on request/result provenance |
| `contracts/seedingCandidate.js` | **reusable after adaptation** | Add mandatory stableCanonicalId / eligibility enum normalization |
| `contracts/seedingPolicy.js` | **reusable after adaptation** | Move from function-heavy policy object toward versioned declarative + hooks |
| `contracts/seedAssignment.js` / `seedingResult.js` | **reusable after adaptation** | Add fingerprint, finalization, rejectedOverrides |
| `contracts/seedingIdentity.js` | **reusable after adaptation** | Ensure identity key == stable canonical ID rules |
| `contracts/adapterContract.js` | **reusable after adaptation** | Legacy inbound adapter contract |
| `services/assignSeeds.js` | **reusable after adaptation** | Conform to reserved-slot + free-number fill algorithm |
| `services/tieBreak.js` / `deterministicOrdering.js` | **reusable after adaptation** | Policy-driven primary + frozen `core07-compare-v1`; identity final tie-break mandatory |
| `services/deterministicRandom.js` | **reference only** (default path) | Prefer no PRNG in competition seeding; Draw owns shuffle; keep util quarantined |
| `services/normalizeCandidates.js` / `validateCandidates.js` | **reusable after adaptation** | Enforce duplicate fail-closed + missing ID codes |
| `services/seedingIdentityLookup.js` | **reusable after adaptation** | |
| `policies/noopSeedingPolicy.js` | **replace** for production paths | Noop eligibility is unsafe for cutover; keep as test double only |
| `ports/seedingPersistencePort.js` | **reusable as-is** (default OFF) | Persistence remains OFF |
| `ports/index.js` | **reusable after adaptation** | Add EligibilityDecisionPort + RuleEvaluationPort modules |
| `errors/*` | **reusable after adaptation** | Align codes to doc 13 |
| `enums/*` | **reusable after adaptation** | Extend assignment sources / entry types as needed |
| `mappers/legacySeedingMapper.js` | **reusable after adaptation** | |
| `adapters/LegacySeedingAdapter.js` | **reusable after adaptation** | |
| `index.js` | **reusable after adaptation** | Capability-local only — **no** root export in 1B/1C without Owner |

### 2.1 Phase 3G disposition summary

- **Migrate-in-place** under `seeding/**` toward CORE-07 contracts.
- Do not create a parallel `seeding-core07/**` tree unless Owner later mandates.
- Existing Phase 3G tests remain owned by Phase 3G until Phase 1C introduces `competition-core-seeding-core07.test.js` and Owner decides merge strategy.

---

## 3. CC-04B — `src/features/competition-core/seed/**`

**Role:** Read-only during Phase 1B. Composite **score** pipeline is **not** implicit CORE-07 responsibility.

| Component | Classification | Notes |
|-----------|----------------|-------|
| `seedScoreModel.js` | **upstream scoring candidate** / **incompatible model** for CORE-07 assignment SSOT | Scoring belongs upstream or explicit Owner bridge later |
| `seedPipeline.js` (`runCanonicalSeedPipeline`) | **reference only** | Shadow / historical foundation |
| `seedTieBreakModel.js` | **reference only** | Incomplete total order risk (cmp 0) — do not import as CORE-07 comparator |
| `seedTypes.js` / `seedConstants.js` / `seedContracts.js` | **reference only** | |
| `legacySeedMapping.js` | **reference only** | |
| `index.js` | **deferred design decision** | Remains shadow export path; no merge into CORE-07 assignment without Owner model-merge |

### 3.1 CC-04B disposition summary

- **Do not** rewrite in Phase 1B/1C assignment work.
- **Do not** make composite scoring a hidden step inside CORE-07.
- Future options (Owner-gated): (a) retire, (b) keep as upstream score producer that emits snapshot values, (c) explicit bridge policy — **deferred**.

---

## 4. Legacy production SSOT

### 4.1 `seedEngine.generateSeed`
`src/features/tournament-engine/engines/seedEngine.js`

| Aspect | Definition |
|--------|------------|
| **Current production responsibility** | Individual TE: weighted score (Rating V5 / Elo / skill defaults), seed bands, optional unseeded pool, manual override helpers |
| **Overlap with CORE-07** | Seed number assignment + manual overrides |
| **Non-overlap** | Score blending, default synthetic ratings, seed bands as placement aids, local status set |
| **Migration risk** | High — defaults (700) and `seed: null` unseeded pools vs CORE-07 nulls-last / max-seeded policy change published brackets |
| **Replacement boundary** | CORE-07 owns ordering+assignment only; rating inputs must arrive as `RankingRatingSnapshot`; bands → Draw metadata |
| **Required adapter** | Legacy TE → candidates + snapshot + policy + overrides inbound adapter |
| **Deprecation condition** | Shadow parity accepted + Owner cutover + UI writes CORE-07 fields + bands moved downstream |

**Do not modify in Phase 1B.**

### 4.2 `assignSeedsToEntries`
`src/tournament/engines/teamPairingEngine.js`

| Aspect | Definition |
|--------|------------|
| **Current production responsibility** | Official/AI Balance entries: sort by summed member ratings → `seed: index+1` |
| **Overlap with CORE-07** | Seed number assignment from rating order |
| **Non-overlap** | Computing sum-of-members (upstream snapshot responsibility) |
| **Migration risk** | Medium — equal ratings lack total-order secondary key today |
| **Replacement boundary** | Snapshot supplies per-entry rating aggregate; CORE-07 orders + assigns |
| **Required adapter** | Official entry list → SeedingCandidate + snapshot values |
| **Deprecation condition** | Adapter parity + Owner gate for official flows |

**Do not modify in Phase 1B.**

### 4.3 `teamGroupSeedEngine`
`src/features/team-tournament/engines/teamGroupSeedEngine.js`

| Aspect | Definition |
|--------|------------|
| **Current production responsibility** | Team sort → seed numbers; open shuffle (`Math.random`); **snake helpers** |
| **Overlap with CORE-07** | Competition seed numbering from team metrics |
| **Non-overlap** | Snake placement, open shuffle (`seed: 0`) |
| **Migration risk** | High — seed+draw entanglement; open non-determinism |
| **Replacement boundary** | CORE-07: order+assign only; Draw: snake/open with injected RNG |
| **Required adapter** | Split adapter — seeding half vs placement half |
| **Deprecation condition** | Split complete + Draw owns snake/open + shadow parity + Owner gate |

**Do not modify in Phase 1B.**

---

## 5. Related surfaces (boundary reminders)

| Surface | Disposition |
|---------|-------------|
| `tournament.seeding.logic.js` / `seededGroupEngine.js` | Mostly **DOWNSTREAM** grouping — not CORE-07 |
| `draw/seedModel.js` / draw-runtime pot snake | **DOWNSTREAM** — consume assignments |
| `ratingV5SeedAdapter.js` | **UPSTREAM** rating support; audit `Date.now` stays out of CORE-07 fingerprint |
| AI `seedSuggestion.js` / Engine seed UI | **OUT** of domain core |
| Demo/tenant SQL “seed” scripts | **OUT** — name collision only |

---

## 6. Migration sequencing (documentation)

```text
Phase 1B  — contracts freeze (this phase)
Phase 1C  — adapt seeding/** domain to contracts (non-production)
Later     — adapters + shadow parity vs legacy SSOT
Later     — Integrator export / Owner cutover
Never-by-default — blind copy of CC-04B score into CORE-07
```
