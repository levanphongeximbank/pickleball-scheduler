# CC-07 Group Constraints

## Scope

Pre-validation, candidate validation, post-draw validation, explanation/audit only. **Draw algorithm unchanged.**

## Bridge

`evaluateLegacyGroupConstraints` → `evaluateCanonicalRulesRuntime`

Legacy `avoid_same_group` maps to canonical `avoid_partner` with group-scope hard evaluation (`evaluateGroupAnchorTargetRule`).

## Wired from

`constraintEvaluator.evaluateGroupConstraints` → bridge with legacy fallback.

## Deferred

Draw loop optimization (re-seed/re-assign) remains legacy — Rules V2 validates only.
