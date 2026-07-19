# Club Phase 2D — Security Audit

## Findings

1. **FIXED (code):** Legacy `updateClubGovernance` could mutate owner/president/VP in local registry under V2 ON because `updateClubMeta` lacked a legacy gate. Now blocked via `assertLegacyGovernanceRoleWriteAllowed`.

2. **FIXED (barrel):** Raw `rpcV2ClubAssignOwner` / clear / transfer / VP were exported from `features/club/index.js`. Removed; callers use service or `governanceApi`.

3. **SQL STAGING APPLIED:** `phase42_can_transfer_president` + narrowed `club_transfer_president` on Staging `qyewbxjsiiyufanzcjcq` (2026-07-19T15:50:44.214Z). Production still broad until Owner GO.

4. **PASS:** Owner assign/clear already narrowed (Phase 1C). VP helpers already narrow (Phase 1B). DEFINER + `search_path=public`. Grants to `authenticated` only. Actor spoofing impossible (auth.uid()). Eligibility via `club_members.status='active'` not `profiles.club_id`.

5. **ACCEPTED:** Client `writeAuditLog` may fire after RPC success — not server SoT; failures before RPC emit no server audit.
