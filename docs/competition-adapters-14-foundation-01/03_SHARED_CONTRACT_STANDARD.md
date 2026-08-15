# 03 — Shared contract standard

Kernel: `src/features/competition-engine/integration/contracts/kernel/`

Every owned contract exposes immutable metadata:

- `contractId`
- `contractVersion` = `1.0.0`
- `locked` = `true`
- `domain`
- `authorityOwner`
- `direction`
- `capabilities`
- `requiredContext`
- `requiredMethods`
- `forbiddenMethods`
- `forbiddenAuthorityKeys`
- `errorCodes`
- `runtimeClassification`

## Request context

Always-available concepts: `contractVersion`, `tenantId`, `competitionId`, `correlationId`.

Actor-sensitive: `actorId`.

When applicable: `organizationId`, `clubId`, `teamId`, `participantId`, `matchId`, `sourceVersion`, `snapshotId`, `effectiveAt`, `venueId`.

Mutations/commands (only where domain semantics require): `expectedVersion`, `idempotencyKey`.

Read-only/public operations do not invent actor requirements. Tenant-sensitive operations fail closed.

## Evidence / snapshot response

`sourceSystem`, `sourceVersion`, `snapshotId`, `effectiveAt`, `retrievedAt`, `data`, `status`, `reasonCodes`.

`retrievedAt` is caller-supplied when present. The kernel does not invent wall-clock time.

Competition may retain evidence references. It must not silently copy ownership of external master data.

## Fail-closed taxonomy

Shared codes:

- `UNKNOWN_CONTRACT`
- `INCOMPATIBLE_CONTRACT_VERSION`
- `MALFORMED_ADAPTER`
- `MISSING_REQUIRED_CONTEXT`
- `CROSS_TENANT_CONTEXT`
- `MISSING_CANONICAL_IDENTITY`
- `FORBIDDEN_AUTHORITY`
- `NOT_CONFIGURED`
- `CAPABILITY_NOT_SUPPORTED`
- `STALE_WRITE`
- `MISSING_IDEMPOTENCY`
- `MALFORMED_RESPONSE`

`NOT_CONFIGURED` is never turned into empty-success when that could alter a competition decision.

## Direction

- `INBOUND_QUERY` — Competition asks an external domain
- `OUTBOUND_COMMAND` — Competition requests an action in an external domain
- `OUTBOUND_EVENT` — Competition publishes an already-occurred fact
- `MIXED` — audit append + query
