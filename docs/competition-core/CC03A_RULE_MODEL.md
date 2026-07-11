# CC-03A — Canonical Rules Model

**Phase:** CC-03A | **Engine version:** `cc03a-v2` | **Date:** 2026-07-12

---

## 1. Scope

Domain-only canonical rules engine — **pure evaluation**, **no legacy runtime wiring** (CC-03B).

| Layer | Path |
|-------|------|
| Constants | `constraints/ruleConstants.js`, `constants/constraintScope.js`, `constants/ruleSetStatus.js` |
| Normalization | `constraints/normalizeRule.js`, `constraints/normalizeInput.js` |
| Context | `constraints/resolveContext.js`, `constraints/expandApplicableRules.js` |
| Pipeline | `constraints/evaluateCandidate.js` |
| Hard eval | `constraints/evaluateHardRules.js`, `constraints/validateHardConstraints.js` |
| Soft eval | `constraints/scoreSoftRules.js`, `constraints/scoreSoftConstraints.js` |
| Conflicts | `constraints/detectConflicts.js` |
| Explainability | `constraints/buildExplanation.js` |
| Versioning | `constraints/selectRuleSetVersion.js` |

---

## 2. Domain types

### ConstraintDefinition

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Required for conflict detection |
| `type` | `CompetitionConstraintTypeValue` | 19 canonical types |
| `severity` | `hard` \| `soft` | Default per type; legacy `mode` accepted |
| `enabled` | boolean | Default `true` |
| `scope` | `ConstraintScopeValue` | Optional filter |
| `applicability` | `ConstraintApplicability` | tenant/club/tournament/time filters |
| `params` | object | Type-specific |

### ConstraintContext

Resolved evaluation context: `scope`, tenant/club/tournament/event/session/venue, competition type, gender, age group, skill range, `evaluatedAt`, `teamSize`, `playersById`, history counters, lineup/entry data.

### ConstraintEvaluationResult

| Field | Meaning |
|-------|---------|
| `enabled` | Constraints V2 flag active |
| `eligible` | Entry eligibility passed |
| `feasible` | Hard constraints satisfied |
| `hardViolations` | `ConstraintExplanation[]` |
| `softScore` | Numeric total (never rejects) |
| `explanations` | Merged explainability output |
| `ruleSetId` / `ruleSetVersion` / `ruleSetStatus` | Traceability |

### ConstraintExplanation

`reasonCode`, `title`, `message`, `severity`, `affectedPlayers`, `suggestedResolution`, `details`.

### RuleSet contract

```javascript
{
  id, version, status, effectiveFrom, lockedAt,
  constraints: ConstraintDefinition[],
  metadata?: {}
}
```

`status`: `draft` | `active` | `locked` | `archived`

---

## 3. Hard constraint types

| Type | Default severity |
|------|------------------|
| `must_partner` | hard |
| `must_not_partner` | hard |
| `gender_eligibility` | hard |
| `mixed_team_composition` | hard |
| `skill_cap` | soft/hard (configurable) |
| `team_skill_difference` | soft/hard |
| `checkin_required` | hard |
| `availability_required` | hard |
| `player_not_busy` | hard |
| `lineup_validity` | hard |
| `entry_eligibility` | hard |

Hard rules return `feasible: false` — **never** simulated via large negative scores.

---

## 4. Soft constraint types

| Type | Default severity |
|------|------------------|
| `prefer_partner` | soft |
| `avoid_partner` | soft |
| `avoid_opponent` | soft |
| `same_club_separation` | soft |
| `same_organization_separation` | soft |
| `max_partner_repeat` | soft |
| `max_opponent_repeat` | soft |
| `min_rest_time` | soft |
| `skill_cap` | soft |
| `team_skill_difference` | soft |

---

## 5. Public API

```javascript
evaluateCandidate(candidate, constraintsOrRuleSet, context, options)
validateEligibility(context, constraints)
detectConstraintConflicts(constraints, context)
validateHardConstraints(candidate, constraints, context)
scoreSoftConstraints(candidate, constraints, context)
evaluateCanonicalRules(ruleSet, context, options)  // legacy envelope
preflightRuleSet(ruleSet, options)
selectRuleSetVersion(ruleSets, context)
```

Flag OFF → `{ enabled: false, feasible: true }` — zero behavior change.

---

## 6. Out of scope

- CC-03B consumer wiring (`ai/scoring.js`, pairing engines)
- CC-04 Draw Engine merge
- Production/staging migration or deploy
