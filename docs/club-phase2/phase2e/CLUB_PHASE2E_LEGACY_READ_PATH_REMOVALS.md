# Club Phase 2E — Legacy Read-Path Removals / Mitigations

| Legacy / stale path | Action in 2E |
|---------------------|--------------|
| UI ad-hoc `fetchGovernanceNameHints` on Home | Removed; replaced by `useGovernanceReadModel` |
| `getGovernanceDisplayLabels` blob/`User uuid` under V2 | Routed through read model; missing → `Chưa có thông tin` |
| Member badge duplicate resolvers | Delegated to `resolveMemberGovernanceRoleLabel` |
| `profiles.club_id` eligibility | Explicitly ignored in read model |
| Legacy blob roles as V2 SoT | Explicitly ignored (`legacy_blob_roles`) |
| Direct UI table reads for governance | Not introduced; still via `club_get` / freeze port |

Not deleted (still needed for V2 OFF / writers): local registry, `normalizeClubGovernance` create-path helpers.
