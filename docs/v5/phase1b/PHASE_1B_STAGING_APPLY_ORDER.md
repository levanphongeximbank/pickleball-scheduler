# Phase 1B — V2 Command Completion (Staging apply order)

**Production deployment status: NOT APPLIED**

Do not run these SQL files against Production from this branch.

## Staging apply order

1. `docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql` — `club_update`
2. `docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql` — `club_add_member` / `club_remove_member`
3. `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql` — `club_restore_member`
4. `docs/v5/phase1b/PHASE_1B_V2_COMMAND_COMPLETION.sql` — VP hydrate + VP RPCs + final audit whitelist

## Forbidden

- No `TRUNCATE`
- No drop of `clubs` / `club_members` / assignments tables
- No Production apply without separate GO decision

## Client wiring (this PR)

| RPC | Client |
|-----|--------|
| `club_update` | `rpcV2ClubUpdate` → `clubTenantService.updateClub` |
| `club_assign_vice_president` | `rpcV2ClubAssignVicePresident` → `setClubVicePresidents` (V2) |
| `club_clear_vice_president` | `rpcV2ClubClearVicePresident` → `setClubVicePresidents` (V2) |
| `club_add_member` | `rpcV2ClubAddMember` → `addMemberToClub` |
| `club_remove_member` | `rpcV2ClubRemoveMember` → `removeMemberFromClub` |
| `club_restore_member` | `rpcV2ClubRestoreMember` → `restoreMemberToClub` |
| `club_list_members` (recipients) | `clubScheduleNotificationBridge` (V2) |
