# Phase 0 — Current Rules Duplication Map

## EXISTING_CORE01_FOUNDATION_FOUND=YES

Paths: `src/features/competition-core/constraints/**`

## Classification summary

| Concept | Classification | Notes |
|---------|----------------|-------|
| Constraint authority / resolution | REUSE | CORE-01 |
| Match scoring format | EXTEND + COMPOSE | CORE-16 format + Team stageScoringPolicy |
| Win condition | REUSE | CORE-16 winConditions |
| Change-end | COMPOSE | policy SUPPORTED; execution PARTIAL (CE confirmChangeEnds path; referee-v5 hint-only) |
| Group stage | COMPOSE | CE pool + CORE draw |
| Qualification total/direct/wildcard | NEW_SHARED_POLICY | slot derivation; CE has TOP_N only |
| In-group tie-break | REUSE policy→CORE-18 | CORE-18 execution |
| Cross-group wildcard ranking | NEW_SHARED_POLICY | policy SUPPORTED; execution DEFERRED; configured only when wildcardSlots > 0 |
| Knockout policy | COMPOSE | CE + Team KO engines |
| Walkover/retired/withdrawal | COMPOSE | CORE-18 types + CORE-17 |
| Check-in | SHARED_BASE_WITH_MODE_EXTENSION | policy shared; ops mode-specific |
| Schedule constraints | EXTEND | policy only; schedule-engine / CORE-11 execution |
| Court requirement | EXTEND | policy = competition-rules; assignment = CORE-12; physicalCourtId SSOT = 2.2_COURT_OPERATIONS |
| Referee requirement | EXTEND | policy only; CORE-13 assignment authority |
| Publication | COMPOSE | CM publication |
| Lifecycle locks | NEW_SHARED_POLICY | gate API; CORE-15 evidence |

## Duplication to collapse later via Adapter B

- Team `teamStageScoringPolicy.js` / `teamQualificationProgression.js`
- Individual `qualifiersPerGroup` cuts
- Referee Adapter B `scoringRulesMapper.js` mode defaults
- CM-04 dormant configuration sections

This workstream provides the shared policy SSOT surface; mode cutover is Adapter B.
