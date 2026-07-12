# CC-08 — Shadow Parity

Module: `standings/adapters/standingsShadowParity.js`

`runStandingsShadowComparison()` / `buildStandingsShadowComparison()` compare:
- entry membership
- rank order
- competition points
- qualification parity flags
- tie-break parity flags

Reports: membershipParity, rankParity, pointsParity, statisticsParity, qualificationParity, tieBreakParity, mismatches, unsupportedLegacyBehavior, contextMissing, legacyInstabilityDetected.

Business output remains legacy in shadow mode. Legacy executor invoked at most once per comparison.
