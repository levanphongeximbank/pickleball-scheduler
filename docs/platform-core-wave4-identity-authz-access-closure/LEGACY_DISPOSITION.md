# Legacy disposition (L01–L22)

| ID | Disposition |
|---|---|
| L01 login venue→tenant bridge | Retired from Actor/authz path. Function kept for Wave 3 local venue stamp / tests. |
| L02 mapProfileRowToUser ACTIVE default | Migrated to canonical projection. |
| L03 tenantId \|\| venueId in RBAC | Migrated (tenantId only). |
| L04 profile clubId authorization | Migrated; membership port, explicit overlay, or club governance evidence required. `profiles.club_id` is not a sole grant. |
| L05 missing-id tenant guard allow | Migrated to TARGET_REQUIRED when RBAC on. |
| L06 venue role = all clubs | Removed. Home venue equality only. |
| L07 isPlatformWideRole business grants | Split: SA vs SYSTEM_TECHNICIAN. Function remains for non-authz callers. |
| L08 Super Admin unscoped matchesScope | Migrated: view/directory vs explicit operational target. |
| L09 identity RPC privileged fallback | Secure deny. Local non-secure isolated. |
| L10 unscoped listUsers fallback | Secure deny. Local requires venue target unless SA. |
| L11 status ACTIVE default | Actor projection fail-closed. `createUserRecord` still defaults ACTIVE for explicit construction. |
| L12 JWT role fallback | Non-secure / RBAC-off only. |
| L13 DEV_USERS | Local non-secure only. |
| L14 DB SUPER_ADMIN compatibility | Kept (`denormalizeRoleForDb`). |
| L15 Auth Club/Cluster imports | clubScopeResolver retained for venue-club registry matching; club membership goes through bound port. |
| L16 feature profiles queries | Identity admin fallback only on local non-secure. |
| L17 DB user_venue_id / user_tenant_id | DOCUMENT ONLY. No SQL. |
| L18 tenant_members unwired | Wired via entitlement port + adapter. |
| L19 accessService vs rbac | SA target-required aligned; identity RBAC remains production decision path. |
| L20 public-by-omission routes | Unchanged classification; secure RBAC-off no longer allow-all on protected routes. |
| L21 localStorage live role | Session cache; identity revalidated on bootstrap. |
| L22 persisted tenant as scope authority | Reauthorization required; failed hydrate clears authorized context. |
