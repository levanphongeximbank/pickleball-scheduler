# CM-08 Competition Archive

## Purpose

Canonical Competition Management capability for **whole-competition archive** and
explicit **unarchive**. Capability-local / dormant — does not replace transitional
`tournamentService` production runtime or execute retention, storage, publication,
or definition mutations.

## Canonical ownership

CM-08 owns:

- `CompetitionArchiveRecord` and linear history
- archive revision (monotonic per tenant + competition)
- effective states: `UNARCHIVED`, `ARCHIVED`
- archive / unarchive commands
- reason codes, actor, authority decision
- source provenance + deterministic manifest
- optimistic concurrency (`expectedArchiveRevision`)
- idempotency
- deterministic operational effect plans (proposal-only)
- integration intents
- typed errors
- repository port + capability-local in-memory repository
- read-only legacy archive observation projector

## Distinctions

| Concept | CM-08 | Not CM-08 |
|---------|-------|-----------|
| Archive decision | Canonical record + manifest | Legacy `archived` flag alone |
| Soft delete | Not owned | db-storage / delete flows |
| Purge | Not owned | Retention execution |
| Cancel | CM-07 lifecycle | Not automatic archive |
| Complete | Finalization evidence only | Not automatic archive |
| Unpublish | Publication context reference | CM-06 mutation |

## Archive states

| State | Meaning |
|-------|---------|
| `UNARCHIVED` | No archive record, or unarchived |
| `ARCHIVED` | Archived per latest record |

Initial projection with no record: `UNARCHIVED` (revision `0`). First successful
archive creates revision `1`.

### Transitions

- `UNARCHIVED` → `ARCHIVED` (archive)
- `ARCHIVED` → `UNARCHIVED` (unarchive, when policy allows)

## Archive eligibility

Requires: tenantId, competitionId, definition + expectedDefinitionRevision,
archivePolicyProfile (or archivePolicyId), expectedArchiveRevision,
versionContext (PRESENT), publicationContext (PRESENT or ABSENT),
lifecycleContext and/or completionContext, actor, authority ALLOWED,
archive reason, effectiveAt/clock, idempotencyKey, explicit repository.

Optional: configurationContext, brandingContext.

Policy gates:

- `CM08_STANDARD_FINALIZED_V1` — CANCELLED lifecycle or completed with evidence
- `CM08_EXCEPTIONAL_ADMIN_V1` — elevated archive authority; broader lifecycle

Operational guards block archive when pending publication, active recovery, or
unresolved critical operations are flagged.

`retentionAcknowledged: true` required when policy demands it.

## Unarchive

Requires: tenantId, competitionId, current ARCHIVED record (from repository),
expectedArchiveRevision, definition + expectedDefinitionRevision,
publicationContext, archivePolicyProfile allowing unarchive, elevated authority
(when policy requires), unarchive reason, actor, authority, effectiveAt,
idempotencyKey, explicit repository.

Does **not** re-validate finalization. `versionContext` optional (ABSENT ok).

## Policy profiles

Explicit `archivePolicyProfile` — no hidden default.

| Profile | Notes |
|---------|-------|
| `CM08_STANDARD_FINALIZED_V1` | Finalized competitions; retention ack; elevated unarchive |
| `CM08_EXCEPTIONAL_ADMIN_V1` | Admin archive of ACTIVE/SUSPENDED; elevated archive + unarchive |

Policies never authorize delete, purge, or auto-archive.

## Reason model

Stable codes for archive / unarchive. `OTHER` requires detail ≥ 8 chars.
Control characters and HTML/script rejected. Unknown codes rejected.

## Actor / authority

Explicit actor (`actorId`, `actorType`, `tenantId`) and authority decision
(`ALLOWED`/`DENIED`, policy id/version, decisionReference). Denied or missing
authority → fail closed. No RBAC lookup inside CM-08. No tokens/secrets stored.

Elevated markers: `ELEVATED_ARCHIVE`, `ELEVATED_UNARCHIVE` per policy.

## Source provenance

Captures definition revision, version identity, configuration/branding revisions,
publication presence or absence, lifecycle/completion finalization evidence,
prior archive revision, policy refs, idempotency fingerprint, effectiveAt.
Never infers “latest” publication or version.

## Archive revision / concurrency

Monotonic per tenant+competition. `expectedArchiveRevision` required
(`0` or `null` before first record). Stale → typed conflict. Failed commands
do not increment revision.

## Idempotency

Same key + same semantic fingerprint → replay. Same key + different semantics
→ `CM08_IDEMPOTENCY_CONFLICT`. No duplicate records/intents on retry.

## Manifest

Deterministic metadata summary (`cm08-archive-manifest-v1`). Includes archive
identity, source refs, finalization summary, publication/version/config/branding
refs, reason, policy, actor/authority refs (no secrets), effectiveAt,
retention classification metadata (classification only), integration intent
types, content fingerprint. Forbidden secret/dump markers rejected.

## Effect plan

Proposal-only intents (`executionStatus=PROPOSED`, `executed=false`, `proposedOnly=true`):

**Archive:** CM01 archived status patch, publication archive visibility review,
public directory removal review, registration/schedule read-only review,
analytics archive classification, search index visibility review, data/storage
retention review (review only), notification, audit event.

**Unarchive:** CM01 unarchive status patch, publication restore review, public
directory restore review, analytics reclassification, search index restore review,
notification, audit event.

No `DELETE_NOW_INTENT` or `PURGE_NOW_INTENT`. Plan reasons include
`noDelete`, `noPurge`, `noRetentionExecution`, `noStorageDeletion`,
`noPublicationMutation`, `noDefinitionMutation`, `noCore22Export`,
`noCore23Recovery`, `noNetwork`, `noProductionWrite`.

Successful commands return flags confirming no production side effects ran.
Explanation includes: *canonical archive record created, production/runtime
archival effects not executed*.

## Boundaries

| Module | Relationship |
|--------|--------------|
| CM-01 | Definition context + proposed status patch intent only |
| CM-03 | Version provenance reference |
| CM-04/05 | Config/branding revision refs |
| CM-06 | Publication context; visibility review intents only |
| CM-07 | Lifecycle/completion finalization evidence |
| CORE-20 | Audit intent only — no persistence |
| CORE-22 | No export created |
| CORE-23 | No recovery invoked |
| db-storage | No storage deletion |

## Tenant isolation

All repository lookups scoped by tenantId + competitionId. Cross-tenant access
→ typed error. No global implicit store.

## Determinism

Stable intent ordering, manifest fingerprinting (`cm08-fnv1a32-v1`), and request
fingerprints. Same semantic input + same clock → same manifest fingerprint.

## Legacy compatibility

`projectLegacyTournamentArchiveObservation` — read-only `LEGACY_UNVERIFIED`.
Observes legacy archived flags; issues warnings for deleted/hidden/cancelled/
completed conflation. Never creates canonical records. Never writes legacy.

## Persistence

Capability-local in-memory repository only. Production port throws
`CM08_PORT_OPERATION_UNIMPLEMENTED`. No SQL migration in this phase.

## Activation

`wiredToProductionRuntime: false`, `hasPersistence: false`, `hasUi: false`.
Future activation requires explicit repository adapter, migration, and bounded
integration executors outside CM-08 core.
