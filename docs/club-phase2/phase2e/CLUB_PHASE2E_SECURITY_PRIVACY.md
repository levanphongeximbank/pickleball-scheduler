# Club Phase 2E — Security & Privacy Review

| Check | Result |
|-------|--------|
| Tenant isolation | Profile hydration denies cross-tenant (`deniedCrossTenantIds`) |
| Public visibility | Unchanged; uses existing club visibility / RPC authz |
| Private profile fields | Only `display_name` + `avatar_url` hydrated |
| Client role elevation | Read model does not elevate; authz still via `phase42_has_gov_role` / gates |
| Raw mutation RPC via read | Not exposed; freeze ports only |
| Missing profile bypass | No — missing display does not invent membership/governance |
| Cross-tenant ID hydration | Denied when club tenant known and profile tenant differs |
| `profiles.club_id` | Ignored for eligibility (`source.ignored.profiles_club_id`) |

**Verdict:** PASS for Phase 2E read integration.
