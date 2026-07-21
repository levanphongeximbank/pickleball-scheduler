# CORE-09 — Domain Invariants

**Enforced by:** `validateMatchPlanInvariants`, `validateDrawSnapshotForGeneration`, `validateMatchGenerationRequest`  
**Issue codes:** `MATCH_GENERATION_ISSUE_CODE` (deterministic; free-text is diagnostic only)

| # | Invariant | Primary code(s) |
|---|-----------|-----------------|
| 1 | No participant plays itself | `SELF_MATCH` |
| 2 | No forbidden duplicate pairing | `FORBIDDEN_DUPLICATE_PAIRING` |
| 3 | Every logical match belongs to exactly one stage | `MATCH_STAGE_REQUIRED`, `MATCH_STAGE_AMBIGUOUS` |
| 4 | Every logical match belongs to exactly one round | `MATCH_ROUND_REQUIRED`, `MATCH_ROUND_AMBIGUOUS` |
| 5 | Stable match keys unique inside a MatchPlan | `DUPLICATE_LOGICAL_MATCH_KEY`, `INVALID_LOGICAL_MATCH_KEY` |
| 6 | All dependency references resolve | `DANGLING_DEPENDENCY` |
| 7 | Dependency graph contains no cycles | `DEPENDENCY_CYCLE` |
| 8 | Elimination winner paths resolve to valid future slots | `INVALID_WINNER_PATH` |
| 9 | Bye representation is consistent | `INVALID_BYE_REPRESENTATION` |
| 10 | Draw placements are not mutated | `DRAW_MUTATION_DETECTED` |
| 11 | Draw fingerprint bound to MatchPlan | `DRAW_FINGERPRINT_MISSING`, `DRAW_FINGERPRINT_MISMATCH` |
| 12 | Rule evaluation fingerprint bound to MatchPlan | `RULE_FINGERPRINT_MISSING`, `RULE_FINGERPRINT_MISMATCH` |
| 13 | Identical inputs regenerate the same output | `GENERATION_FINGERPRINT_MISMATCH` + fingerprint helpers |
| 14 | No schedule/court/referee/score/result/lifecycle/standings on MatchPlan contracts | `FORBIDDEN_SCHEDULING_FIELD` |
| 15 | Unsupported strategy fails closed | `STRATEGY_UNSUPPORTED`, `STRATEGY_DEFERRED`, `STRATEGY_REQUIRED` |

## Draw fail-closed gates

Before generation (port + validator):

- Draw incomplete → `DRAW_INCOMPLETE`
- Draw fingerprint absent → `DRAW_FINGERPRINT_MISSING`
- Duplicate / missing participant placement → `DRAW_PLACEMENT_DUPLICATE` / `DRAW_PLACEMENT_MISSING`
- Invalid group/bracket references → `DRAW_REFERENCE_INVALID`
- Non-empty group/bracket ref with empty catalog → `DRAW_CATALOG_EMPTY`
- Draw version mismatch vs request → `DRAW_VERSION_MISMATCH`

## Rule binding

Evaluate rules **once**, bind `EvaluatedMatchGenerationRules` (including `ruleEvaluationFingerprint`), then generate the whole MatchPlan.  
CORE-09 must not reinterpret unsupported rules silently or default unknown policies permissively.
