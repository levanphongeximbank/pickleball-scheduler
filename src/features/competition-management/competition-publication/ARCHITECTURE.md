# Competition Publication — Architecture (CM-06)

**Status:** capability-local / dormant
**Owns:** the `CompetitionPublication` record only (status, revision, lineage, manifest, plan)
**Does not own:** CM-01 definition/status/visibility, CM-03 version creation, CM-04 configuration, CM-05 branding, CM-07 suspension, CM-08 archive, deploy/routing/CDN, notifications, audit persistence

## Layering

```
constants/    status, channels, profiles, revision, comparison, severity
errors/       CM06_ typed error codes + CompetitionPublicationError
contracts/    shared helpers, validation envelope, identity, slug, source refs, aggregate
profiles/     CM06_STANDARD_V1 descriptor + registry
channels/     PUBLIC_PORTAL / SHAREABLE_LINK descriptors + visibility compatibility
readiness/    fail-closed structural + branding-readiness gate (no network/publish)
manifest/     deterministic public projection ("cm06-manifest-v1")
planning/     proposal-only integration intents (never executed)
application/  publish / republish / read commands
repository/   capability-local in-memory only
ports/        unimplemented production persistence port
adapters/     explicit read-only legacy observation projector
domain/       re-exports of aggregate validators + collectors
```

## Source of truth

CM-06 never accepts a "latest version" fallback and never invents an
`UNVERSIONED_DRAFT_PUBLICATION`. Every publish/republish requires an explicit,
already-immutable CM-03 `CompetitionVersion`, plus a definition that is proven
(via `buildVersionContentFromDefinition` + canonical comparison) to match the
content captured by that version.

## Flow

1. `readiness/evaluate.js` — structural validation (identity/profile/channel/
   version/definition/configuration/branding matching, channel↔visibility
   compatibility, external lifecycle block) fails closed; then CM-05
   `publication_facing` branding readiness is layered on as soft issues with
   an overall `ready` flag.
2. `contracts/source.js` — assembles the explicit source references
   (version id/number, definition/config/branding revisions and
   fingerprints) that are stamped on every record and manifest.
3. `manifest/build.js` — deterministic public projection, fingerprint
   `cm06-fnv1a32-v1`, schema `cm06-manifest-v1`. `generatedAt` only appears
   when an explicit clock/value is supplied.
4. `planning/build.js` — proposal-only integration intents
   (`PUBLIC_PORTAL_PROJECTION_WRITE`, `CACHE_INVALIDATION`,
   `NOTIFICATION_INTENT`, `AUDIT_INTENT`); `executed` is always `false`.
5. `application/commands.js` — `publishCompetitionPublication` (first publish,
   revision 1, `previousPublicationId: null`) and
   `republishCompetitionPublication` (requires a NEW source version,
   supersedes the prior record atomically) call the repository's single
   `createPublicationAtomically` transition.

## Runtime

- `wiredToProductionRuntime: false`
- `hasPersistence: false`
- `repositoryMode: "capability-local-in-memory"`
- `ownsPublicationStates: true`
- `ownsNotifications: false`
- `ownsPublicRouting: false`
