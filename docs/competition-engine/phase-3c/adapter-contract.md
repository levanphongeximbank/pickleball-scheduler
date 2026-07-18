# Adapter Contract — Phase 3C

## LegacyRegistrationAdapter

Map-only bridge for:

1. Legacy individual entries
2. Official BTC entries (`sourceType = OFFICIAL_BTC`)
3. Legacy team registrations

## Must

- Clone/read source without mutation
- Preserve guests
- Fail typed on unsupported kind/status/source
- Keep pair as metadata under INDIVIDUAL
- Keep captain as metadata under TEAM

## Must not

- Write database / RPC
- Update legacy registration status
- Invent competitionId
- Coerce unknown kinds/statuses
- Drop guests
- Silently ignore invalid records
- Import Participant Runtime or app registry
