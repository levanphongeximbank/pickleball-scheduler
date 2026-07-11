# CC-03 — Current State Audit (Rules & Constraints)

Phase: **CC-03** | Date: 2026-07-12 | **Audit only — no behavior change**

Owner GO received. This document inventories existing rule/constraint logic before building the unified Rules & Constraints Engine.

---

## Pre-flight (2026-07-12)

| Check | Result |
|-------|--------|
| Branch | `feature/competition-core-standardization` ✅ |
| HEAD | `a225b96` — CC-02D latest ✅ |
| Remote sync | `0 ahead / 0 behind` origin ✅ |
| Stash | `wip-before-competition-core-cc02-2026-07-11` intact ✅ |
| TT1B/team-tournament in scope | Not touched ✅ |
| Production flags | OFF (no rollout) ✅ |
| Production migration | NOT APPLIED ✅ |

**Verdict:** **GO** for CC-03 audit + implementation work.

---

## Executive summary

| Finding | Severity |
|---------|----------|
| **Three parallel constraint systems** (pairing-constraints, AI scoring/policy, tournament validation) | HIGH |
| **Hard constraints simulated via large negative scores** (`-100`, `-120`) in AI Core | HIGH |
| **Founder hard avoid → AI policy penalty**, not elimination | HIGH |
| **`must_partner` / `must_not_partner` defined in CC-01 only — no runtime** | MEDIUM |
| **`checkin_required` / `availability_required` / `skill_cap` — types only, no engine** | MEDIUM |
| **Same club/org separation = soft penalties** in open draw, not hard reject | MEDIUM |
| **No unified conflict detection** before engine runs | HIGH |
| **No rule set versioning** on constraints (CC-01 types exist) | MEDIUM |

CC-03 target: single engine with **hard = reject**, **soft = score**, **conflict pre-check**, **ruleSetVersion**, behind feature flag.

---

## Audit table

```text
rule/constraint                          | file(s)                                              | current severity     | current implementation                          | current score/penalty              | current consumers                                      | risk                                      | future canonical type
-----------------------------------------|------------------------------------------------------|----------------------|-----------------------------------------------|------------------------------------|--------------------------------------------------------|-------------------------------------------|----------------------------
prefer_partner                           | pairing-constraints/constants.js                     | hard OR soft         | swap optimizer + evaluator violations         | +120 match / -40 miss (soft)       | teamPairingEngine, Internal/Official setup, tests      | hard prefer unmet → violation not swap    | PREFER_PARTNER (soft default)
avoid_partner                            | pairing-constraints/constants.js                     | hard OR soft         | fixAvoidPartner swaps + evaluator             | -200 soft penalty                | teamPairingEngine, FounderPairingConstraintsPanel        | hard may remain violated after attempts   | AVOID_PARTNER
avoid_same_group                         | pairing-constraints/constants.js                     | hard OR soft         | assignGroupsWithConstraints donor moves       | -250 soft penalty                | constraintGroupEngine, official draw                   | soft allows same-group                    | SAME_CLUB_SEPARATION (group scope)
must_partner                             | competition-core/constants/constraintType.js         | (defined only)       | JSDoc + contract tests — **no runtime**       | n/a                                | none                                                   | gap vs founder prefer hard                | MUST_PARTNER
must_not_partner                         | competition-core/constants/constraintType.js           | (defined only)       | JSDoc + contract tests — **no runtime**       | n/a                                | none                                                   | gap vs avoid hard                         | MUST_NOT_PARTNER
prefer_teammate (AI policy)              | ai/scoring.js, ai/policy.js                          | soft (always score)  | calculatePolicyScore bonus/penalty              | +15 same team / -15 opposite       | AI pairing engine via context.policies                 | founder hard avoid not blocking prefer    | PREFER_PARTNER (policy adapter)
avoid_teammate (AI policy)               | ai/scoring.js, courtPolicyAdapter.js                 | **soft penalty**     | subtract from policyScore; HIGH = -120        | -35 MEDIUM / **-120 HIGH**         | SelectPlayers, AI engine, scoring tests                | **hard avoid simulated by -120**          | AVOID_PARTNER (must reject when hard)
founder → avoid_teammate mapping         | pairing-constraints/adapters/courtPolicyAdapter.js   | maps hard→HIGH       | converts founder constraints to AI policies   | inherits AI penalties              | SelectPlayers (founderConstraints → policies)          | **dual path** pairing vs AI               | legacy adapter → CC-03 bridge
team level diff limit                    | ai/scoring.js (calculateRuleScore)                   | **soft penalty**     | rule type team_level_diff_limit               | default -20 per breach             | club rules in AI context                               | should be hard reject for strict caps     | SKILL_CAP (team aggregate)
level diff > threshold (pairing)         | ai/scoring.js (calculatePairScore)                   | **hard (reject)**    | early return totalScore = -100                | **-100** (largeLevelDiff)          | AI pairing candidate ranking                           | correct reject but via negative score     | SKILL_CAP / team_balance (hard)
max_partner_repeat                       | ai/scoring.js                                        | soft                 | rule penalty per excess repeat                | -12 × excess (default)             | AI context.rules                                       | soft only                                 | AVOID_PARTNER (repeat window)
max_opponent_repeat                      | ai/scoring.js                                        | soft                 | rule penalty per excess                       | -10 × excess (default)             | AI context.rules, scoring.test.js                      | soft only                                 | avoid_opponent (soft)
mixed pair requirement (scheduling)      | ai/competition.js, ai/scoring.js                     | soft                 | requiresMixedPairs → competitionScore penalty | -25 per non-mixed team             | SelectPlayers validate + AI score                      | validation hard at selection; score soft  | GENDER_ELIGIBILITY + mixed doubles
gender eligibility (event type)          | tournament/engines/validationEngine.js               | **hard (validation)**| validateEntryForEvent gender checks           | error messages (no score)          | draw validation, registration, tests                   | correct pattern — pre-engine reject       | GENDER_ELIGIBILITY
gender filter (pairing)                  | tournament/engines/teamPairingEngine.js              | hard (filter)        | filterPlayersForEventType                     | n/a                                | suggestEntriesFromPlayers, daily/internal              | pre-filter not constraint object          | GENDER_ELIGIBILITY
mixed doubles pairing                    | teamPairingEngine.createMixedPairsFromPlayers        | hard (algorithm)     | snake M/F pairing                             | n/a                                | internal/official entry suggestion                     | not expressed as constraint               | GENDER_ELIGIBILITY (mixed)
open_double (no gender check)            | validationEngine.js                                  | hard (validation)    | count=2 only                                  | n/a                                | open doubles registration                              | OK                                        | GENDER_ELIGIBILITY (open)
same club separation (open draw)         | openConditionalRandomEngine.js                       | **soft penalty**     | calculatePlacementPenalty same club           | +12 per same-club entry in group   | official open draw                                     | **not hard** — can overload groups        | SAME_CLUB_SEPARATION
same organization/unit separation        | openConditionalRandomEngine.js                       | **soft penalty**     | unit match penalty                            | +8 per same unit                   | official open draw splitUnits                          | soft                                      | SAME_ORGANIZATION_SEPARATION
host/visitor clustering                  | openConditionalRandomEngine.js                       | soft                 | placement penalty                             | +6 host / +4 visitor               | official open draw                                     | soft                                      | club policy (soft)
group overflow penalty                   | openConditionalRandomEngine.js                       | soft                 | score += 1000 forced placement                | +1000                              | open draw attempts                                     | emergency overflow not hard fail          | draw feasibility (hard in CC-03)
duplicate player in event                | validationEngine.js                                  | **hard**             | validateNoDuplicatePlayersInEvent             | errors                             | validateGroupDrawInput                                 | OK pattern                                | eligibility (duplicate)
draw input validation                    | validationEngine.js                                  | **hard**             | validateGroupDrawInput errors                 | n/a                                | tournament setup flows                                 | OK                                        | pre-flight validation
competition selection validation         | ai/competition.js                                    | **hard**             | validateCompetitionSelection                  | errors                             | SelectPlayers, ai/normalize.js                         | OK — pre-engine                           | eligibility (session)
check-in required (queue)                | court-engine/services/queueService.js                | **hard (gate)**      | reject if not checked in                      | error string                       | court engine queue                                     | not unified constraint type               | CHECKIN_REQUIRED
check-in (mobile/PWA)                    | features/mobile/services/checkInService.js           | operational          | QR token flow                                 | n/a                                | mobile check-in dashboard                              | separate from pairing                     | CHECKIN_REQUIRED (integration)
availability (court bookings)            | pages/courtManagement/CourtAvailabilityPanel.jsx       | UI/config            | booking panel                                 | n/a                                | court management                                       | not wired to pairing                      | AVAILABILITY_REQUIRED
avoid partner repeat (court engine)      | autoCourtAssignmentEngine.js                         | soft                 | countRecentPartners × 15                      | -15 per repeat                     | court engine auto assign                               | soft scoring                                | AVOID_PARTNER (repeat)
avoid opponent repeat (court engine)       | autoCourtAssignmentEngine.js                         | soft                 | countRecentOpponents × 10                     | -10 per repeat                     | court engine                                           | soft                                        | avoid_opponent (soft)
max level diff (court engine)            | autoCourtAssignmentEngine.js                         | soft                 | scoreTeamBalance penalty                      | (diff-max)×30                      | court engine                                           | soft overflow penalty                       | SKILL_CAP
founderPairingConstraints storage        | domain/clubStorage.js, pairingConstraintService.js     | data                 | club + tournament blob field                  | n/a                                | Official/Internal setup UI                               | no version field                            | RuleSet v1 payload
CONSTRAINT_MODE hard/soft                | pairing-constraints/constants.js                     | enum                 | mode on legacy constraint records             | n/a                                | all pairing-constraints engines                          | maps to severity not error codes          | CONSTRAINT_SEVERITY
CONSTRAINT_SCORE constants               | pairing-constraints/constants.js                     | soft weights         | numeric bonuses/penalties                     | 120/40/200/250                     | constraintEvaluator                                    | magic numbers                             | CC-03 scored constraint defs
rating eligibility (match)               | competition-core/rating/isMatchRatingEligible.js     | hard/review          | BYE/daily/forfeit policy                      | n/a                                | rating V2 (CC-02)                                      | separate domain — reference pattern         | eligibility (match result)
forfeit subtypes                         | isMatchRatingEligible.js                             | hard/review          | CC-02C policy matrix                          | n/a                                | rating only                                              | pattern for explicit codes                  | REQUIRES_REVIEW status
schedule team/court conflict             | ai-assistant/engines/scheduleValidator.js             | advisory             | issue list team_conflict/court_conflict       | n/a                                | AI assistant validateSchedule                          | not blocking draw/pairing                 | conflict detection (reference)
pairing constraint evaluation.ok         | constraintEvaluator.js                               | hard gate            | hardViolations.length === 0                   | score sum                          | constraintPairingEngine, constraintGroupEngine         | returns ok but may still output bad teams | validate → reject pattern
AI candidate ranking                     | ai/pairing.js                                        | soft aggregate       | sort by totalScore                            | weighted average                   | runPairingEngine                                       | hard=-100 still in candidate list         | filter infeasible first (CC-03)
ruleSetVersion (types only)              | competition-core/types/index.js, engineContracts.js  | **not enforced**     | JSDoc ConstraintDefinition.ruleSetVersion     | n/a                                | CC-01 contracts/tests only                               | versioning gap                              | ruleSetVersion required CC-03
constraint conflict (types only)         | competition-core/contracts/engineContracts.js        | **not enforced**     | createConstraintConflict helper               | n/a                                | contracts tests                                        | no detector yet                           | conflictDetectionEngine (CC-03)
```

---

## System map (consumers)

```text
Ghép đội / trận (tournament)
  └── teamPairingEngine.js → optimizeTeamsWithConstraints
  └── validationEngine.js → pre-draw hard validation
  └── openConditionalRandomEngine.js → club/unit soft penalties

Xếp sân AI (session)
  └── ai/pairing.js → ai/scoring.js (level diff hard via -100)
  └── ai/competition.js → validateCompetitionSelection
  └── courtPolicyAdapter → AI policies from founder constraints

Chia bảng
  └── constraintGroupEngine.js → avoid_same_group
  └── openConditionalRandomEngine.js → same club/org

Daily Play
  └── dailyPlayEngine.js → maps to doubles_mixed competition type
  └── validation via tournament mode paths

Court Engine (queue)
  └── queueService.js → check-in gate
  └── autoCourtAssignmentEngine.js → repeat/level soft scores

CC-01 foundation (not wired)
  └── competition-core/constants/constraintType.js (10 types)
  └── competition-core/constants/constraintSeverity.js
  └── engineContracts.js (ConstraintDefinition, ConstraintConflict)
```

---

## CC-03 design implications (from audit)

1. **Unify severity:** Replace `-100`/`-120` rejection-via-score with explicit `INFEASIBLE` + error codes.
2. **Bridge legacy:** `pairing-constraints` → `ConstraintDefinition` adapter; `courtPolicyAdapter` → deprecated path behind flag.
3. **Pre-flight:** `detectConstraintConflicts(ruleSet)` before any optimizer runs (must_partner cycles, contradictory hard avoids, etc.).
4. **Rule set versioning:** Persist `ruleSetId` + `ruleSetVersion` on tournament/club; CC-03 engine reads versioned defs.
5. **Do not merge Draw Engine** (CC-04 scope) — CC-03 exposes validation API draw engines call.
6. **Feature flag:** `VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED` (or reuse core master) — OFF = legacy paths unchanged.

---

## Out of scope (CC-03)

- Draw Engine merge (CC-04)
- Production deploy / migration
- TT1B / team-tournament module changes
- Changing tournamentLifecycle sync paths without flag

---

## Next steps (CC-03 implementation)

1. `src/features/competition-core/constraints/` — rule model, error codes, conflict detector, evaluator, scorer split.
2. Legacy adapters from `pairing-constraints` + `ai/scoring` policy slice.
3. Tests: hard reject, soft score, conflict detection, flag OFF regression.
4. Docs: `CC03_RULE_MODEL.md`, `CC03_CONFLICT_DETECTION.md`, `CC03_LEGACY_ADAPTER.md`, `CC03_TEST_REPORT.md`.

Production migration: **NOT APPLIED**  
Production deploy: **NOT ALLOWED**  
Feature flags production: **OFF**  
CC-04: **NOT STARTED**
