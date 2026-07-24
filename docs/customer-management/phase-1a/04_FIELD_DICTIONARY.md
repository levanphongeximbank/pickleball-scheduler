# 04 — Field Dictionary (Foundation)

| Field | Type | Notes |
|-------|------|-------|
| customerId | string | Canonical id |
| customerNumber | string | Human-facing code |
| tenantId | string | Required scope |
| venueId | string | Required scope |
| displayName | string | Required |
| legalName | string\|null | Optional |
| customerType | enum | `INDIVIDUAL` \| `ORGANIZATION` |
| status | enum | `ACTIVE` \| `INACTIVE` \| `SUSPENDED` \| `ARCHIVED` |
| contactPoints[] | value objects | EMAIL/PHONE; one primary max |
| locale | string\|null | Optional language preference |
| accountLinkage | `{ userAccountId }`\|null | Identity reference |
| playerLinkage | `{ playerId }`\|null | Player reference |
| organizationLinkage | `{ organizationId }`\|null | Org reference |
| classification[] | `{ kind, code }` | Controlled classification |
| segmentReferences[] | `{ segmentId, source? }` | Opaque CRM/marketing refs |
| tags[] | string[] | Controlled lowercase tags |
| communicationPreferences[] | channel+state | Business contract |
| consentReferences[] | refs | Not governance engine |
| metadata | object | Banned secret/balance keys |
| createdAt / updatedAt | ISO string | Clock-injectable |
| version | integer ≥ 1 | Optimistic concurrency |

## Explicit exclusions

credentials, player rating, CRM pipeline fields, financial balances/debt stats.
