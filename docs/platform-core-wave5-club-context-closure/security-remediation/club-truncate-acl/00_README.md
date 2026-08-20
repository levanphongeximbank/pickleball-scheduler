# Club TRUNCATE ACL security remediation (design package)

```
ACL_PACKAGE=WAVE5_CLUB_TRUNCATE_ACL_SECURITY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
BUSINESS_LOGIC_CHANGED_BY_ACL_PACKAGE=NO
TRUNCATE_SECURITY_DEPENDS_ON_POSTGREST_NON_EXPOSURE=NO
ANON_TRUNCATE_TARGET=DENY
AUTHENTICATED_TRUNCATE_TARGET=DENY
AUTHORIZED_MUTATION=REVOKE TRUNCATE ONLY
AUTHORIZED_PRIVILEGE_EDGES=8
AUTHORIZED_TABLES=public.clubs, public.club_members, public.club_governance_assignments, public.club_membership_requests_v42
AUTHORIZED_ROLES=anon, authenticated
SERVICE_ROLE_REVOKE=NO
RLS_CHANGE=NO
POLICY_CHANGE=NO
AUTO_REGRANT_TRUNCATE_ON_VERIFY_FAILURE=NO
```

## Scope

Roles:

- `anon`
- `authenticated`

Tables (public):

- `clubs`
- `club_members`
- `club_governance_assignments`
- `club_membership_requests_v42`

Privilege:

- `TRUNCATE` only (8 combinations)

Out of scope: INSERT/UPDATE/DELETE table grants, RPC EXECUTE, `service_role`,
RLS policy text, Club mutation RPC bodies.

## Security model

RLS is **not** the authority protecting `TRUNCATE`. Effective `TRUNCATE`
privilege must be denied even when PostgREST does not expose a TRUNCATE endpoint.

```
TRUNCATE_SECURITY_DEPENDS_ON_POSTGREST_NON_EXPOSURE=NO
ANON_TRUNCATE_TARGET=DENY
AUTHENTICATED_TRUNCATE_TARGET=DENY
```

## Files

| File | Mutates? | Purpose |
|---|---|---|
| `01_PRECHECK.sql` | NO | Read-only inventory of 8 TRUNCATE combinations; distinguishes granted vs denied |
| `02_APPLY.sql` | YES (when GO) | One `REVOKE TRUNCATE` for anon/authenticated on the 4 tables |
| `03_VERIFY.sql` | NO | Prove all 8 effective TRUNCATE=DENIED |
| `04_ROLLBACK.md` | docs | Rollback is **not** recommended (would restore insecure grants) |

## Execution

Requires a separate Owner GO naming this package and `TARGET_ENV`.
Wrappers must set `wave5.target_env` to `staging` or `production`.

Related Staging-only historical package remains under `staging-remediation/`
and is not replaced by this env-gated security package.
