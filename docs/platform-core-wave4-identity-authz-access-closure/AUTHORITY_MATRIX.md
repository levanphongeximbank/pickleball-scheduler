# Authority matrix after Wave 4 local implementation

| Concept | Canonical authority | Not evidence |
|---|---|---|
| Authentication | Supabase Auth | Dev registry (local non-secure only) |
| Actor / subjectId | `auth.uid` = `profiles.id` | JWT metadata (secure deny) |
| Identity status | `profiles.status` fail-closed | missing → ACTIVE |
| Role | `profiles.role` normalized once | JWT role (secure deny); governance is overlay |
| Tenant entitlement | `tenant_members` active rows are Tenant **operational** entitlement only. Not login, not Player/Referee/Club/Coach membership. | `profiles.tenant_id`, selected tenant, venueId, role-synthesized rows |
| Tenant context | home hint (`profiles.tenant_id`) or catalog target. `CONTEXT_AVAILABLE != OPERATIONAL_AUTHORIZED`. | operational grant |
| Venue entitlement | Home `profiles.venue_id` equality for venue-scoped roles; SA explicit target | Selected venue |
| Club entitlement | Bound club membership snapshot / RPC, or explicit club governance overlay (owner/president/vice) | `profiles.club_id` alone, selected club, venue-role-all-clubs |
| Super Admin directory | Global role | Selected tenant |
| Super Admin operate | Global authorization + explicit target | `matchesScope()` with missing resource |
| SYSTEM_TECHNICIAN | Explicit technical permission list. Business mutations DENY without separate resource entitlement. Unscoped business capability DENY. | `isPlatformWideRole` business grants; empty-scope CLUSTER_MANAGE |
| Selected Tenant/Venue/Club | Reauthorized preference / context target | Entitlement / authorization proof |

## Bounded gaps (not invented)

- `tenant_members.role_code` is `tenant_owner` \| `tenant_staff` only. No separate TENANT_ADMIN invented.
- Live `tenant_members` readiness is **not verified** until Owner re-preflight.
- DB `user_tenant_id() = COALESCE(tenant_id, venue_id)` remains (`DATABASE_USER_TENANT_VENUE_FALLBACK_RETIRE=NOT_YET`).
- `phase42_is_tenant_member` global helper retirement is **DEFERRED**. Table policy for `tenant_members` is independently remediable.
- Identity RPC canonical scope remains **OPEN**.
- `OWNER_APPROVED_MEMBERSHIP_MANIFEST_REQUIRED=YES`.
