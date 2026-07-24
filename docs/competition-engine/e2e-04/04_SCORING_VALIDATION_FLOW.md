# E2E-04 — Scoring and Result Validation Flow

```
Referee assigned (CORE-13 handoff)
  → acknowledgeAssignment (optional)
  → openAssignedMatch (CORE-15 START → IN_PROGRESS)
  → createScoreEntrySession (CORE-16 initial state)
  → submitScoreProjection (CORE-16 recordPoint + projection)
  → submitMatchResultForValidation (CORE-17 validateMatchResult)
       ├─ PENDING
       ├─ REJECTED
       ├─ CORRECTION_REQUIRED → resubmitCorrectedResult
       ├─ ACCEPTED (optional acceptMatchResult) → standingsEligible=true
       └─ SUPERSEDED / VOID (canonical statuses projected when present)
  → getValidatedResultState (accepted only for standings-facing visibility)
```

## Guarantees

1. No score entry unless match lifecycle is `IN_PROGRESS`.
2. No result validation without complete CORE-16 projection.
3. Facade does not compute winners for UI — uses CORE-16 `calculatedWinnerSide` only as scoring evidence into CORE-17.
4. Standings contribution flag is true only after accepted validation.
5. Player standings projection requires certified handoff with `acceptedOnly !== false`.
