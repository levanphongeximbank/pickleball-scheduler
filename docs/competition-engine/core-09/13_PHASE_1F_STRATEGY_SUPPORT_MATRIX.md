# CORE-09 — Phase 1F Strategy Support Matrix

**Purpose:** Freeze which MatchGeneration strategies are certified, deferred, or contract-listed without an executor.
**Canonical executor:** `generateMatchPlan`
**Phase:** 1F — documentation only.

---

## Supported and certified

| Strategy | Phase delivered | Executor path | Notes |
|----------|-----------------|---------------|-------|
| `ROUND_ROBIN` | 1C | `generateMatchPlan` → RR | Flat Draw placement order; circle pairings; `encounterCount` 1 or 2 |
| `GROUP_ROUND_ROBIN` | 1C | `generateMatchPlan` → Group RR | Per-group isolation; group catalog order from Draw |
| `SINGLE_ELIMINATION` | 1D | `generateMatchPlan` → SE | Draw-owned bracket slots + byes; optional third place |

Aliases `generateRoundRobinMatchPlan`, `generateGroupStageRoundRobinMatchPlan`, and `generateSingleEliminationMatchPlan` all call the same canonical executor (request strategy must already match).

### Success behavior (certified)

- Returns `{ ok: true, matchPlan, issues: [], fingerprints, diagnostics }`
- `matchPlan` passes strategy-specific + cross-strategy invariants
- Fingerprints bound: draw, rule evaluation, participant, generation

### Failure behavior (certified)

- Returns `{ ok: false, matchPlan: null, issues: [...] }`
- Primary issue code is deterministic (sorted issue list)
- No partial MatchPlan escape
- No strategy coercion to another supported strategy

---

## Deferred and fail-closed

| Strategy | Resolve / contract binding | Executor behavior |
|----------|----------------------------|-------------------|
| `DOUBLE_ELIMINATION` | `resolveSupportedStrategy` → `STRATEGY_DEFERRED` | Never executes |
| `SWISS` | `resolveSupportedStrategy` → `STRATEGY_DEFERRED` | Never executes |

### Exact expected failure behavior

| Surface | Expected code | Expected `matchPlan` |
|---------|---------------|----------------------|
| `createMatchGenerationRequest({ strategy })` | Throws `MatchGenerationContractError` with `STRATEGY_DEFERRED` | N/A |
| `createEvaluatedMatchGenerationRules({ generationStrategy })` | Throws with `STRATEGY_DEFERRED` | N/A |
| `MatchGenerationRulePort` fixed double | `ok: false`, issue `STRATEGY_DEFERRED` | N/A |
| `rejectUnsupportedStrategy(strategy)` | Result `STRATEGY_DEFERRED` | `null` |
| `validateMatchGenerationRequest` | Issue `STRATEGY_DEFERRED` | N/A |

No silent remap to `ROUND_ROBIN`, `GROUP_ROUND_ROBIN`, or `SINGLE_ELIMINATION`.

---

## Contract-listed without executor

| Strategy | Contract enum | Executor |
|----------|---------------|----------|
| `TEAM_FIXTURE` | Present in `MATCH_GENERATION_STRATEGY` | **None** |

`TEAM_FIXTURE` may bind at the strategy enum / contract level (`resolveSupportedStrategy` returns ok), but **`generateMatchPlan` has no executor** for it.

### Exact expected failure behavior at executor

| Surface | Expected code | Expected `matchPlan` |
|---------|---------------|----------------------|
| `generateMatchPlan` with `strategy: "TEAM_FIXTURE"` | `STRATEGY_UNSUPPORTED` | `null` |

Message intent: Match Generator executor does not support this strategy yet.

Team Tournament fixture generation remains outside CORE-09 ownership until Owner-approved team executor + adapter work (see `05_MIGRATION_AND_COMPATIBILITY_MAP.md`).

---

## Unsupported / unknown strategies

| Input | Expected |
|-------|----------|
| Empty / missing strategy | `STRATEGY_REQUIRED` |
| Unknown string | `STRATEGY_UNSUPPORTED` |

Always fail-closed. Never default.

---

## Policy constraints (supported strategies)

| Strategy | Notable fail-closed policies |
|----------|------------------------------|
| RR / Group RR | `CUSTOM` roundRobinMode → `ROUND_ROBIN_MODE_UNSUPPORTED`; `byePolicy !== NONE` → `UNSUPPORTED_GENERATION_POLICY`; rematch/same-club/format constraints → fail closed |
| SE | `encounterCount !== 1` → fail; unsupported consolation → fail; `byePolicy NONE` when byes required → fail; rule strategy mismatch → `RULE_STRATEGY_MISMATCH` |

---

## Related artifacts

- Integration certification: `10_PHASE_1F_INTEGRATION_CERTIFICATION.md`
- Adapter readiness: `12_PHASE_1F_ADAPTER_READINESS_MATRIX.md`
- Phase 1C / 1D docs: `08_PHASE_1C_ROUND_ROBIN_GROUP_STAGE.md`, `09_PHASE_1D_SINGLE_ELIMINATION.md`
