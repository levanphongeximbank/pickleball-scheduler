# Club Phase 2E — Governance Read Inventory

**Date:** 2026-07-19  
**Branch:** `feature/club-phase-2e-governance-read-model-ui`  
**Base:** `origin/main` @ Phase 2D CLOSED

## Classifications

| Code | Meaning |
|------|---------|
| CANONICAL | Production V2 authority path |
| LEGACY | V2 OFF / local registry only |
| DUPLICATE | Same data via alternate entry (now routed through read model) |
| STALE_INFERENCE | Unsafe inference (mitigated under V2) |
| READ_ONLY_HELPER | Display helper |
| DEAD_CODE | Not Production SoT under V2 |
| UNSAFE | Must not prove governance |

## Production-reachable inventory (post-2E)

| Path | File | Classification | Notes |
|------|------|----------------|-------|
| `phase42_club_canonical` / `club_get` | SQL + `rpcV2ClubGet` | CANONICAL | SoT refs + labels |
| `governance.get` | `api/governanceApi.js` | CANONICAL | Freeze port + `readModel` |
| `toGovernanceReadModel` | `context/governanceCanonicalReadModel.js` | CANONICAL | Normalized DTO |
| `readClubGovernance` | `services/governanceReadService.js` | CANONICAL | Service reader |
| `useGovernanceReadModel` | `hooks/useGovernanceReadModel.js` | CANONICAL | UI hook |
| `getGovernanceDisplayLabels` | `clubGovernanceService.js` | READ_ONLY_HELPER | Delegates to read model |
| `club_list_members.governance_roles` | member list | CANONICAL | Badge codes |
| `resolveMemberGovernanceRoleLabel` | read model | CANONICAL | Badge labels |
| Local `pickleball-clubs-v1` | domain clubService | LEGACY | V2 OFF only |
| `profiles.club_id` | profiles | UNSAFE | Explicitly ignored |
| Blob role strings | extension members | STALE_INFERENCE | Ignored under V2 |
| Legacy `club_governance` table sync | cloud sync | DEAD_CODE / LEGACY | Not V2 SoT |

## UI surfaces

| Surface | Integration |
|---------|-------------|
| Club Home / My Club | `useGovernanceReadModel` in `MyClubPage.jsx` |
| Member list | `resolveMemberGovernanceRoleLabel` via `myClubViewLogic.js` |
| Management | `useGovernanceReadModel` in `ClubGovernancePanel.jsx` |
| Org / Governance panels | `getGovernanceDisplayLabels` → read model |
| Discover cards | RPC `presidentLabel` / display labels helper |
