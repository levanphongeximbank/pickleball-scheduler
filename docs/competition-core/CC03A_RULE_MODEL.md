# CC-03A — Canonical Rules Model

**Phase:** CC-03A | **Parent:** CC-03 audit | **Date:** 2026-07-12

---

## 1. Scope

Foundation-only canonical rules engine — **no runtime wiring** to legacy pairing/scoring consumers (CC-03B).

| Component | Path |
|-----------|------|
| Constants | `constraints/ruleConstants.js` |
| Normalization | `constraints/normalizeRule.js` |
| Conflict detection | `constraints/detectConflicts.js` |
| Hard evaluation | `constraints/evaluateHardRules.js` |
| Soft scoring | `constraints/scoreSoftRules.js` |
| Entry point | `constraints/evaluateCanonicalRules.js` |
| Barrel | `constraints/index.js` |

**Engine version:** `cc03a-v1`

---

## 2. RuleSet shape

```javascript
{
  id: "competition-core-default",   // DEFAULT_RULE_SET_ID
  version: "1",                     // DEFAULT_RULE_SET_VERSION
  constraints: [ /* ConstraintDefinition[] */ ],
  metadata?: {}
}
```

Factory: `createRuleSet(partial)` — fills defaults and normalizes each constraint via `normalizeRuleDefinition()`.

---

## 3. ConstraintDefinition (canonical)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Required for conflict detection |
| `type` | `COMPETITION_CONSTRAINT_TYPE` | Canonical or legacy alias |
| `severity` | `hard` \| `soft` | Defaults from type map; legacy `mode` also accepted |
| `enabled` | boolean | Default `true`; `false` skips rule |
| `params` | object | Type-specific (see below) |

### Supported constraint types

| Type | Default severity | Params |
|------|------------------|--------|
| `must_partner` | hard | `anchorPlayerId`, `targetPlayerIds[]` |
| `must_not_partner` | hard | same |
| `prefer_partner` | soft | same |
| `avoid_partner` | soft | same |
| `gender_eligibility` | hard | `eventType` (default `mixed_double`) |
| `skill_cap` | soft | `maxDiff` (default `0.5`) |
| `checkin_required` | hard | player scope |
| `availability_required` | hard | player scope |
| `same_club_separation` | soft | club/org grouping |
| `same_organization_separation` | soft | club/org grouping |

### Legacy aliases

| Legacy | Canonical |
|--------|-----------|
| `avoid_same_group` | `same_club_separation` |
| `avoid_teammate` | `avoid_partner` |
| `prefer_teammate` | `prefer_partner` |

Legacy `mode: "hard"` / `mode: "soft"` maps to `severity`.

---

## 4. Evaluation pipeline

```
normalizeRuleSet(ruleSet)
  → validateRuleSetConflicts (preflight)
  → evaluateHardRules(constraints, context)   // feasible / infeasible
  → scoreSoftRules(constraints, context)      // numeric bonus/penalty only
```

### Hard vs soft separation (CC-03A design)

| Layer | Behavior |
|-------|----------|
| **Hard** | Returns `feasible: false` + `RULE_ERROR_CODE` — **never** uses large negative scores |
| **Soft** | Returns `softScore` + breakdown — **never** rejects a candidate |

This replaces the legacy pattern of simulating hard constraints via `-100` / `-120` penalties in AI scoring.

---

## 5. Evaluation context

```javascript
{
  scope: "pairing" | "match" | "draw",
  teams?: string[][],           // pairing scope
  matchOption?: { teamA, teamB }, // match scope
  playersById?: Record<string, Player>,
  checkedInPlayerIds?: string[],
  availablePlayerIds?: string[],
}
```

---

## 6. Result envelope

`evaluateCanonicalRules()` returns:

| Field | Meaning |
|-------|---------|
| `enabled` | Constraints V2 flag active |
| `feasible` | Hard rules satisfied |
| `validation` | `EngineValidationResult` (ok, errors, conflicts) |
| `hardViolations` | `EngineExplanation[]` |
| `softScore` | Numeric total |
| `softBreakdown` | Per-rule score components |
| `softNotes` | Non-blocking soft observations |
| `engineVersion` | `cc03a-v1` |
| `ruleSetId` / `ruleSetVersion` | Traceability |

When flag **OFF**: `{ enabled: false, feasible: true }` — zero behavior change.

---

## 7. Public API

Exported from `src/features/competition-core/index.js`:

- `createRuleSet`, `normalizeRuleSet`, `normalizeRuleDefinition`
- `detectConstraintConflicts`, `preflightRuleSet`
- `evaluateCanonicalRules`, `evaluateHardRules`, `scoreSoftRules`
- `RULE_ERROR_CODE`, `RULE_ENGINE_VERSION`, `RULE_SOFT_SCORE`

---

## 8. Out of scope (CC-03B+)

- Wiring to `teamPairingEngine`, `ai/scoring.js`, `pairing-constraints`
- Draw Engine merge (CC-04)
- Production/staging migration
- Feature flag ON in production
