# CORE-09 — Phase 1F Integration Certification

**Status:** Certification evidence only — no production wiring
**Module:** `src/features/competition-core/match-generation/`
**Capability-local public surface:** `match-generation/index.js`
**Root barrel:** `competition-core/index.js` — **unchanged** (Match Generator not exported)
**Generator identity version:** `MATCH_GENERATOR_IDENTITY.version = "1.0.0-phase1d"` (unchanged in Phase 1F)

---

## 1. Certification purpose

Phase 1F certifies that CORE-09 Match Generator is **integration-ready** with its upstream contracts and architectural boundaries:

- CORE-01 Rule Engine (evaluated rules binding, not re-evaluation)
- CORE-08 Draw / Draw Runtime (frozen DrawSnapshot consumption)
- Canonical executor (`generateMatchPlan`)
- Cross-strategy invariants and determinism
- Downstream readiness without owning schedule / lifecycle / score / standings

This phase produces **documentation and verification evidence only**. It does not implement production adapters, runtime wiring, UI, SQL, Supabase, or root barrel export.

---

## 2. Scope

### In scope

| Item | Notes |
|------|-------|
| Integration certification document | This file |
| Contract compatibility matrix | `11_PHASE_1F_CONTRACT_COMPATIBILITY_MATRIX.md` |
| Adapter readiness matrix | `12_PHASE_1F_ADAPTER_READINESS_MATRIX.md` |
| Strategy support matrix | `13_PHASE_1F_STRATEGY_SUPPORT_MATRIX.md` |
| Regression evidence | `14_PHASE_1F_REGRESSION_EVIDENCE.md` |
| Closure checklist | `15_CORE_09_CLOSURE_CHECKLIST.md` |
| Re-run of Phase 1B–1E regression + lint/build/locks | Evidence capture only |

### Out of scope

- Production adapters (CORE-01 → rules, CORE-08 → DrawSnapshot, MatchPlan → downstream)
- Production runtime import paths
- Root Competition Core barrel export
- Feature flags / kill switches
- Persistence / SQL / Supabase
- UI
- Daily Play / Team Tournament runtime wiring
- Scheduling ownership / Match Lifecycle ownership
- Changing generator behavior or `MATCH_GENERATOR_IDENTITY.version`

---

## 3. Supported strategies (certified)

| Strategy | Phase | Executor |
|----------|-------|----------|
| `ROUND_ROBIN` | 1C | `generateMatchPlan` → RR path |
| `GROUP_ROUND_ROBIN` | 1C | `generateMatchPlan` → Group RR path |
| `SINGLE_ELIMINATION` | 1D | `generateMatchPlan` → SE path |

See `13_PHASE_1F_STRATEGY_SUPPORT_MATRIX.md`.

---

## 4. Deferred strategies (fail-closed)

| Strategy | Behavior |
|----------|----------|
| `DOUBLE_ELIMINATION` | Rejected as `STRATEGY_DEFERRED` |
| `SWISS` | Rejected as `STRATEGY_DEFERRED` |
| `TEAM_FIXTURE` | Contract-listed; **no executor** → `STRATEGY_UNSUPPORTED` at `generateMatchPlan` |

No silent coercion to a supported strategy.

---

## 5. Rule Engine integration (certified)

| Requirement | Certification |
|-------------|---------------|
| Consume `generationStrategy` from evaluated rules | Pass — bound via `EvaluatedMatchGenerationRules` |
| Strategy mismatch fails closed | Pass — `RULE_STRATEGY_MISMATCH` |
| Enforce `encounterCount` | Pass — RR 1/2 + mode; SE requires 1 |
| Consume `byePolicy` without re-implementing Rule Engine | Pass |
| Consume `bracketSizePolicy` / `thirdPlacePolicy` | Pass (SE) |
| Unsupported consolation / format constraints fail closed | Pass — `UNSUPPORTED_GENERATION_POLICY` |
| Bind rule fingerprint into MatchPlan identity | Pass |
| No duplicated rule evaluation logic in CORE-09 | Pass — bind + validate only |
| CORE-01 operation binding | Pass — `RULE_OPERATION.MATCHUP` (alias `MATCH_GENERATE`) |

**Adapter note:** CORE-01 does not yet emit the exact `EvaluatedMatchGenerationRules` shape. An **additive dormant adapter** is recommended before production cutover. This is **not** a CORE-09 capability blocker. See `12_PHASE_1F_ADAPTER_READINESS_MATRIX.md`.

---

## 6. Draw integration (certified)

| Requirement | Certification |
|-------------|---------------|
| Consume frozen DrawSnapshot only | Pass |
| Require completed Draw | Pass — `completionStatus === COMPLETE` |
| Validate Draw version / fingerprint | Pass |
| Preserve participant / group / bracket placement order | Pass |
| Consume Draw-owned bye placements | Pass (SE) |
| Do not reseed / shuffle / move participants / choose bye recipients / rerun Draw | Pass |
| Fail closed on incomplete or inconsistent placement | Pass |

**Adapter note:** CORE-08 Draw Runtime output differs from CORE-09 `DrawSnapshot`. An **additive dormant adapter** is required before production cutover. This is **not** a Phase 1F documentation blocker. See `12_PHASE_1F_ADAPTER_READINESS_MATRIX.md`.

---

## 7. Canonical executor (certified)

Single canonical entry: `generateMatchPlan(request, context)`.

| Property | Certification |
|----------|---------------|
| Dispatches RR / Group RR / SE | Pass |
| Strategy-specific validation before generation | Pass |
| Failures return `ok: false` and `matchPlan: null` | Pass |
| No partial MatchPlan escape | Pass |
| No strategy coercion / silent repair | Pass |
| No input mutation | Pass |
| No duplicated orchestration path | Pass (aliases call same executor) |
| Deterministic issue ordering | Pass |

---

## 8. Invariant coverage (certified)

### Cross-strategy

Unique LogicalMatch keys · stable ordering · valid participant slots · valid bye representation · no forbidden scheduling fields · no duplicate dependency edges · no dangling dependencies · no cycles · valid winner/loser paths · stable generation fingerprint · failure atomicity.

### Strategy-specific

| Strategy | Invariants |
|----------|------------|
| Round Robin | Pair counts honor `encounterCount` |
| Group Stage | Cross-group isolation |
| Single Elimination | Bracket structure + third-place loser dependencies |

Hardening evidence: Phase 1E duplicate-edge invariant + large-N stress.

---

## 9. Determinism evidence (certified)

Forbidden patterns absent from Match Generator module source:

- `Math.random`
- `Date.now` for identity
- `randomUUID` / UUID libraries
- `localeCompare`

Large-N evidence (Phase 1E):

| Case | Evidence |
|------|----------|
| Round Robin N=128 | Deterministic fingerprint + stable ordering on repeat |
| Single Elimination N=1024 | Graph integrity + deterministic output on repeat |
| Group Stage 8×16 | Cross-group isolation at scale |

Details: `14_PHASE_1F_REGRESSION_EVIDENCE.md`.

---

## 10. Downstream readiness (certified)

MatchPlan is intentionally **logical-only** and excludes:

- date / time
- court
- referee
- score / result
- lifecycle state
- standings state

Enforced via `FORBIDDEN_MATCH_PLAN_FIELDS` and invariant validation.

Downstream consumers (scheduling, court/referee assignment, Match Lifecycle, scoring, standings) may consume MatchPlan later through **downstream-owned adapters**. Those adapters are **deferred by ownership** and are not CORE-09-owned. See `12_PHASE_1F_ADAPTER_READINESS_MATRIX.md`.

---

## 11. Ownership boundaries (certified)

| CORE-09 owns | CORE-09 does not own |
|--------------|----------------------|
| Logical MatchPlan generation | Draw execution / shuffle / bye recipient selection |
| Strategy executors (RR / Group RR / SE) | Rule evaluation (CORE-01) |
| Dependency graph + fingerprints | Schedule date/time/court/referee |
| Fail-closed validation | Match lifecycle / score / result |
| Capability-local public API | Standings / UI / persistence |

See `01_OWNERSHIP_BOUNDARY.md`.

---

## 12. Version clarification

`MATCH_GENERATOR_IDENTITY.version` remains **`1.0.0-phase1d`**.

Phase 1F adds certification evidence only and does **not** change generator behavior, key derivation, or fingerprint material. Leaving the version at `phase1d` is **intentional**, not an omission.

Bump only when stable logical key derivation or canonical fingerprint material changes (Owner-approved behavior change).

---

## 13. Closure conditions

CORE-09 capability closure (pre-production) requires:

1. Phase 1B–1E merged and present in history
2. Phase 1F certification artifacts Owner-approved
3. Regression baseline green (142 pass)
4. Lint / build / architecture lock / ownership lock green
5. No root barrel export / no production wiring
6. Adapters documented as dormant prerequisites
7. Explicit Owner approval before any production cutover

Full gate list: `15_CORE_09_CLOSURE_CHECKLIST.md`.

---

## 14. Final certification status

| Dimension | Status |
|-----------|--------|
| Capability contracts + executors | Certified (dormant) |
| Rule Engine boundary | Certified (dormant adapter prerequisite for production) |
| Draw boundary | Certified (dormant adapter prerequisite for production) |
| Canonical executor | Certified |
| Invariants + determinism | Certified |
| Downstream readiness (logical-only) | Certified |
| Production wiring | **Not started** — Owner gate |
| Root barrel export | **Forbidden until Owner cutover** |

**Phase 1F certification status:** READY for Owner final pre-commit review of documentation evidence.
