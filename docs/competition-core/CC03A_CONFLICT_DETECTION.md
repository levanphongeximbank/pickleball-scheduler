# CC-03A — Conflict Detection

**Phase:** CC-03A | **Date:** 2026-07-12

---

## 1. API

```javascript
detectConstraintConflicts(constraints, context?)
validateRuleSetConflicts(ruleSet)
preflightRuleSet(ruleSet, { envSource, context })
```

Conflicts are detected **before** candidate evaluation when flag is ON.

---

## 2. Structural conflicts

| Code | Trigger |
|------|---------|
| `duplicate_constraint_id` | Same `id` twice |
| `invalid_constraint_params` | Missing anchor/target or invalid `maxDiff` |
| `contradictory_must_must_not` | Hard must + hard must-not on same pair |
| `contradictory_must_avoid` | Hard must-partner + hard avoid-partner |
| `unsatisfiable_must_partner` | Multiple hard must-partner targets (doubles) |
| `must_partner_component_exceeds_team_size` | Must-partner targets > `teamSize - 1` |
| `contradictory_mixed_gender` | Hard mixed composition + same-gender eligibility |
| `contradictory_skill_cap` | Conflicting skill thresholds |
| `contradictory_availability` | Check-in rule vs player unavailable in context |

---

## 3. Context-aware checks

When `context.teamSize` is provided, must-partner fan-out is validated against team capacity.

When `context.playersById` is provided, check-in vs availability contradictions are surfaced at preflight.

---

## 4. Partner pair indexing

Partner-family rules indexed by sorted pair key `playerA|playerB`.

---

## 5. Integration

Pipeline aborts before hard/soft eval when conflicts exist:

```javascript
evaluateCandidate(candidate, ruleSet, context, { envSource: v2Env })
// → { feasible: false, validation: { conflicts: [...] } }
```

Flag OFF → `preflightRuleSet` returns `{ ok: true, conflicts: [] }`.
