# E2E-03 — Organizer Runtime Flow

```text
Resolve competition (tenantId + competitionId)
  → authorize (E2E-01 Identity evidence + CORE-02)
  → prepareCompetitionOperations
  → inspect eligibility / entry statuses
  → lockParticipantField (fail if pending/ineligible/invalid)
  → preparePoolStage (E2E-02 createPoolKnockoutRuntimeComposition)
  → prepareOperationalSchedule (CORE-11 or certified handoff)
  → confirmCourtAssignments (CORE-12 or confirmed handoff; venue-scoped)
  → publishOperationalPlan (ops publication + optional CM-06 readiness)
  → openCheckIn → (marks) → closeCheckIn
  → openMatchOperations (no score / no winner inference)
  → optional suspendMatchOperations / resumeMatchOperations
  → syncMatchOperationalStatuses from canonical lifecycle projections
  → activateKnockoutStage (qualification ready; unresolved tie fail-closed)
  → completeCompetitionOperations (no active/incomplete matches)
  → publishFinalCompetitionResult
  → requestArchiveReadiness (CM-08 eligibility optional; no direct archive mutate)
```

## Ownership

| Layer | Owner |
|-------|-------|
| Orchestration / projection / auth mapping | E2E-03 `competition-engine/operations` |
| Template + Pool→KO composition | E2E-02 (import only) |
| Integration ports | E2E-01 (import only) |
| Engines (schedule, court, match, standings, …) | Competition Core (import only) |
| Publication / archive state machines | CM-06 / CM-08 (import only; handoff) |
