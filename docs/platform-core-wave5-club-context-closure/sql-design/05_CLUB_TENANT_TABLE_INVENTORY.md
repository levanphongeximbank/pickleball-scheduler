# Wave 5 — Club-domain tenant-bearing table inventory

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
SQL_EXECUTED=NO
```

Authoritative live schema source: `docs/v5/PHASE_42B_SCHEMA.sql` plus later Club RPC/RLS patches. This inventory does **not** absorb Participant/Athlete authority into Platform Core.

| TABLE | COLUMN | CURRENT_EXPECTED_FK | CURRENT_SEMANTIC | AUTHORITATIVE_DOMAIN | CLUB_CUTOVER_DEPENDENCY | TARGET_SEMANTIC | MIGRATE_IN_WAVE5 | WHY |
|---|---|---|---|---|---|---|---|---|
| `public.clubs` | `tenant_id` | `public.venues(id)` ON DELETE RESTRICT | Legacy Venue ID stored in a column named tenant_id | Club | Root Club Tenant identity | Platform Tenant (`platform_tenants.id`) ON DELETE RESTRICT | YES | Club SSOT. After cutover `p_tenant_id` / `clubs.tenant_id` mean Platform Tenant. |
| `public.club_members` | `tenant_id` | `public.venues(id)` ON DELETE RESTRICT | Same Venue ID as parent Club (copied at insert) | Club membership | Must agree with `clubs.tenant_id` | Platform Tenant ON DELETE RESTRICT | YES | Club-owned membership rows. Venue FK would disagree with canonical Club Tenant. |
| `public.club_governance_assignments` | `tenant_id` | `public.venues(id)` ON DELETE RESTRICT | Same Venue ID as parent Club/member | Club governance | Trigger requires `club_members.tenant_id` match | Platform Tenant ON DELETE RESTRICT | YES | Club-owned governance. Must stay same-tenant as Club + member. |
| `public.club_membership_requests_v42` | `tenant_id` | `public.venues(id)` ON DELETE RESTRICT | Copied from `clubs.tenant_id` on submit | Club membership request | Must agree with parent Club | Platform Tenant ON DELETE RESTRICT | YES | Club-owned request persistence. |
| `public.athletes` | `tenant_id` | `public.venues(id)` ON DELETE RESTRICT | Venue-scoped participant row | Participant / Athlete | Club RPCs currently pass `v_club.tenant_id` into athlete ensure | Remains Venue scope | NO | Do not absorb Athlete authority. Club RPCs must use an honestly named facility-Venue translation, never `Tenant ID == Venue ID`. |
| `public.idempotency_requests` | `tenant_id` | none | RPC replay key metadata (historical Venue IDs possible) | Platform idempotency log | Replay keyed by actor+request_id, not Club Tenant FK | Unchanged | NO | Not Club authority. Rewriting historical keys is out of scope. |
| `public.audit_logs` | `venue_id` (and tenant in payload) | not Club Tenant FK | Audit metadata | Identity / audit | Club RPCs write `v_club.tenant_id` into the existing audit tenant/venue slot | Unchanged this wave | NO | Audit is not Club Tenant SSOT. App must stop stuffing Tenant ID into `venueId`. |
| `public.tenant_members` | `tenant_id` | `public.platform_tenants(id)` ON DELETE RESTRICT | Canonical Tenant operational entitlement | Platform / Identity (Wave 4 CLOSED) | Club entitlement helper reads this | Already canonical | NO | Wave 4 already applied/verified. Wave 5 must EXPECT this FK and must not re-execute Wave 4 SQL. |
| `public.club_governance` (legacy blob registry) | venue-shaped | legacy `club_upsert_registry` | Retired V1 registry | Legacy Club V1 | V2-OFF only | Unchanged | NO | Not canonical Club SSOT under V2. |

## Club child-table canonicalization rule

For Club-owned tables whose `tenant_id` is true Tenant scope:

```
legacy tenant_id (venues.id)
  → venues.tenant_id
  → platform_tenants.id
```

Same fail-closed mapping as `clubs`. Mixed FK state across these four tables is `STATE_UNKNOWN` and aborts.

## Athlete note

`club_add_member` / `club_restore_member` / `club_review_membership_request` call `phase42n_ensure_athlete_for_user(..., v_club.tenant_id | v_row.tenant_id, ...)`. After Club Tenant ≠ Venue ID that argument is invalid for `athletes.tenant_id → venues(id)`. Wave 5 APPLY introduces `wave5_ensure_athlete_for_club_member` (facility Venue from registered cluster topology, else NULL so the helper may use `profiles.venue_id`). That is explicit compatibility translation, not Tenant==Venue.
