# CORE-01 — Resolution Trace

**SSOT:** `src/features/competition-core/constraints/resolution/`

## Primary API

`resolveRulesDeterministic(rulesOrRuleSet, context, options) → RuleResolutionResult`

### Result contract

| Field | Meaning |
|-------|---------|
| `selectedRules` | Rules that survive filtering + authority resolution |
| `suppressedRules` | `{ rule, reasonCode, message, details? }[]` |
| `conflicts` | Unresolved / fail-closed conflicts |
| `trace` | Explainability steps |
| `ok` / `feasible` / `enabled` | Status flags |
| `errors` | Typed error list |

Input is never mutated. Same input + same `evaluatedAt` → same output.

## Trace shape

```javascript
{
  engineVersion, enabled, operation, scope, evaluatedAt,
  steps: [{ ruleId, decision, reasonCode, sourcePriority?, message?, details? }],
  meta?
}
```

`decision`: `selected` | `suppressed` | `conflict`

## Suppression / conflict reason codes

| Code | When |
|------|------|
| `rule_disabled` | `enabled === false` |
| `rule_invalid` | Missing / invalid type |
| `rule_operation_mismatch` | Operations do not include requested op |
| `rule_operation_unsupported` | Unknown operation string |
| `rule_scope_mismatch` | Domain scope filter |
| `rule_tenant_mismatch` | Applicability tenant ≠ context |
| `rule_competition_mismatch` | Applicability competition ≠ context |
| `rule_applicability_mismatch` | Other CC-03A applicability filters |
| `rule_suppressed_by_higher_authority` | Lost authority comparison in a conflict group |
| `rule_resolution_ambiguous` | Identical normalized identity — total order impossible |
| `rule_tenant_context_required` | Isolation required, tenant missing |
| `rule_competition_context_required` | Isolation required, competition missing |
| `rules_v2_flag_off_passthrough` | Flag OFF passthrough |

## Ambiguous resolution (`RULE_RESOLUTION_AMBIGUOUS`)

Because the comparator ends with **id ASC**, equal `sourcePriority` / `priority` / `ruleSetVersion` / `updatedAt` is **not** ambiguous when ids differ — the lower id wins.

`RULE_RESOLUTION_AMBIGUOUS` applies only when normalized identities cannot be totally ordered, e.g. conflicting rules share the **same id** (including both empty after normalize). Fail closed.

## ID tie-break

UTF-16 code-unit string order (`<` / `>`), **not** `localeCompare` — locale-independent and stable across runtimes.

## Fail-closed (Rules V2 ON)

- Missing `tenantId` when `requireTenantIsolation`
- Missing `competitionId` (or tournament fallback) when `requireCompetitionIsolation`
- Invalid rule / unsupported operation
- Ambiguous identity (`RULE_RESOLUTION_AMBIGUOUS`)

## Flag OFF

Passthrough: copy input into `selectedRules`, `feasible: true`, no new fail-closed behavior.
