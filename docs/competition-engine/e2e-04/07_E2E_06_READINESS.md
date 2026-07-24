# E2E-04 → E2E-06 Readiness

## Ready for E2E-06 consumers

- Player operations projection contract (fingerprint, allowed/denied actions, check-in mark)
- Referee assignment + validation status projection
- Accepted-result-only standings eligibility flag
- Presentation section builders for portal composition

## Still deferred

- Full production portal page rewiring
- Notification delivery
- Public Experience (owned by E2E-05)
- SQL / staging / production deploy
- Team-tournament-specific referee workflows beyond adapter needs

## Contract freeze recommendation

After E2E-04 merge, treat Player/Referee facade method names + error codes + projection fields as frozen for E2E-06 integration tests.
