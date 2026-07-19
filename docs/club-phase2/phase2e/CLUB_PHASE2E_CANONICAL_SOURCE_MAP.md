# Club Phase 2E — Canonical Source Map

| Value | Source of truth | Display source | Must NOT use |
|-------|-----------------|----------------|--------------|
| Owner user ID | `club_governance_assignments` (`club_owner`, active) via `phase42_club_canonical` | — | `profiles.club_id`, blob roles |
| President user ID | assignments (`president`) | — | `createdByUserId` inference under V2 |
| Vice-president user IDs | assignments (`vice_president`, ordered ≤2) | — | single legacy column alone |
| Active membership | `club_members` (active) | — | `profiles.club_id` |
| Display name | `profiles.display_name` (display-only) + RPC labels | read model `display_label` | `User <uuid>` under V2 |
| Avatar | `profiles.avatar_url` (display-only) | read model `avatar_url` | private profile fields |
| Club version | `clubs.version` | `club_version` on read model | localStorage version |
| Tenant identity | `clubs.tenant_id` | `tenant_id` on read model | arbitrary client override |

## Preferred read transport

1. Reuse `governance.get` → `club_get` / `phase42_club_canonical` (**done**).
2. Normalize with `toGovernanceReadModel` (**done**).
3. Optional safe profile hydration via `hydrateGovernanceDisplayProfiles` (tenant-checked).

**No new governance engine. NO_SQL_REQUIRED.**

## V2 OFF fallback

When `VITE_CLUB_STORAGE_V2` is not enabled, `governanceGet` returns `provider: "legacy-registry"` from local registry. Documented as **not Production authority**.
