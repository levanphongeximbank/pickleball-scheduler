# 04 — Field Dictionary (Foundation + Profile/Contact)

| Field | Type | Notes |
|-------|------|-------|
| customerId | string | Canonical id (immutable) |
| customerNumber | string | Human-facing code (immutable) |
| tenantId | string | Required scope |
| venueId | string | Required scope |
| displayName | string | Required or derived from profile names |
| legalName | string\|null | Optional |
| individualProfile | object\|null | givenName, familyName, middleName?, preferredName? — INDIVIDUAL only |
| organizationProfile | object\|null | organizationName, tradingName? — ORGANIZATION only |
| customerType | enum | `INDIVIDUAL` \| `ORGANIZATION` (change fail-closed after create) |
| status | enum | `ACTIVE` \| `INACTIVE` \| `SUSPENDED` \| `ARCHIVED` |
| contactPoints[] | value objects | EMAIL/PHONE; primary per type among ACTIVE; see phase-2 doc |
| addresses[] | value objects | Minimal postal/business contract; one primary ACTIVE max |
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

## Contact point fields

| Field | Notes |
|-------|-------|
| contactPointId | Stable opaque id |
| type | EMAIL \| PHONE |
| normalizedValue / value | Comparison key (`value` aliases normalizedValue) |
| displayValue | Presentation |
| purpose / label | GENERAL \| BILLING \| OPERATIONS \| OTHER |
| primary | At most one ACTIVE primary per type |
| verificationState | UNVERIFIED \| VERIFIED \| FAILED \| REJECTED — no runtime verify |
| status | ACTIVE \| INACTIVE |

## Explicit exclusions

credentials, player rating, CRM pipeline fields, financial balances/debt stats.
