# CM-06 — Competition Publication

**Phase:** CM-06
**Status:** Implemented (capability-local / dormant; not production-wired)
**Module:** `src/features/competition-management/competition-publication/`
**Public barrels:**
- `src/features/competition-management/competition-publication/index.js`
- `src/features/competition-management/index.js` (re-export only)
**Tests:** `tests/cm-06-competition-publication.test.js` (added separately)

---

## Purpose

Canonical **Competition Publication** capability for Competition Management:

- owns the `CompetitionPublication` record only (identity, status, revision, lineage)
- always requires an explicit, already-immutable CM-03 `CompetitionVersion` as source — no draft/unversioned publication, no "latest version" fallback
- fail-closed readiness gate combining structural/source matching with CM-05 `publication_facing` branding readiness
- deterministic public manifest projection (`cm06-manifest-v1`)
- proposal-only integration plan (`cm06` never executes anything)
- first publish + republish (with atomic supersede of the prior record)
- idempotent commands keyed by an explicit `idempotencyKey` + semantic request fingerprint
- typed field-level errors and deterministic explanations
- capability-local in-memory repository + unimplemented production port
- read-only legacy observation projector (never canonical)

CM-06 does **not** replace CM-01 identity/status/visibility, CM-03 version creation, CM-04 configuration, or CM-05 branding.

---

## Canonical publication ownership

| Concept | Owner | Meaning |
|---------|-------|---------|
| `CompetitionPublication` / `publicationId` / status / revision | **CM-06** | The only thing this phase owns |
| `CompetitionDefinition` status / visibility | **CM-01** | Never mutated or transitioned by CM-06 |
| `CompetitionVersion` | **CM-03** | Immutable source; CM-06 never creates one |
| `CompetitionConfiguration` | **CM-04** | Optional source input; never mutated |
| `CompetitionBranding` | **CM-05** | Required source input; never mutated |
| Suspension / cancellation / archive | Other (not owned) | CM-06 only respects an explicit `externalLifecycleBlock` report |
| Public route activation / CDN / deploy | Deferred integration | CM-06 only proposes intents, never executes |
| Notifications | Deferred integration | `NOTIFICATION_INTENT` proposal only |
| Audit persistence | Deferred integration | `AUDIT_INTENT` proposal only; CM-06 persists nothing itself |

---

## Source requirement: always versioned

Every publish/republish command requires:

- an explicit `competitionVersion` object that passes the CM-03 `isCompetitionVersion` contract
- `expectedSourceVersionId` + `expectedSourceVersionNumber` matching that version exactly
- an explicit `definition` that is proven — via `buildVersionContentFromDefinition` (CM-03) plus a canonical JSON comparison — to match the content the version captured
- `expectedDefinitionRevision` matching both `definition.revision` and `competitionVersion.sourceDefinitionRevision`

There is **no** `UNVERSIONED_DRAFT_PUBLICATION` concept and **no** implicit "latest version" resolution. If the caller does not have an explicit version, CM-06 refuses to publish.

---

## Statuses

Stored record status (`COMPETITION_PUBLICATION_STATUS`):

- `PUBLISHED` — the current, active record for a tenant+competition+channel
- `SUPERSEDED` — an immutable prior record replaced by a republish
- `FAILED` — reserved; CM-06 prefers to fail closed during readiness *before* creating any record, so `FAILED` records are not normally produced

Semantic-only values (`COMPETITION_PUBLICATION_SEMANTIC_STATE`, never a stored `status`):

- `UNPUBLISHED` — no current publication exists for a scope
- `READY` / `NOT_READY` — readiness evaluation outcome only

CM-06 never invents `SUSPENDED` / `CANCELLED` / `ARCHIVED`.

---

## Channels (audit-minimal)

| Channel | Audience classification | Allowed `definition.visibility` | Output reference type |
|---------|--------------------------|----------------------------------|------------------------|
| `PUBLIC_PORTAL` | `public` | `public` only | `PORTAL_ROUTE_REFERENCE` |
| `SHAREABLE_LINK` | `restricted` | `club`, `tenant`, `public` (never `private`) | `SHAREABLE_LINK_REFERENCE` |

Channel/visibility mismatch fails closed with `CM06_CHANNEL_VISIBILITY_REJECTED`. Descriptors live in `channels/registry.js` and are the single source of truth for this compatibility rule.

---

## Profile: CM06_STANDARD_V1

The only profile in this phase — no hidden default. Commands must pass `profileId: "CM06_STANDARD_V1"` explicitly; missing/unknown values are rejected (`CM06_MISSING_PROFILE_ID` / `CM06_UNKNOWN_PROFILE`).

Requirements:

- explicit immutable `CompetitionVersion`
- explicit `definition` matching that version
- `branding` required, evaluated at the CM-05 `publication_facing` readiness profile
- `configuration` is **optional**, but its presence must always be explicit via `configurationPresence: "PRESENT" | "ABSENT"` — absence is never inferred from `configuration == null` alone

---

## Publication revision

- Distinct from the CM-03 version number, and from CM-01/CM-04/CM-05 revisions
- Monotonic **per tenant + competition + channel**
- First publish → revision `1`, `previousPublicationId: null`
- Each republish → `current.revision + 1`, `previousPublicationId` = prior `publicationId`

---

## Identity

```
cpub::{tenantId}::{competitionId}::{channel}::{revision}
```

via `createCompetitionPublicationId` / parsed back via `parseCompetitionPublicationId`.

---

## Source references

Every publication record and manifest carries the same explicit source references (`contracts/source.js`):

- `tenantId`, `competitionId`
- `sourceCompetitionVersionId`, `sourceCompetitionVersionNumber`
- `sourceDefinitionRevision`
- `sourceConfigurationRevision` (number, or `null` when `ABSENT`)
- `sourceBrandingRevision` (required for the STANDARD profile)
- `sourceTemplateId` / `sourceTemplateVersion` (from the version's `templateVersioned`, or `null`)
- `definitionFingerprint` (= `competitionVersion.contentFingerprint`)
- `configurationFingerprint` (CM-04 snapshot fingerprint, or `null` when `ABSENT`)
- `brandingFingerprint` (CM-05 snapshot fingerprint)

CM-06 never re-derives these later from "latest" state — they are frozen at publish/republish time.

---

## Publish

`publishCompetitionPublication`:

- requires explicit `tenantId`, `competitionId`, `channel`, `profileId`
- requires explicit `competitionVersion` + `expectedSourceVersionId` + `expectedSourceVersionNumber`
- requires explicit `definition` + `expectedDefinitionRevision`
- requires explicit `configurationPresence` (+ `configuration`/`expectedConfigurationRevision` when `PRESENT`)
- requires explicit `branding` + `expectedBrandingRevision`
- requires explicit `idempotencyKey`
- requires explicit `expectedCurrentPublicationRevision: 0` (first publish)
- optional `requestedPublicReference` (validated slug)
- optional `clock`/explicit value for manifest `generatedAt` (omitted unless explicit)

Runs readiness → fails closed on any structural or business-readiness issue → builds the manifest → builds the plan → calls `repository.createPublicationAtomically`.

Result: status `PUBLISHED`, `previousPublicationId: null`, `revision: 1`, reasons including `"canonicalPublicationRecordCreated"` and `"productionActivationNotPerformed"`.

Never mutates the definition/version/configuration/branding it read. Never creates a CM-03 version. No CORE, deploy, route, notification, or audit persistence.

---

## Republish

`republishCompetitionPublication`:

- requires explicit `currentPublicationId`, or resolves the current record via the tenant+competition+channel scope
- requires `expectedCurrentPublicationRevision` matching the resolved current record's revision
- requires a **new** `competitionVersion` (a different `versionId` than the current record's source) — same-source requests are rejected with `CM06_SAME_SOURCE_REPUBLISH`
- creates a new record at `revision + 1` with `previousPublicationId` = prior `publicationId`
- atomically marks the prior record as `SUPERSEDED`: the repository's `createPublicationAtomically` stores the new `PUBLISHED` record **and** replaces the prior stored entry with an otherwise-identical frozen copy whose `status` is `SUPERSEDED` in a single call — the prior publication's content (source references, manifest, audience, public reference) remains immutable; only its lineage `status` transitions.

---

## Idempotency

- `idempotencyKey` is required on every publish/republish call
- CM-06 computes a semantic request fingerprint (`computePublicationRequestFingerprint`) over the source references, channel, profile, configuration presence, requested public reference, and expected current revision
- same key + same fingerprint → the original result is returned again (`idempotent=true`)
- same key + different fingerprint → `CM06_IDEMPOTENCY_CONFLICT`
- the idempotency check runs *before* the "current publication must/must not exist" check, so retries are not confused by state the original call already produced

---

## Manifest

`buildCompetitionPublicationManifest` produces a deterministic public projection:

- `schemaVersion: "cm06-manifest-v1"`
- `fingerprint` / `fingerprintAlgorithm: "cm06-fnv1a32-v1"` (computed before `generatedAt` is attached, so it never changes due to clock injection)
- `definition` (from the version's captured content), `configuration` (CM-04 snapshot, or `null`), `branding` (CM-05 snapshot)
- `audience` (classification / requiredProfileId / outputReferenceType from the channel descriptor)
- `publicReference` (`{ slug }` or `null`)
- `generatedAt` — **only** present when the command explicitly passes a `clock` (function or literal value); otherwise `null`

Excludes secrets, signed URLs, binary content, UI state, and runtime engine state (inherited from the CM-04/CM-05 snapshot projectors it composes).

---

## Plan

`buildCompetitionPublicationPlan` returns integration **intents as proposals only** — never executed:

- `PUBLIC_PORTAL_PROJECTION_WRITE`
- `CACHE_INVALIDATION`
- `NOTIFICATION_INTENT`
- `AUDIT_INTENT`

Every intent has `proposedOnly: true` and `executed: false`; the plan itself has `executed: false`.

---

## Slug validation

`requestedPublicReference` is optional. When provided:

- no path traversal (`../`), no protocol (`://`), no query/fragment (`?`/`#`), no whitespace/control characters, no slashes
- must match `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`
- duplicate slugs (per tenant) are rejected by the repository (`CM06_DUPLICATE_PUBLIC_REFERENCE`), whether checked eagerly via the optional `reservePublicReference` port method or at atomic commit time

---

## Repository port

Required: `createPublicationAtomically`, `findPublicationById`, `findCurrentPublication`, `listPublications`, `findByIdempotencyKey`.
Optional: `reservePublicReference` (duplicate slug dry-run check).

The capability-local in-memory implementation enforces: one current `PUBLISHED` record per tenant+competition+channel, monotonic revision, atomic supersede-on-republish, idempotency-key binding, and public-reference uniqueness per tenant.

---

## External lifecycle boundary

CM-06 does not own suspension/cancellation/archive. If a command passes `externalLifecycleBlock: { status: "SUSPENDED" | "CANCELLED" | "ARCHIVED" }`, the readiness gate fails closed with `CM06_EXTERNAL_LIFECYCLE_BLOCKED` — CM-06 only *respects* the report, it never produces or stores those states itself.

---

## Legacy compatibility

`projectLegacyTournamentPublicationObservation`:

- read-only; provenance is always `LEGACY_UNVERIFIED`
- `isCanonicalPublication: false`, `fullSafeMapping: false`
- observes `isPublic`/`public`, `publishedAt`, `status`, `slug` if present, with typed `WARNING` issues for anything ambiguous (disagreeing flags, wrong types, or fields that are observed but never auto-promoted)
- never writes to the legacy object and never creates/updates/supersedes a `CompetitionPublication`

---

## Persistence / runtime status

| Flag | Value |
|------|-------|
| `wiredToProductionRuntime` | `false` |
| `hasPersistence` | `false` |
| `repositoryMode` | `capability-local-in-memory` |
| `hasUi` | `false` |
| `hasMigration` | `false` |
| `ownsPublicationStates` | `true` |
| `ownsNotifications` | `false` |
| `ownsPublicRouting` | `false` |

No SQL migration authored. No production wiring. No deploy/route/CDN/notification/audit execution.

---

## Activation conditions

CM-06 remains dormant until an Integrator explicitly:

1. wires a production repository adapter (with RLS/tenant isolation)
2. wires a real public-portal/CDN write for the `PUBLIC_PORTAL_PROJECTION_WRITE` intent
3. wires a real notification/audit consumer for the `NOTIFICATION_INTENT` / `AUDIT_INTENT` proposals
4. decides how CM-07/CM-08 external lifecycle signals are supplied as `externalLifecycleBlock`

Until then: capability-local tests only; legacy tournament runtime remains the transitional production source.
