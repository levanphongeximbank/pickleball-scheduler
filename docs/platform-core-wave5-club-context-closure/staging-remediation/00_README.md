# Wave 5 Staging remediation — Club TRUNCATE privilege hardening

```
TARGET=STAGING
PROJECT_REF=qyewbxjsiiyufanzcjcq

AUTHORIZED_MUTATION=REVOKE TRUNCATE ONLY
AUTHORIZED_PRIVILEGE_EDGES=8
AUTHORIZED_TABLES=public.clubs, public.club_members, public.club_governance_assignments, public.club_membership_requests_v42
AUTHORIZED_ROLES=anon, authenticated

WAVE5_TENANT_CUTOVER_APPLY=NO
Q1_QUIESCE=NO
RLS_CHANGE=NO
POLICY_CHANGE=NO
SERVICE_ROLE_REVOKE=NO
SERVICE_ROLE_GRANT_CHANGE=NO
DEFAULT_ACL_CHANGE=NO
GLOBAL_PUBLIC_SCHEMA_PRIVILEGE_CHANGE=NO
STAGING_DATA_MUTATION=NO
STAGING_TABLE_SCHEMA_CHANGE=NO
STAGING_RLS_MUTATION=NO
STAGING_AUTH_USER_MUTATION=NO
PRODUCTION_QUERY=NO
PRODUCTION_MUTATION=NO

PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE
WAVE5_DEFAULT_ACL_MUTATION=NO
AUTO_REGRANT_TRUNCATE_ON_VERIFY_FAILURE=NO
```

This folder is **not** a `supabase/migrations` artifact and is **not** Wave 5 Tenant cutover APPLY.

## NO

- service_role changes
- RLS changes
- policy changes
- default ACL / `ALTER DEFAULT PRIVILEGES` changes
- data changes
- Wave5 Tenant cutover
- Q1 quiesce

## Why TRUNCATE

Canonical Club writes are RPC-only (`SECURITY DEFINER`). Table ACLs already deny INSERT/UPDATE/DELETE for `anon` and `authenticated`. Staging audit confirmed TRUNCATE remained granted. **RLS does not protect TRUNCATE.**

## Files

| File | Mutates? | Purpose |
|---|---|---|
| `01_PRECHECK_CLUB_TRUNCATE.sql` | NO | Read-only fail-closed inventory of the audited 8-edge TRUNCATE PRESENT state |
| `02_APPLY_CLUB_TRUNCATE.sql` | YES (TRUNCATE ACL only, when GO) | One transaction: `REVOKE TRUNCATE` on four tables from `anon, authenticated` |
| `03_VERIFY_CLUB_TRUNCATE.sql` | NO | Read-only post-revoke matrix; `CLUB_TRUNCATE_REMEDIATION_VERIFY=PASS` |
| `04_ROLLBACK_DESIGN.md` | documentation | Do not auto re-grant TRUNCATE |

## Default ACL gap (document only)

Live `pg_default_acl` templates may still grant broad TABLE privileges including TRUNCATE to **future** tables. That is **not** in this package.
