# CORE-07 — Phase 1B Recommendation

**Phase:** 1A → 1B handoff
**Baseline:** `fb9f482434639621d465cbc35b80e085fb82f383`
**Verdict context:** `READY_WITH_CONDITIONS` (see `01_PHASE_1A_SEEDING_AUDIT.md`)

---

## 1. Recommendation summary

Proceed to **Phase 1B — Architecture / Scope Freeze** (documentation + contract design only).

Do **not** implement production cutover, root exports, feature flags ON, SQL, UI rewrites, or legacy engine deletion in Phase 1B.

---

## 2. Conditions (mandatory Owner acceptance)

| # | Condition |
|---|-----------|
| C1 | Phase 3G `src/features/competition-core/seeding/**` is the **intended CORE-07 runtime ownership target**. |
| C2 | CC-04B `src/features/competition-core/seed/**` remains **read-only reference** until an explicit Owner decision to merge, replace, or retire the score pipeline. |
| C3 | CORE-07 owns **competition seeding only** — not draw, grouping, snake, pot, bracket, matchup, or schedule generation. |
| C4 | Eligibility must be consumed via **injected ports** (CORE-03 primary; optional CORE-01 `RULE_OPERATION.SEEDING`). CORE-07 must not re-implement Rule Engine rules. |
| C5 | No production wiring: no new root barrel exports for UI consumption, no CI manifest merge, no feature-flag ON, no SQL/RPC writers in Phase 1B. |
| C6 | Legacy engines remain production SSOT until a later Owner-gated adapter/shadow phase. |
| C7 | Deterministic assignment path forbids `Math.random` and wall-clock; open shuffle stays Format/draw with injected seeded RNG. |

If Owner rejects C1–C3, Phase 1B is **BLOCKED** pending model/ownership decision.

---

## 3. Proposed Phase 1B deliverables (docs / contracts only)

Mirror CORE-06 Phase 1B style under `docs/competition-engine/core-07/`:

1. **Architecture** — resolver pipeline, identity, traces
2. **Domain model** — candidate, assignment, request/result contracts
3. **Lifecycle** — resolve → assign → (optional) snapshot; no publish ownership
4. **Scope boundary** — IN / OUT table freezing draw exclusion
5. **Ports** — eligibility, optional rule evaluation, ranking/rating snapshot, persistence (OFF), clock
6. **Status / alias** — eligible, withdrawn, DQ mapping (consume-only)
7. **Source of truth** — snapshots vs live recalculation (forbidden)
8. **Security model** — tenant/competition scope; no anon seed mutation
9. **Determinism** — total order + optional `deterministicSeed` for ties only

Optional Owner decision memo: **score pipeline (CC-04B) vs ranking-order (3G)** — pick one SSOT or define a bridge policy.

---

## 4. Explicit IN / OUT for Phase 1B freeze

### IN SCOPE (CORE-07)

- Candidate normalization / validation
- Manual / protected seed locks
- Deterministic ordering + seed number assignment
- Assignment reasons / decision traces
- Format-agnostic candidate types
- Injected eligibility / snapshot ports (contracts)
- Legacy → CORE-07 adapter **contracts** (design only)

### OUT OF SCOPE

| Area | Owner |
|------|-------|
| Draw / snake / pot / bracket / bye | Draw / Format (Phase 3H+) |
| Schedule / court / referee | Scheduling / ops cores |
| Rating / ranking engines | Rating / standings modules |
| Eligibility adjudication | CORE-03 / CORE-01 |
| Roster / lineup mutation | CORE-05 / CORE-06 |
| Production UI / SQL / RPC cutover | Later Owner gate |
| AI draw randomSeed audit | Format / team showcase |
| Demo/tenant SQL seed data | Unrelated |

---

## 5. Suggested port sketch (non-binding until Phase 1B)

```text
SeedingEligibilityPort
  assertSeedable(...) → { ok, reasonCodes[], evidenceRef? }  // fail closed

RuleEvaluationPort (optional)
  evaluate({ operation: "SEEDING", ... }) → facade → CORE-01

RankingSnapshotPort / RatingSnapshotPort
  read-only enrichment; never recalculate inside CORE-07

SeedingPersistencePort
  default OFF / noop

ClockPort
  injected; tests use fixed clock
```

Composition rule: **DI facades only** — no deep imports of `constraints/**` from `seeding/**`.

---

## 6. Phase sequencing (recommended)

| Phase | Intent |
|-------|--------|
| **1A** | Existing audit (this re-run) — **complete pending Owner review** |
| **1B** | Scope freeze + architecture docs + port contracts |
| **1C+** | Domain foundation hardening inside `seeding/**` (still non-production) |
| Later | Legacy adapters + shadow parity + Integrator export + Owner cutover gate |

Do not collapse cutover into 1B.

---

## 7. Owner decision checklist

- [ ] Accept Phase 3G as CORE-07 runtime target (C1)
- [ ] Keep CC-04B read-only pending model-merge decision (C2)
- [ ] Confirm draw/snake out of CORE-07 (C3)
- [ ] Confirm eligibility via CORE-03/01 ports only (C4)
- [ ] Confirm no production wire in Phase 1B (C5–C6)
- [ ] Confirm determinism rules (C7)
- [ ] Optional: schedule Owner decision on CC-04B score vs 3G order SSOT

---

## 8. Stop condition

This Phase 1A re-run is **complete**. Stop for Owner review.

**Final verdict:** `READY_WITH_CONDITIONS`
