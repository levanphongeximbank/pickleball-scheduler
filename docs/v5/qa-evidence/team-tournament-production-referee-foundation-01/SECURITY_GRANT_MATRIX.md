# Security / grant matrix

TENANT_MODEL: organizer tenancy = `user_venue_id()` + `team_tournament_assert_tenant`.
Player identity remains `auth.uid() → athletes.user_id → athletes.id`.
Referee identity = `auth.uid() = referee_assignments.referee_user_id`.
Captain remains temporary tournament/team `captain_player_id`.

| Object | anon | authenticated | service_role |
|--------|------|---------------|--------------|
| `referee_assignments` table | REVOKE ALL | SELECT only (RLS) | ALL (BYPASSRLS) |
| `match_live_states` table | REVOKE ALL | SELECT only (RLS) | ALL |
| `team_sub_match_referee_links` table | REVOKE ALL | SELECT only (RLS) | ALL |
| `create_referee_assignment` | DENY EXECUTE | GRANT EXECUTE | GRANT EXECUTE |
| `build_v5_state_shell` | DENY | DENY (internal) | GRANT |
| `provision_eligibility` | DENY | DENY (internal) | GRANT |
| `referee_v5_match_state_id` | DENY | DENY (internal) | GRANT |
| `assignment_effective_status` | DENY | GRANT (read helper) | GRANT |
| `current_user_has_assignment` | DENY | GRANT (RLS helper) | GRANT |

ANON_TABLE_WRITE=DENY  
ANON_REFEREE_RPC_EXECUTE=DENY  
ANON_EXECUTE_REQUIRED=NO  
PERMISSION_CATALOG_DML=NO  
No `GRANT EXECUTE TO PUBLIC`.

RLS: ENABLE + FORCE on all three tables.  
SELECT: super admin OR (`tenant_id = user_venue_id()` AND `can_manage()`) OR assigned referee.  
INSERT/UPDATE/DELETE for `authenticated`: deny (SECURITY DEFINER RPCs write).
