# Source Audit Summary — Phase 3C

Full audit delivered in capability chat before Owner GO.

## Legacy SSOT

| Format | SSOT |
|--------|------|
| Individual / Internal / Official entries | Club blob `events[].entries` + `settings.registration` |
| Team | Blob ± `team_tournament_teams` |
| Canonical Registration | Derived mapping only (pre-3C adapters); now also Registration Runtime |

## Statuses mapped

Legacy lowercase → canonical UPPERCASE. Unknown → typed `UNSUPPORTED_REGISTRATION_STATUS`.
Owner: Legacy `active` → `APPROVED`.

## Kinds (Owner-locked)

- `INDIVIDUAL` — entry registration (singles/doubles pair = metadata)
- `TEAM` — team registration

## Source types

- `LEGACY_INDIVIDUAL_ENTRY`
- `LEGACY_TEAM_REGISTRATION`
- `OFFICIAL_BTC`

## Identity risks addressed

Deterministic key `competitionId::registrationKind::stableSourceIdentity`; collision refuses overwrite; no timestamp/random identity.
