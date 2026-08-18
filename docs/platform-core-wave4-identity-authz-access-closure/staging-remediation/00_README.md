# Wave 4 Staging remediation package — AUTHOR ONLY

**SQL_EXECUTION_GO = NO**
**RLS_EXECUTION_GO = NO**
**SCHEMA_EXECUTION_GO = NO**
**DATA_MUTATION_GO = NO**
**STAGING_DEPLOY_GO = NO**
**PRODUCTION_ACCESS_GO = NO**

This folder is a **reviewable Staging execution package**. It is **not** authorization to run SQL.

Do **not** apply these files to Staging or Production until Owner issues a separate execution GO naming this package and `TARGET_ENV=staging`.

Do **not** treat this package as a normal Supabase migration.

## Architecture amendment (code already applied locally)

`tenant_members` is **Tenant operational entitlement**, not universal account membership.

| Actor | `tenant_members` required? |
|---|---|
| PLAYER | NO, unless a Tenant operational action |
| REFEREE | NO, unless a Tenant operational action |
| CLUB actor | NO, unless a Tenant operational action |
| COACH | NO, unless a Tenant operational action |
| Tenant operator (settings / membership / tenant admin) | YES — explicit active row |
| Super Admin | NO — global authorization + explicit operational target |

`profiles.tenant_id` = home/default **context hint only**.
Selected Tenant = **target/preference only**. Neither grants Tenant operation.

## Package files

| File | Mutates? | Purpose |
|---|---|---|
| `01_PRECHECK.sql` | NO | Read-only fail-closed inventory |
| `02_APPLY_TENANT_MEMBERS_TENANT_FK.sql` | YES (schema only, when GO) | Point `tenant_members.tenant_id` FK at `platform_tenants(id)` |
| `03_APPLY_TENANT_MEMBERS_RLS_AND_GRANTS.sql` | YES (policy/grants only, when GO) | Self + Super Admin SELECT; revoke TRUNCATE from anon/authenticated |
| `04_MEMBERSHIP_CANDIDATES_READONLY.sql` | NO | Owner decision report. **No INSERT.** |
| `05_VERIFY.sql` | NO | Post-apply read-only invariants |
| `99_ROLLBACK.md` | documentation | Manual rollback. No silent widen script. |

## Direct `tenant_members` consumers (application)

Repository application reads:

- `src/features/tenant/services/tenantEntitlementAdapter.js` — actor **own** rows (`user_id = actor`)

No current secure client flow lists foreign/co-member rows from this table.

**TENANT_MEMBER_DIRECTORY_SERVER_CAPABILITY_GAP=YES** if Owner later needs a Tenant Owner directory of co-members. Do **not** widen direct-table RLS to restore that convenience. Keep SELECT = Super Admin + own rows.

## phase42_is_tenant_member blast radius

**PHASE42_TENANT_MEMBER_HELPER_GLOBAL_RETIREMENT=DEFERRED**

The helper still includes Venue-as-Tenant fallback and is consumed by club RLS/RPC paths (`clubs`, `athletes`, `club_members`, governance RPCs, historical Phase 42C). This package **does not** replace the helper globally.

`tenant_members` table policy itself must stop depending on that helper / Venue fallback.

SECURITY DEFINER helpers continue to read `tenant_members` independently of the narrowed table SELECT policy.

## Identity RPC

**IDENTITY_RPC_CANONICAL_SCOPE_GAP=OPEN**

`identity_list_users` / `identity_admin_update_user` remain LEGACY_VENUE_SCOPED + SUPER_ADMIN_GLOBAL. This package does **not** mutate those RPCs.

Secure runtime client `profiles.select("*")` privileged fallback stays DENIED.

## Database `user_tenant_id()`

**DATABASE_USER_TENANT_VENUE_FALLBACK_RETIRE=NOT_YET**

This package must **not** modify `user_tenant_id()` / `COALESCE(profiles.tenant_id, profiles.venue_id)`.

Application operational Tenant entitlement is independent of that fallback.

## Membership DML

**OWNER_APPROVED_MEMBERSHIP_MANIFEST_REQUIRED=YES**

Do **not** INSERT membership from `profiles.role`, `profiles.tenant_id`, or `profiles.venue_id`.

No executable membership apply file is included.

## FK / RLS targets (proposed, not executed)

- `TENANT_MEMBERS_FK_TARGET_PROPOSED=platform_tenants`
- `TENANT_MEMBERS_POLICY_TARGET=CANONICAL_SELF_PLUS_SUPER_ADMIN`
- `ANON_TRUNCATE_TARGET=REVOKE`
- `AUTHENTICATED_TRUNCATE_TARGET=REVOKE`
- `TENANT_MEMBERS_FORCE_RLS=NO` (do not enable FORCE RLS here)

## Historical live evidence used to design this package

Staging project ref `qyewbxjsiiyufanzcjcq` (read-only preflight, prior phase):

- `tenant_members` exists; FK currently to `venues(id)`
- live IDs also exist in `platform_tenants`
- SELECT policy currently Super Admin OR own row OR `phase42_is_tenant_member` (Venue fallback)
- anon/authenticated currently have TRUNCATE

This package does **not** re-query Staging.
