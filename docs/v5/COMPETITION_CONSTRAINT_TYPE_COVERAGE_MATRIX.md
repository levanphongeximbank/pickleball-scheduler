# COMPETITION_CONSTRAINT_TYPE — Coverage Matrix

| Field | Value |
|-------|-------|
| Date | 2026-07-15 |
| Branch | `feature/private-pairing-rules-v2` |
| Scope | Competition Core Rules V2 + Private Pairing V2 |
| RULE_PRIORITY | **Not wired** — ranking remains Hard → Soft → Weight |
| Production | No flag / migration / deploy changes in this work |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **SUPPORTED** | Registry + validation + evaluator path(s) + tests; no silent ignore |
| **PARTIAL** | Implemented for primary consumer; secondary gap or thin tests |
| **NOT_IMPLEMENTED** | Registry only / no evaluator (should be empty after this work for PP subset) |
| **NOT_APPLICABLE** | Outside Private Pairing domain; CC-only regulatory |

A type is **never** marked complete solely because it appears in the enum or UI.

---

## Severity defaults

Source: `DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE` in `constraints/ruleConstants.js`.

| Hard (default) | Soft (default) |
|----------------|----------------|
| `must_partner`, `must_not_partner`, `must_opponent`, `must_not_opponent` | `prefer_partner`, `avoid_partner`, `prefer_opponent`, `avoid_opponent` |
| `gender_eligibility`, `mixed_team_composition` | `skill_cap`, `team_skill_difference` |
| `checkin_required`, `availability_required`, `player_not_busy` | `same_club_separation`, `same_organization_separation` |
| `lineup_validity`, `entry_eligibility` | `same_group`, `different_group`, `same_team`, `different_team` |
| | `max_partner_repeat`, `max_opponent_repeat`, `min_partner_repeat`, `min_opponent_repeat`, `min_rest_time` |

Hard override of a soft default is evaluated as hard (absolute reject). Soft override of a hard default is scored as soft (never used to reject).

---

## Evaluators / consumers

| Layer | Path |
|-------|------|
| CC hard | `evaluateHardRules.js` |
| CC soft | `scoreSoftRules.js` |
| CC support sets | `constraintSupport.js` (`SUPPORTED_HARD_*`, `SUPPORTED_SOFT_*`) |
| CC pipeline | `evaluateCandidate.js` (flag-gated) |
| PP hard | `evaluateHardOnCandidate.js` |
| PP soft | `scoreSoftOnCandidate.js` |
| PP conflict | `detectPrivatePairingConflicts.js` |
| PP simulation | `candidateScorer.js` → PP runtime |
| Explicit unsupported | `UNSUPPORTED_CONSTRAINT_EVALUATION` (CC), `UNSUPPORTED_HARD_CONSTRAINT` / `UNSUPPORTED_SOFT_CONSTRAINT` (PP) |
| Missing context | `RULE_NOT_APPLICABLE` (CC), `CONSTRAINT_CONTEXT_MISSING` deferred (PP) |

---

## Coverage matrix

| Constraint Type | Canonical Registry | Validation | Conflict Detection | Hard Evaluator | Soft Scorer | Simulation | Runtime Consumer | Tests | Status | Gap |
|-----------------|--------------------|------------|--------------------|----------------|-------------|------------|------------------|-------|--------|-----|
| `must_partner` | YES | YES | YES (CC+PP) | YES CC+PP | N/A (hard default) | YES | CC Rules V2 / PP Unified | YES | **SUPPORTED** | — |
| `must_not_partner` | YES | YES | YES | YES CC+PP | N/A | YES | CC / PP | YES | **SUPPORTED** | — |
| `prefer_partner` | YES | YES | PARTIAL (PP soft conflicts) | If severity hard → partner hard | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `avoid_partner` | YES | YES | YES | YES CC+PP (hard override) | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `prefer_opponent` | YES | YES | PARTIAL | N/A soft default | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | Needs match geometry |
| `must_opponent` | YES | YES | YES (PP) | YES CC+PP | N/A | YES | CC / PP | YES | **SUPPORTED** | PP defers if no matchOption |
| `avoid_opponent` | YES | YES | PARTIAL | YES CC+PP (hard override) | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `must_not_opponent` | YES | YES | YES (PP) | YES CC+PP | N/A | YES | CC / PP | YES | **SUPPORTED** | PP defers if no matchOption |
| `gender_eligibility` | YES | YES CC | PARTIAL | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | Outside PP subset |
| `mixed_team_composition` | YES | YES CC | YES | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `skill_cap` | YES | YES CC | YES | YES CC (hard override) | YES CC | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `team_skill_difference` | YES | YES CC | YES | YES CC (hard override) | YES CC | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `checkin_required` | YES | YES CC | PARTIAL | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `availability_required` | YES | YES CC | NO | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `player_not_busy` | YES | YES CC | NO | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `lineup_validity` | YES | YES CC | NO | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `entry_eligibility` | YES | YES CC | NO | YES CC | N/A | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `same_club_separation` | YES | YES CC | NO | YES CC (needs groups) | YES CC | YES CC | CC only | YES | **SUPPORTED** | Missing groups → explicit `RULE_NOT_APPLICABLE` when hard |
| `same_organization_separation` | YES | YES CC | NO | YES CC | YES CC | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |
| `same_group` | YES | YES PP+CC | NO dedicated | YES CC+PP | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | Needs groups context |
| `different_group` | YES | YES PP+CC | NO dedicated | YES CC+PP | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | Needs groups context |
| `same_team` | YES | YES PP+CC | NO dedicated | YES CC+PP | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `different_team` | YES | YES PP+CC | NO dedicated | YES CC+PP | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `max_partner_repeat` | YES | YES | NO | YES (hard override) | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `max_opponent_repeat` | YES | YES | NO | YES (hard override) | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | Needs match/team geometry |
| `min_partner_repeat` | YES | YES | NO | YES (hard override) | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | — |
| `min_opponent_repeat` | YES | YES | NO | YES (hard override) | YES CC+PP | YES | CC / PP | YES | **SUPPORTED** | Needs match/team geometry |
| `min_rest_time` | YES | YES CC | NO | YES CC (hard override) | YES CC | YES CC | CC only | YES | **SUPPORTED** | NOT_APPLICABLE to PP |

---

## Totals (28 registry values)

| Bucket | Count | % |
|--------|------:|--:|
| **SUPPORTED** | 28 | **100%** |
| **PARTIAL** | 0 | 0% |
| **NOT_IMPLEMENTED** | 0 | 0% |
| **Coverage (evaluator-backed, no silent ignore)** | 28/28 | **100%** |

Private Pairing subset (16 types): all **SUPPORTED** for hard and/or soft evaluation — no silent ignore.
CC-only regulatory types (11): evaluated in Competition Core; **NOT_APPLICABLE** to Private Pairing UI/runtime.

---

## Hard evaluator additions (this work)

- CC: `must_opponent`, `must_not_opponent`, `avoid_opponent` (hard), `same_group`, `different_group`, `same_team`, `different_team`, repeat min/max hard override, `min_rest_time` hard override
- PP: `avoid_partner`/`avoid_opponent` hard, `same_team`/`different_team`, `same_group`/`different_group`, min/max partner/opponent repeat hard
- Loud codes: `UNSUPPORTED_CONSTRAINT_EVALUATION`, `UNSUPPORTED_HARD_CONSTRAINT`, `CONSTRAINT_CONTEXT_MISSING` (deferred)

## Soft scorer additions (this work)

- CC: `prefer_opponent`, `same_group`, `different_group`, `same_team`, `different_team`, `min_partner_repeat`, `min_opponent_repeat`
- PP: group/team soft, `min_partner_repeat`, `min_opponent_repeat`
- Loud code: `UNSUPPORTED_SOFT_CONSTRAINT`

---

## Tests protecting coverage

| Suite | Role |
|-------|------|
| `tests/competition-constraint-coverage.test.js` | Matrix + new types + hard>soft + unsupported + flag OFF + PP/CC parity |
| `tests/competition-core-rules-engine.test.js` | CC regression |
| `tests/private-pairing-rules-pr2.test.js` | Types/conflict validation |
| `tests/private-pairing-rules-pr3-runtime.test.js` | PP runtime regression |
| `tests/private-pairing-rules-pr45-simulation.test.js` | Simulation regression |

---

## Remaining gaps (acceptable)

1. **RULE_PRIORITY** not wired (owner GO deferred) — ranking stays Hard → Soft → Weight.
2. Dedicated conflict codes for `same_group` vs `different_group` / `same_team` vs `different_team` not expanded (partner/opponent conflicts cover primary contradictions).
3. Feature flags still default OFF — Production behavior unchanged until flags enabled.

---

## Acceptance checklist

| # | Criterion | Result |
|---|-----------|--------|
| 1 | No silent ignore of canonical types | PASS |
| 2 | Every type has explicit Status | PASS |
| 3 | PP subset fully evaluated | PASS |
| 4 | Hard absolute reject | PASS |
| 5 | Soft scores | PASS |
| 6 | CC/PP behavior aligned on shared types | PASS |
| 7–9 | Tests / build / lint | See final report |
| 10 | No Production changes | PASS |
