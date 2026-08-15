# 02 — Master 16-contract catalog

Official Owner-approved count: **16**.

Lookup (immutable after construction):

- `getCompetitionAdapterContract(id)`
- `listCompetitionAdapterContracts()`
- `assertKnownCompetitionAdapterContract(id, version)`

Implementation: `src/features/competition-engine/integration/contracts/catalog.js`

| Ord | Name | contractId on main | version | locked | owned by this workstream | status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Identity & Access | `competition.identity-access.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 02 | Tenant & Organization | `competition.tenant-organization.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 03 | Participant | `competition.participant.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 04 | Club / Team / Membership | `competition.club-team-membership.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 05 | Rating | `competition.rating.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 06 | Ranking | `competition.ranking.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 07 | Court | `Competition Court Adapter Contract` | `1` (numeric on main) | true | **NO** | MERGED_ON_MAIN via PR #432 |
| 08 | Referee | `competition.referee.adapter.v1` | 1.0.0 | true | **NO** | MERGED_ON_MAIN via PR #431 |
| 09 | Finance & Payment | `competition.finance-payment.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 10 | Notification & Communication | `competition.notification-communication.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 11 | File & Media | `competition.file-media.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 12 | Streaming & Scoreboard | `competition.streaming-scoreboard.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 13 | Federation & External Authority | `competition.federation-external-authority.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 14 | CRM & Sponsor | `competition.crm-sponsor.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 15 | Analytics & Reporting | `competition.analytics-reporting.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |
| 16 | Audit | `competition.audit.adapter.v1` | 1.0.0 | true | YES | LOCKED_V1 |

## Court identity (do not rename)

PR #432 is merged. The frozen identity on main is **not** rewritten to `competition.court.adapter.v1`. Catalog lookup uses the existing name `Competition Court Adapter Contract` / version `1`.

Import path: `src/features/competition-core/contracts/competitionCourtAdapterContract.js`

## Referee identity (do not rename)

Import path: `src/features/competition-engine/integration/referee/constants.js`

`contractId = competition.referee.adapter.v1`
