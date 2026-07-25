# NEWS-01 — Domain, Editorial Lifecycle & Public Read Foundation

## Ownership

- **News & Public Content** owns content domain, editorial lifecycle, publication eligibility, public read projection, provenance for content read models, typed errors, repository ports, and the single public facade.
- **Experience Channels** continues to own `NewsPage`, Public Portal rendering, routes, layouts, and presentation states.
- Existing `MOCK_NEWS` / `getPublicNews()` remain Experience Channels / Public Portal mock surfaces and are **not** the News domain source of truth.

## Canonical path

- Module: `src/features/news-public-content/`
- Public entry: `src/features/news-public-content/index.js`
- Architecture: `src/features/news-public-content/ARCHITECTURE.md`

## Public facade

Single facade factory:

- `createNewsPublicContentFacade({ repository, clock, idProvider })`
- Alias: `newsPublicContentFacade`

Operations: `createDraft`, `createRevision`, `submitForReview`, `requestChanges`, `approve`, `schedule`, `publish`, `unpublish`, `archive`, `cancelSchedule`, `restoreApproved`, `evaluatePublicationEligibility`, `projectPublicContent`, `getByContentId`, `queryPublicCandidates`.

Results use Platform Core `ok` / `fail` envelopes via module platform adoption.

## Domain model

### Content types

`NEWS`, `ARTICLE`, `ANNOUNCEMENT`, `TOURNAMENT_CONTENT`, `VENUE_CONTENT`, `CLUB_CONTENT`, `BANNER`, `SPONSOR_CONTENT`

### Content scopes

`PLATFORM`, `TENANT`, `VENUE`, `CLUB`, `COMPETITION`

Scope ownership is fail-closed:

| Scope | Required identities |
|-------|---------------------|
| PLATFORM | none |
| TENANT | `tenantId` |
| VENUE | `venueId` + `tenantId` |
| CLUB | `clubId` + `tenantId` |
| COMPETITION | `competitionId` + `tenantId` |

No “first tenant/club/venue” fallbacks.

### Aggregate fields (minimum)

`contentId`, `contentType`, `contentScope`, scope owners, `authorId`, `editorialOwnerId`, `title`, `summary`, `slug`, `locale`, category/tag/media references, SEO metadata, `revisionId`, `version`, editorial status, review/approval, publication window, public visibility, provenance, timestamps.

## Lifecycle matrix

Allowed transitions:

- `DRAFT → IN_REVIEW`
- `IN_REVIEW → DRAFT` (request changes + review decision)
- `IN_REVIEW → APPROVED` (approval bound to current revision/version)
- `APPROVED → SCHEDULED` (future `publishAt`)
- `APPROVED → PUBLISHED` (eligibility + window)
- `SCHEDULED → APPROVED` (cancel schedule)
- `SCHEDULED → PUBLISHED` (eligible at provided `now`)
- `PUBLISHED → UNPUBLISHED`
- `PUBLISHED → ARCHIVED`
- `UNPUBLISHED → DRAFT`
- `UNPUBLISHED → APPROVED` (approval still valid for current revision)
- `UNPUBLISHED → PUBLISHED`
- `UNPUBLISHED → ARCHIVED`

`ARCHIVED` is terminal. Forbidden transitions fail with typed `NEWS_INVALID_LIFECYCLE_TRANSITION`.

Approval ≠ published. Scheduled ≠ published. Publish requires publication eligibility.

## Review / approval boundary

- Review and approval contracts store reviewer/approver id, decision, timestamp, optional reason, and bound `revisionId`/`version`.
- Approval of an older revision is invalid for a newer revision.
- Creating a content revision clears approval/review.

## Revision / version rules

- `version` is a positive integer starting at 1.
- Content edits create a new `revisionId` and incremented `version`.
- Approved/published revisions are not silently mutated in place.
- Version mismatch → `NEWS_VERSION_CONFLICT`.

## Publication eligibility

Checks identity, type, scope ownership, title, slug, locale, summary policy, revision/version, approval binding, publication window, public visibility, non-archived, and type-specific banner/sponsor references.

Window rules:

- `unpublishAt` must be after `publishAt`
- scheduled requires future `publishAt`
- reject publish before `publishAt` or at/after `unpublishAt`

Time is injected via operation/`ClockPort` — no nondeterministic system clock in domain policy.

## Public projection

`projectPublicContent` returns a public-safe read model and fails closed for non-published / non-public / ineligible / archived content.

Does **not** leak internal review comments or private approval metadata.

## Provenance

Canonical values owned by News: `LIVE`, `MOCK`, `PREVIEW`.

Rules:

- `MOCK` is never labeled `LIVE`
- `LIVE` requires durable live path (deferred beyond NEWS-01)
- Facade preserves provenance on results
- Experience Channels presentation classification is separate and not imported

## Repository port

`ContentRepositoryPort`: `getByContentId`, `save`, `queryPublicCandidates`, `findSlugCollision`, `detectVersionConflict`.

Unimplemented port throws typed `NEWS_PORT_OPERATION_UNIMPLEMENTED`.

**Persistence deferred to NEWS-02.** No SQL/migration/Supabase/localStorage SoT in NEWS-01.

## Platform Core adoption

Consumes only `src/core/platform/index.js`:

- Result `ok` / `fail`
- `parseIsoStrict`
- `projectIdentityActor`
- `projectTenantScope`

Does not edit Platform Core files. Does not put News business logic into Platform Core.

## Public Portal integration

**Deferred to NEWS-04.** NEWS-01 does not wire `getPublicNews()`, does not change `NewsPage`, and does not replace `MOCK_NEWS` purpose.

## SQL / Staging / Production

**Not performed** in NEWS-01.

## Existing mock

`src/data/public/mockPublicData.js` `MOCK_NEWS` remains a Public Portal fixture. It is **not** the News domain source of truth.

## Out of scope

- Media upload
- Scheduler worker
- Advertising engine
- Competition / Venue / Club / CRM / Finance / Notification internals
- package/lockfile changes
- Production readiness claim

## Certification evidence

See PR / final report for exact `node --test`, `ci:foundation-lock`, `lint:no-new`, `build`, `git diff --check`, package/lock hash, and secret-scan commands.

## Next workstream conditions

Proceed to **NEWS-02** when NEWS-01 is merged and Owner authorizes durable persistence / SQL / RLS / editorial authorization design.

## NEWS_01_ARCHITECTURE_DECISION (audit)

| Decision | Choice |
|----------|--------|
| Canonical module location | `src/features/news-public-content/` |
| Single public facade | `index.js` → `newsPublicContentFacade` / `createNewsPublicContentFacade` |
| Internal layers | constants, errors, contracts, domain, projections, ports, application, platform |
| Persistence boundary | repository port only; no durable adapter |
| Public-read boundary | `projectPublicContent` fail-closed |
| Platform Core adoption | Yes — Result + ISO parse + actor/tenant projections via public barrel |
| Registries to modify | `scripts/ci/unit-test-files.json` only (module-local errors; no API error registry) |
| Files expected | module `**`, NEWS-01 docs, NEWS-01 tests, unit-test manifest |
| Files forbidden | Public Portal UI/router/layouts, `MOCK_NEWS` purpose change, SQL, package/lockfiles, unrelated BM internals |
