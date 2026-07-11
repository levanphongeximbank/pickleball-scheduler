# CC-03A — Conflict Detection

**Phase:** CC-03A | **Date:** 2026-07-12

---

## 1. Purpose

Detect **structural** rule-set conflicts **before** candidate evaluation — prevents optimizers from running on unsatisfiable constraint sets.

Entry points:

- `detectConstraintConflicts(ruleSet)` — returns conflict array
- `validateRuleSetConflicts(ruleSet)` — `{ ok, conflicts }`
- `preflightRuleSet(ruleSet, { envSource })` — flag-gated preflight
- `evaluateCanonicalRules()` — auto-runs conflict check unless `skipConflictCheck: true`

---

## 2. Detected conflict types

| Code | Trigger |
|------|---------|
| `duplicate_constraint_id` | Same `id` appears twice |
| `invalid_constraint_params` | Partner rule missing anchor/target |
| `contradictory_must_must_not` | Hard must + hard must-not on same pair |
| `contradictory_must_avoid` | Hard must-partner + hard avoid-partner on same pair |
| `unsatisfiable_must_partner` | One anchor with multiple hard must-partner targets |

---

## 3. Partner pair indexing

Partner-family constraints (`must_partner`, `must_not_partner`, `prefer_partner`, `avoid_partner`) are indexed by sorted pair key:

```
pairKey("1", "2") → "1|2"
```

Conflicts compare constraints sharing the same anchor↔target pair.

---

## 4. Hard-only structural checks

Conflict detection applies to **hard** severity partner rules only for contradiction/unsatisfiability checks. Soft rules do not create structural conflicts at preflight (they score at evaluation time).

---

## 5. Integration with evaluation

When conflicts exist and flag is ON:

```javascript
evaluateCanonicalRules(ruleSet, context, { envSource: v2Env })
// → { enabled: true, feasible: false, validation: { ok: false, conflicts: [...] } }
```

Hard/soft evaluators are **not** invoked when preflight fails.

When flag is OFF:

```javascript
preflightRuleSet(ruleSet, { envSource: {} })
// → { ok: true, conflicts: [] }
```

---

## 6. Error code reference

Full list in `constraints/ruleConstants.js` → `RULE_ERROR_CODE`.

Evaluation-time hard violations (not preflight):

- `must_partner_unsatisfied`
- `must_not_partner_violated`
- `avoid_partner_violated`
- `gender_eligibility_violated`
- `skill_cap_exceeded`
- `checkin_required_missing`
- `availability_required_missing`
- `same_club_separation_violated`
- `same_organization_separation_violated`

Soft scoring uses `RULE_SOFT_SCORE` weights — violations produce penalties in `softScore`, not `feasible: false` (unless severity upgraded to hard).
