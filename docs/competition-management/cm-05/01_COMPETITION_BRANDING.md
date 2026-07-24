# CM-05 — Competition Branding

**Phase:** CM-05  
**Status:** Implemented (capability-local / dormant; not production-wired)  
**Module:** `src/features/competition-management/competition-branding/`  
**Public barrels:**  
- `src/features/competition-management/competition-branding/index.js`  
- `src/features/competition-management/index.js` (re-export only)  
**Tests:** `tests/cm-05-competition-branding.test.js`

---

## Purpose

Canonical **Competition Branding** capability for Competition Management:

- tenant-safe, deterministic, fail-closed branding aggregate
- visual identity **asset references** (not binary uploads)
- color palette tokens (`#RRGGBB` uppercase only)
- typography **opaque token** references (no font loading)
- presentation-only metadata (`shortLabel`, `tagline`, lockup, theme mode preference)
- accessibility contrast baseline (WCAG 2.1 relative luminance; not full WCAG certification)
- branding revision + optimistic concurrency
- readiness evaluation (no network / no publish)
- branding comparison + snapshot projection for future CM-03 capture
- typed field-level errors and deterministic explanations
- capability-local in-memory repository + unimplemented production port
- partial legacy read projector (no full safe mapping)

CM-05 does **not** replace CM-01 identity/name/description, CM-04 configuration, upload/storage, or CM-06 publication.

---

## Canonical branding ownership

| Concept | Owner | Meaning |
|---------|-------|---------|
| `CompetitionBranding` / `brandingId` / `revision` | **CM-05** | Mutable competition visual identity + concurrency revision |
| Canonical `name` / `description` | **CM-01** | Never owned / mutated by CM-05 |
| `CompetitionConfiguration` | **CM-04** | Not a branding store |
| `CompetitionVersion` | **CM-03** | May later capture CM-05 snapshot; CM-05 does not create versions |
| Platform / tenant / venue / club brand | Platform / other | Never inferred into competition branding |
| File upload / storage / CDN | Deferred media service | Not owned |
| Publication | **CM-06** | CM-05 only reports readiness |
| Suspension / cancellation | **CM-07** | Not owned |
| Archive | **CM-08** | Not owned |
| Sponsor commercial contracts | Finance / marketplace | Deferred; presentation marks not in CM-05 v1 |

---

## Distinction: CM-01 name/description

- `shortLabel` / `tagline` are **presentation-only**.
- Providing `name` / `description` / `canonicalName` / `displayNameOverride` on branding is rejected (`CM05_CANONICAL_NAME_OWNERSHIP`).
- Create/update never mutate `CompetitionDefinition` or bump CM-01 revision.

---

## Distinction: CM-04 configuration

- Branding tokens are **not** stored as CM-04 sections.
- CM-05 does not read/write configuration repositories or bump configuration revision.
- Regulation / registrationPolicy **copy** in legacy blobs is **not** claimed as CM-05 visual branding (deferred copy capability).

---

## Distinction: platform / tenant / venue / club branding

CM-05 never:

- inherits platform theme tokens
- inherits tenant `branding.*` settings
- copies club `logo` / `coverImage`
- copies venue cover images
- auto-selects default colors or logos

`metadata.inferredFrom*` flags are always `false` on validated aggregates.

---

## Asset reference model

Asset references are metadata only:

- `assetId` (required stable identity)
- `kind` (`PRIMARY_LOGO` | `SECONDARY_LOGO` | `ICON` | `COVER` | `BANNER` | `BACKGROUND` | `SOCIAL_PREVIEW`)
- `tenantId` + `ownershipScope` (`tenant` | `global_safe`)
- optional `objectKey`, `storageProvider`, `referenceUri`, `accessClassification`
- optional `mimeType`, `width`/`height`, `altText`, `contentHash`, `assetRevision`

Rules:

- no binary / base64 embedding
- no `javascript:` / `data:` / `file:` / local paths
- no signed URL tokens as canonical identity
- no network fetch to validate content
- duplicate kinds rejected
- alt text required for public-facing kinds

---

## Color model

- Canonical format: uppercase `#RRGGBB`
- Alpha (`#RRGGBBAA`) rejected
- CSS functions / injection rejected (`var(`, `url(`, gradients, etc.)
- Deterministic normalization of valid hex to uppercase
- No silent repair of malformed colors
- No automatic default palette

Required keys when palette is provided:  
`primary`, `secondary`, `accent`, `background`, `surface`, `textPrimary`  
Optional: `textSecondary`, `border`  
Empty draft may omit palette entirely.

---

## Typography reference

- Opaque `tokenId` only (safe identifier pattern)
- Optional `fallbackSemantics` (default `platform_default`)
- No font files, no `url()`, no arbitrary CSS stacks
- Does not override platform font runtime

---

## Accessibility baseline

Algorithm: `wcag21-relative-luminance-v1`  
Threshold: **4.5:1** for:

- `textPrimary` on `background`
- `textPrimary` on `surface`

Behavior:

- deterministic, browser-independent
- typed ERROR issues on failure
- **does not** auto-change colors
- baseline only — **not** a full WCAG certification claim

---

## Sponsor mark boundary

Sponsor/partner marks are **deferred** in CM-05 v1 (`sponsorMarksDeferred: true`).

Providing non-empty `sponsorMarks` fails with `CM05_SPONSOR_MARKS_DEFERRED`.  
Commercial rights are never inferred.

---

## Branding revision / optimistic concurrency

- Initial create → `revision = 1`
- Successful update → `revision + 1`
- Requires `expectedBrandingRevision`
- Stale → `CM05_STALE_BRANDING_REVISION`
- Validation failure does not bump revision
- Distinct from CM-01 definition revision, CM-04 configuration revision, and CM-03 version number

Status baseline: `draft` | `locked` (no PUBLISHED/SUSPENDED/CANCELLED/ARCHIVED).

---

## Readiness evaluation

`evaluateCompetitionBrandingReadiness`:

- profiles: `draft` | `publication_facing`
- no network calls (`networkCallsPerformed: 0`)
- no physical storage existence check
- no publish
- deterministic issue ordering
- CM-06 decides which readiness profile is required to publish

---

## Comparison

- tenant-scoped; cross-tenant denied
- cross-competition rejected by default
- change types: `ADDED` | `REMOVED` | `CHANGED`
- deterministic path ordering
- compares semantic branding payload (not signed URL noise)

---

## Snapshot projection

`CompetitionBrandingSnapshot` includes:

- tenant/competition/branding identity + brandingRevision
- assets, palette, typography, presentation
- accessibility summary
- fingerprint `cm05-fnv1a32-v1`

Excludes: binary/base64, UI state, upload sessions, publication state, secrets.  
Fingerprint deliberately omits `referenceUri` so URL noise cannot change identity.

Does **not** create `CompetitionVersion`.

---

## Tenant isolation

- All commands require explicit `tenantId` + `competitionId`
- Definition scope must match
- Repository lookups are scope-keyed; cross-tenant existence is not leaked
- Asset ownership must match tenant (or explicit `global_safe`)

---

## Deterministic guarantees

- frozen aggregates
- sorted assets / diffs / errors
- stable fingerprint for equal semantic content
- no mutation of input command/definition objects
- repeated execution yields stable output

---

## Legacy compatibility

`projectLegacyTournamentToBranding`:

- partial projection only
- `fullSafeMapping: false`
- never writes legacy objects
- never infers tenant/competition/asset ownership
- never inherits platform/tenant/venue/club brand
- `tournament.image` / `branding.logoUrl` → ambiguous (missing assetId/ownership)
- explicit `branding.colors` may project when valid `#RRGGBB`
- `settings.regulations` / `registrationPolicy` → not CM-05 visual branding

Legacy tournament runtime remains the transitional production source.

---

## Persistence / storage / runtime status

| Flag | Value |
|------|-------|
| `wiredToProductionRuntime` | `false` |
| `hasPersistence` | `false` |
| `repositoryMode` | `capability-local-in-memory` |
| `hasUi` | `false` |
| `hasMigration` | `false` |
| `migrationAuthored` | `false` |
| `ownsUploadStorage` | `false` |

No SQL migration authored. No storage bucket. No CDN. No production wiring.

---

## CM-06 publication boundary

CM-05 may provide readiness + publication-facing snapshot.  
CM-05 must **not**:

- publish branding
- activate public visibility / routes
- send notifications
- upload assets
- network-check URLs

---

## CM-07 / CM-08 boundary

Suspension/cancellation/archive are out of scope.  
`locked` status is an editability baseline only (e.g. external constraint reference), not a lifecycle transition owner.

---

## Activation conditions

CM-05 remains dormant until an Integrator explicitly:

1. wires a production repository adapter (with RLS/tenant isolation)
2. connects a trusted media/asset service (upload out of CM-05)
3. decides CM-06 publication consumption of branding readiness/snapshot
4. optionally captures branding snapshots into CM-03 versions

Until then: capability-local tests only; legacy tournament UI remains transitional runtime.
