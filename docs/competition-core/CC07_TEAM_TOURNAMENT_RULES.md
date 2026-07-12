# CC-07 Team Tournament Rules

## Bridges

| Flow | Function |
|------|----------|
| Lineup validation | `evaluateLegacyTeamLineupValidation` |
| Captain submission | `evaluateLegacyCaptainSubmissionValidation` |
| Referee eligibility | `evaluateLegacyRefereeMatchEligibility` |

## Wiring

`lineupValidationEngine.validateLineupSelectionsStructured` — flag OFF uses legacy TT-2C validation unchanged; flag ON adds canonical audit path.

## TT-2/TT-3 safety

Workflow, RPC, and publish semantics unchanged when Rules V2 OFF.
