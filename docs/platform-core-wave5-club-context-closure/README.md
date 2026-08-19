# Wave 5 — Canonical Club Context Cutover + Durable Club SQL Design

**WAVE5_STATUS=IMPLEMENTED_LOCALLY_AWAITING_SQL_REVIEW_AND_STAGING_ACCEPTANCE**

**PC_CLUB_01=OPEN_PENDING_ACCEPTANCE** (not closed)

**PC_ADAPTER_01=CLOSED**

**PC_LEGACY_01=PARTIAL_REMEDIATED_CLUB_PATH_PENDING_DURABLE_CUTOVER**

**SQL_DESIGN_AUTHORED=YES**
**SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW**
**SQL_DESIGN_REVIEWED_PASS=NO**
**ROUND2_BLOCKER_01=REMEDIATED**
**ROUND2_BLOCKER_02=REMEDIATED**
**SQL_EXECUTED=NO**
**RLS_DESIGN_AUTHORED=YES**
**RLS_EXECUTED=NO**

**STAGING_MUTATED=NO**
**PRODUCTION_MUTATED=NO**
**MERGE_GO=NO**

This folder documents Wave 5 application cutover and the **design-only** durable Club Tenant migration. It does **not** claim SQL applied, Staging pass, Production pass, or `PC_CLUB_01=CLOSED`.

## Architecture lock

| Identity | Meaning |
|---|---|
| `Club.id` | Club entity identity |
| `Club.tenantId` | Canonical Platform Tenant (`platform_tenants.id`) |
| `Club.venueId` | Venue identity only when independently resolved |
| Selected Club | Preference + context target. **Not** authorization |
| Club ID | **Never** Tenant ID |
| Tenant ID | **Never** Venue ID |

No tenant↔venue cross-fill. No fabricated `default-club`. Unresolved Club is an explicit state (`CLUB_REQUIRED` / `CLUB_EMPTY` / `CLUB_CONTEXT_NOT_READY`), never silent empty business data.

## Live evidence (established, not re-queried)

| Fact | Staging `qyewbxjsiiyufanzcjcq` | Production `expuvcohlcjzvrrauvud` |
|---|---|---|
| Canonical Club flag | TRUE | TRUE |
| `clubs.tenant_id` FK | `venues(id)` | `venues(id)` |
| Club scope semantic | Legacy Venue ID stored in `tenant_id` with 1:1 Platform Tenant coincidence | same |
| Canonical Club RPC present | YES | YES |
| Distinct tenant vs venue on RPC | NO | NO |

Current durable chain:

```
platform_tenants.id
       ^
venues.tenant_id
       ^
venues.id
       ^
clubs.tenant_id   ← currently a legacy Venue scope value
```

`venues.id == venues.tenant_id == platform_tenants.id` is Wave 3 bootstrap coincidence, **not** canonical identity equivalence.

## Club ↔ Venue semantic classification

**Classification: A — obsolete tenant-alias / D — unknown legacy scope.**

Evidence:

- Phase 42B schema: `clubs.tenant_id text not null references public.venues(id)` with comment `tenant_id = venues.id (Phase A decision)`.
- No `clubs.venue_id` column exists.
- Facility registration is `clubs.registered_cluster_id`, not a Club→Venue ownership column.
- Club ↔ Venue / Cluster / Court operational access may be M:N (`court_resource` operational access). Insufficient evidence for a durable 1:1 homeVenue.

Therefore this design **does not** add `clubs.venue_id`. After migration the legacy Venue alias is discarded as Tenant authority. It is not promoted to a new persistent Club–Venue ownership relation.

## App compatibility (pre-SQL vs post-SQL)

Translator: `src/features/club/compat/legacyClubVenueScope.js`

| RPC shape | Client behavior |
|---|---|
| Explicit `scope_semantics` / `canonical_tenant_id` | Use canonical Tenant directly |
| Old shape (no marker) | Treat `row.tenant_id` as **LEGACY VENUE SCOPE**, resolve Venue, set `club.tenantId = Venue.tenantId` |

Never: `if tenant id exists in platform_tenants then assume canonical` — live Venue IDs currently equal Tenant IDs.

## SQL / RLS design

See `sql-design/`. **DO NOT RUN.** `OWNER_SQL_EXECUTION_GO=NO`.

**SQL_DESIGN_REVIEW_REMEDIATION** (Round 1, closed): strongly state-guarded APPLY; Club child tables `club_members` / `club_governance_assignments` / `club_membership_requests_v42` included; `club_create` uses `platform_tenants`; Wave 4 `tenant_members` canonical FK expected.

**SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW** (not a SQL review PASS).

**ROUND2_BLOCKER_01=REMEDIATED** — APPLY no longer rewrites live RPC bodies via `pg_get_functiondef` + `regexp_replace` + `EXECUTE`. Affected member RPCs are explicit reviewed `CREATE OR REPLACE FUNCTION` bodies.

**ROUND2_BLOCKER_02=REMEDIATED** — PRECHECK fail-closes on post-Venue→Tenant name/code uniqueness collisions (`POST_MAP_DUPLICATE_CLUB_*_COUNT`) before any APPLY mutation. No auto-rename/merge.

**ATHLETE_NO_CLUSTER_POLICY=reuse existing athlete if any (Participant user_id uniqueness; Venue not required for reuse); else require Club.registered_cluster_id → court_clusters.venue_id → venues.id; else fail closed ATHLETE_FACILITY_VENUE_REQUIRED. No Tenant-as-Venue, no first/default Venue, no clubs.venue_id, no profiles.venue_id from the Wave 5 wrapper.**

**TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES**
**WAVE4_SQL_REEXECUTION_REQUIRED=NO**

## Competition leftovers (not Wave 5 blockers)

| Path | Classification |
|---|---|
| `src/legacy/Tournament.jsx` | `DEAD_CODE_ONLY` — no production importer; lint-baseline only |
| `useTournamentEngine` `tenantId: activeClubId` | `AUDIT_METADATA_ONLY` — event metadata, not authorization scope |

`SEPARATE_COMPETITION_AUTHORITY_GAP=NO`. Documented as P2/P3 Competition debt. Not modified under Platform Core Wave 5.

## Explicit non-scope

- Frozen Competition Contracts 01–16 / no Contract #17
- Court contract / Referee contract unchanged
- Wave 4 deferred: Identity RPC canonical scope, `user_tenant_id` venue fallback retire, global `phase42_is_tenant_member` retirement, tenant member directory
- Organization runtime
- Tournament feature redesign / Competition Core
- Env mutation, Staging/Production mutation, deploy, merge

## Test matrix

See `tests/platform-core-wave5-club-context-closure.test.js` groups A–R.

## Future gates (not this pass)

1. Owner SQL design review
2. Separate `SQL_EXECUTION_GO` naming this package and `TARGET_ENV=staging`
3. Staging acceptance
4. Production cutover prerequisites
5. Only then consider `PC_CLUB_01=CLOSED`
