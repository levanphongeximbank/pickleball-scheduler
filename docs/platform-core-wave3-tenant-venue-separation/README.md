# Platform Core Wave 3 — Tenant / Venue Separation

**Status:** Phase A app remediation remains landed. Phase B closure design is
remediated in this PR for Owner review. **Not SQL-GO.**

**SQL_EXECUTION_GO=NO** — do not apply until Owner explicitly authorizes.

## Architecture lock

- Tenant ≠ Venue
- Venue ≠ Cluster
- Cluster ≠ Physical Court
- Club ≠ Venue
- Organization = NOT_CONFIGURED (no Organization implementation)
- Contract #02 / #07 frozen (no contract edits in this wave)

## Target cardinality

`Tenant → Venue = 1:N`

Physical resource parent chain (not forked by environment):

```
Tenant → Venue → Court Cluster → Physical Court
```

`court_clusters.venue_id` is the physical parent Venue.
`court_clusters.tenant_id` is Tenant scope/projection and must resolve from
the parent Venue. Never infer Venue identity from Tenant identity.

## Pre-migration schema shapes

Wave 3 must accept **both** legitimate pre-schema databases and converge them:

| Environment | `court_clusters.tenant_id` |
|-------------|----------------------------|
| Staging | Present historically (Court Ops Batch 8 / Staging court-resource cutover) |
| Production | Absent (Phase 23 `venue_id` only; Batch 8 never applied) |

Absence on Production is `EXPECTED_PRE_SCHEMA` → created by `02_APPLY`,
backfilled by `03_BACKFILL`, verified by `05_VERIFY`. It is not corrupt
resource data. Staging having the column does **not** make Staging canonical.

## Phase A (app — this PR)

- Distinct `VenueContext` under `TenantProvider`
- Cluster scoped by `currentVenueId`
- Club remains tenant-scoped; club switch does not mutate Tenant/Venue/Cluster identity
- User-scoped venue preference; cleared on logout / user switch / auth_invalid
- Local tenant cache (`pickleball-tenants-v1`) distinct from venue registry
- Readiness supports optional `requireVenue` (not global)

## Phase B (durable Tenant authority + SQL package — review only)

Canonical binding:

```
public.platform_tenants
        ↓
Platform-owned platformTenantAuthority
        ↓
TenantContext / tenantService
```

`pickleball-tenants-v1` is cache/preference only after `CLOUD_CANONICAL`.
Before schema is present and readable, runtime uses honest
`COMPATIBILITY_PRE_SCHEMA` (no fake cloud success, no `public.tenants` authority).

See `sql/`:

| File | Purpose |
|------|---------|
| `00_OWNER_README.md` | Apply order, slug policy, GO gates |
| `01_PRECHECK.sql` | Read-only inventory + slug/orphan preflight; classifies cluster tenant column absent vs present |
| `02_APPLY_platform_tenants_and_venue_fk.sql` | Real tenants table + venue/profile/cluster `tenant_id` columns; no RLS; no authenticated GRANT |
| `03_BACKFILL.sql` | 1:1 bootstrap; fail-closed slug/orphan; profiles + cluster tenant FK/index |
| `04_RLS_NOTES.sql` | Non-executable pointer |
| `04_RLS_PACKAGE.md` | Reviewable security design |
| `04_RLS_POLICIES.sql` | Explicit policies; dual-gated; not in default apply |
| `05_VERIFY.sql` | Post-apply verification |
| `99_ROLLBACK.md` | Rollback guidance |
| `../LEGACY_PUBLIC_TENANTS_CUTOVER.md` | View reader classification + drop gate |

## Contracts

Contract #02 (`PlatformScope`) and Contract #07 (Competition Court Adapter)
are frozen. Absence of a first-class Venue field on #02 is **not** automatically
a contract gap: Venue can be resolved through court → cluster → venue when those
relationships are deterministic.

**SHARED_CONTRACT_CAPABILITY_GAP=UNPROVEN**

No contract modification authorized.
