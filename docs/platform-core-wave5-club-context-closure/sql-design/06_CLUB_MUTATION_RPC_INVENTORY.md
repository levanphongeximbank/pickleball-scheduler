# Wave 5 — Club mutation RPC inventory

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
SQL_EXECUTED=NO
```

Live/current canonical definitions in repo (latest authored body wins). `p_tenant_id` after cutover means **Platform Tenant ID**. Row `tenant_id` on Club-owned tables means **Platform Tenant ID**.

| RPC | INPUT_TENANT_SEMANTIC | TABLES_WRITTEN | TENANT_ID_WRITTEN | VENUE_ID_USED | AUTHZ_HELPER | POST_WAVE5_SAFE |
|---|---|---|---|---|---|---|
| `club_create` | Today: treated as `venues.id`. Design: Platform Tenant ID | `clubs`, `club_members`, `club_governance_assignments` | copies `p_tenant_id` | registered cluster validated independently via `court_clusters` → `venues` topology; must not redefine Club tenant | `phase42_can_create_in_tenant` (tenant_members + SA + PLAYER/CLUB_MANAGER club.create). Existence: `platform_tenants` | YES after APPLY (was NO: `venues.id = p_tenant_id`) |
| `club_update` | none in args; uses `clubs.tenant_id` | `clubs` | unchanged | optional `registered_cluster_id` is facility, not tenant identity | `phase42_can_update_club` (must drop `profiles.venue_id = c.tenant_id`) | YES after helper patch |
| `club_assign_owner` / `club_clear_owner` | none in args | `club_governance_assignments`, `clubs.version` | copies `v_club.tenant_id` | none | `phase42_can_assign_club_owner` (must drop venue coincidence) | YES after helper patch |
| `club_transfer_president` | none in args | `club_governance_assignments`, `clubs.version` | copies `v_club.tenant_id` | none | `phase42_can_transfer_president` (must drop venue coincidence) | YES after helper patch |
| VP assign/clear (`club_assign_vice_president`, `club_clear_vice_president`) | none in args | `club_governance_assignments` | copies `v_club.tenant_id` | none | `phase42_can_manage_vice_presidents` / gov roles | YES after data cutover (copies Club tenant) |
| `club_add_member` / `club_remove_member` | none in args | `club_members` (+ athlete ensure) | copies `v_club.tenant_id` | athlete helper currently receives Club tenant as if Venue | `phase42_can_review_membership` | YES after athlete compatibility wrapper |
| `club_restore_member` | none in args | `club_members` (+ athlete ensure) | copies `v_club.tenant_id` | same athlete issue | review/restore authz | YES after athlete compatibility wrapper |
| `club_leave_membership` | none in args | `club_members` | unchanged | none | self + gov block | YES after data cutover |
| `club_submit_membership_request` | none in args | `club_membership_requests_v42` | copies `v_club.tenant_id` | none | authenticated non-SA | YES after data cutover |
| `club_cancel_membership_request` | none in args | `club_membership_requests_v42` | unchanged | none | requester | YES after data cutover |
| `club_review_membership_request` | none in args | requests + `club_members` (+ athlete) | copies request/club tenant | athlete helper uses `v_row.tenant_id` | `phase42_can_review_membership` | YES after athlete compatibility wrapper |
| `club_list_registry` | `p_tenant_id` = Platform Tenant filter | none (read) | n/a | none | `platform_is_canonical_tenant_entitled` | YES in APPLY |
| `club_get` / `club_list_members` / `club_list_pending_requests` / `club_list_discoverable` | none / Club id | none (read) | n/a | list_members used `phase42_is_tenant_member` (venue coincidence via profiles.venue_id) | swap Club path to canonical entitlement | YES after APPLY |
| `club_delete` / deactivate RPC | **no canonical RPC** | n/a | n/a | n/a | app `updateClub` status=inactive via `club_update` | N/A (no separate delete RPC) |
| `club_upsert_registry` / `club_claim_self_registration` | legacy Venue registry | `club_governance` V1 | venue-shaped | Venue | V2-OFF only | N/A (not canonical V2 write plane) |

No mutation may depend on Tenant ID == Venue ID. Global `phase42_is_tenant_member` is **not** dropped.
