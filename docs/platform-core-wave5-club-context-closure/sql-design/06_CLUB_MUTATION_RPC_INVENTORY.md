# Wave 5 — Club mutation RPC inventory

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
SQL_EXECUTED=NO
```

Live/current canonical definitions in repo (latest authored body wins). `p_tenant_id` after cutover means **Platform Tenant ID**. Row `tenant_id` on Club-owned tables means **Platform Tenant ID**.

```
ROUND3_BLOCKER_01_INTERNAL_HELPER_PRIVILEGE=FIXED
ROUND3_BLOCKER_02_REGISTERED_CLUSTER_TENANT_BINDING=FIXED
WAVE5_ATHLETE_HELPER_DIRECT_AUTHENTICATED_EXECUTE=DENY
SQL_DESIGN_REVIEW_ROUND3_REMEDIATION=COMPLETE_PENDING_ROUND4_OWNER_REVIEW
```

**ATHLETE_EXISTING_REUSE_POLICY=APPROVED**
**ATHLETE_NEW_CREATE_NO_FACILITY_POLICY=FAIL_CLOSED_ATHLETE_FACILITY_VENUE_REQUIRED**
**ATHLETE_NO_CLUSTER_POLICY=reuse existing athlete if any; else require registered_cluster_id → court_clusters.venue_id → venues.id with venues.tenant_id = clubs.tenant_id; else ATHLETE_FACILITY_VENUE_REQUIRED**

Internal helpers `wave5_ensure_athlete_for_club_member` / `wave5_resolve_club_facility_venue_id`: no authenticated EXECUTE. Public Club command RPCs keep authenticated EXECUTE.

| RPC | INPUT_TENANT_SEMANTIC | TABLES_WRITTEN | TENANT_ID_WRITTEN | VENUE_ID_USED | AUTHZ_HELPER | POST_WAVE5_SAFE |
|---|---|---|---|---|---|---|
| `club_create` | Today: treated as `venues.id`. Design: Platform Tenant ID | `clubs`, `club_members`, `club_governance_assignments` | copies `p_tenant_id` | registered cluster validated independently via `court_clusters` → `venues` topology; must not redefine Club tenant | `phase42_can_create_in_tenant` (tenant_members + SA + PLAYER/CLUB_MANAGER club.create). Existence: `platform_tenants` | YES after APPLY (was NO: `venues.id = p_tenant_id`) |
| `club_update` | none in args; uses `clubs.tenant_id` | `clubs` | unchanged | optional `registered_cluster_id` is facility, not tenant identity | `phase42_can_update_club` (must drop `profiles.venue_id = c.tenant_id`) | YES after helper patch |
| `club_assign_owner` / `club_clear_owner` | none in args | `club_governance_assignments`, `clubs.version` | copies `v_club.tenant_id` | none | `phase42_can_assign_club_owner` (must drop venue coincidence) | YES after helper patch |
| `club_transfer_president` | none in args | `club_governance_assignments`, `clubs.version` | copies `v_club.tenant_id` | none | `phase42_can_transfer_president` (must drop venue coincidence) | YES after helper patch |
| VP assign/clear (`club_assign_vice_president`, `club_clear_vice_president`) | none in args | `club_governance_assignments` | copies `v_club.tenant_id` | none | `phase42_can_manage_vice_presidents` / gov roles | YES after data cutover (copies Club tenant) |
| `club_add_member` | none in args | `club_members` (+ athlete ensure) | copies `v_club.tenant_id` (Club Tenant) | facility Venue via `wave5_ensure_athlete_for_club_member(club_id)` only | `phase42_can_review_membership` or Super Admin | YES |
| `club_remove_member` | none in args | `club_members` | copies/unchanged Club tenant | none | `phase42_can_review_membership` | YES after data cutover |
| `club_restore_member` | none in args | `club_members` (+ athlete ensure) | copies `v_club.tenant_id` | facility Venue via `wave5_ensure_athlete_for_club_member` | `phase42_can_review_membership` or Super Admin | YES |
| `club_leave_membership` | none in args | `club_members` | unchanged | none | self + gov block | YES after data cutover |
| `club_submit_membership_request` | none in args | `club_membership_requests_v42` | copies `v_club.tenant_id` | none | authenticated non-SA | YES after data cutover |
| `club_cancel_membership_request` | none in args | `club_membership_requests_v42` | unchanged | none | requester | YES after data cutover |
| `club_review_membership_request` | none in args | requests + `club_members` (+ athlete) | copies request/club tenant | facility Venue via `wave5_ensure_athlete_for_club_member(club_id)` | `phase42_is_super_admin` or `phase42_has_gov_role(owner/president/VP)` (42N; not 42I1 `can_review_membership`) | YES |
| `club_list_registry` | `p_tenant_id` = Platform Tenant filter | none (read) | n/a | none | `platform_is_canonical_tenant_entitled` | YES in APPLY |
| `club_get` / `club_list_members` / `club_list_pending_requests` / `club_list_discoverable` | none / Club id | none (read) | n/a | list_members used `phase42_is_tenant_member` (venue coincidence via profiles.venue_id) | swap Club path to canonical entitlement | YES after APPLY |
| `club_delete` / deactivate RPC | **no canonical RPC** | n/a | n/a | n/a | app `updateClub` status=inactive via `club_update` | N/A (no separate delete RPC) |
| `club_upsert_registry` / `club_claim_self_registration` | legacy Venue registry | `club_governance` V1 | venue-shaped | Venue | V2-OFF only | N/A (not canonical V2 write plane) |

No mutation may depend on Tenant ID == Venue ID. Global `phase42_is_tenant_member` is **not** dropped.

### Affected RPC explicit-body scoreboard (Round 2)

Authoritative sources (no overload in repo):

| FUNCTION_NAME | EXACT_SIGNATURE | RETURN_TYPE | SECURITY_DEFINER | SEARCH_PATH | CURRENT_AUTHZ_HELPER | TABLES_WRITTEN | CURRENT_ATHLETE_ENSURE_CALL | LATEST_AUTHORITATIVE_DEFINITION_PATH | EXPLICIT_REVIEWED_BODY_IN_APPLY | POST_WAVE5_SAFE | ATHLETE_FACILITY_POLICY |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `club_add_member` | `(uuid, text, uuid, text, integer)` | json | YES | public | Super Admin or `phase42_can_review_membership` | `club_members` | `wave5_ensure_athlete_for_club_member(user, club_id, display_name)` | `docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql` | YES | YES | reuse existing athlete; else cluster→venue; else `ATHLETE_FACILITY_VENUE_REQUIRED` |
| `club_restore_member` | `(uuid, text, uuid, integer)` | json | YES | public | Super Admin or `phase42_can_review_membership` | `club_members` | coalesce(row `athlete_id`, wave5 helper) | `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` | YES | YES | same |
| `club_review_membership_request` | `(uuid, uuid, text, text, integer)` | json | YES | public | Super Admin or `phase42_has_gov_role` owner/president/VP | requests + `club_members` | wave5 helper on `v_row.club_id` | `docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql` | YES | YES | same |

`EXPLICIT_REVIEWED_BODY_IN_APPLY=NO` for all other Club RPCs in this inventory (they were already explicit in APPLY from Round 1; they were not the P1-01 regexp targets).
