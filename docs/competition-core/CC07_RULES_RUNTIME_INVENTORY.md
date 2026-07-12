# CC-07 Rules Runtime Inventory

Adapter version: `cc07-v1`

See `LEGACY_RULES_RUNTIME_INVENTORY` in `rulesRuntimeInventory.js` for the full machine-readable catalog.

## Covered domains

| Domain | Bridge | Status |
|--------|--------|--------|
| Pairing constraints | `evaluateLegacyPairingConstraints` | Wired |
| Group constraints | `evaluateLegacyGroupConstraints` | Wired CC-07 |
| AI scoring soft rules | `evaluateLegacyAiPairScore` | Wired |
| Daily Play eligibility | `evaluateLegacyDailyPlayPlayer` | Wired |
| Court queue gate | `evaluateLegacyCourtEngineQueueGate` | Wired |
| Court combination score | `evaluateLegacyCourtEngineCombinationScore` | Wired |
| Tournament draw validation | `evaluateLegacyTournamentDrawValidation` | Wired |
| Team lineup validation | `evaluateLegacyTeamLineupValidation` | Wired CC-07 |
| Captain submission | `evaluateLegacyCaptainSubmissionValidation` | Wired CC-07 |
| Referee eligibility | `evaluateLegacyRefereeMatchEligibility` | Wired CC-07 |
| Founder policy | AI policy mapper (dual path) | Partial |

## Source

`src/features/competition-core/constraints/adapters/rulesRuntimeInventory.js`
