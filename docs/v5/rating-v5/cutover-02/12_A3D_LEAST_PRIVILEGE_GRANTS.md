# RATING-V5-CUTOVER-02 — Gate A3d-Security Least-Privilege Grants

```text
A3D_SECURITY_SQL_APPLY_GO=NO
A3C_COHORT_PREPARATION_GO=NO
A3C_EDGE_INVOCATION_GO=NO
SQL_EXECUTION=0
```

## Root cause

Staging `pg_default_acl` for `postgres` on `public` functions grants:

`{postgres=X, authenticated=X, service_role=X}`

A3c migration `rating_v5_cutover_02_a3c_fixture_prep_v1` only `REVOKE … FROM PUBLIC` and
`GRANT … TO service_role` on the two service RPCs. It did **not** revoke
`authenticated`, so default ACL left `authenticated=X` on all four A3c functions.

## Edge call path

| Step | Client | Operation |
|------|--------|-----------|
| JWT verify | user (anon + Bearer) | `auth.getUser()` |
| Caller authZ | user | `profiles` select role/status → SUPER_ADMIN |
| Mutation | service_role | `rating_v5_cutover_02_a3c_service_create_fixture_assessment` |

Removing `authenticated` EXECUTE does **not** break the approved Edge path.

## Intended grants (all four A3c functions)

REVOKE: PUBLIC, anon, authenticated  
GRANT: service_role only  

No authenticated exception.

## Corrective SQL (author only)

`docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3D_LEAST_PRIVILEGE_GRANTS.sql`  
Identity: `rating_v5_cutover_02_a3d_least_privilege_grants_v1`
