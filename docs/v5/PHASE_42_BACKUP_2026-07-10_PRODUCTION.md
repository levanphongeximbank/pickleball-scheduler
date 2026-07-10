# Phase 42 — Production backup snapshot

**Gate:** `GO PRODUCTION RESET` (2026-07-10)  
**Project:** Supabase Production

## Pre-reset counts

| Object | Count |
|--------|------:|
| auth.users | 18 |
| profiles | 18 |
| venues | 1 (`venue-prod-main`) |
| club_governance | 1 |
| club_data_v3 | 1 |
| team_tournaments | 7 |
| court_clusters | 1 |
| audit_logs | 138 |

## Keep

- All `auth.users` / login accounts
- `profiles` rows (club_id/player_id cleared)
- `venues` (`venue-prod-main`)
- Billing tables, roles/permissions, migration history
- Vercel project / env (add `VITE_CLUB_STORAGE_V2=true` after schema)

## Wipe scope

Trial business data per `PHASE_42_CLUB_STORAGE_CLEAN_RESET.md` §2–3.

## Post-reset verification (2026-07-10)

| Object | Count |
|--------|------:|
| auth.users | 18 |
| profiles | 18 |
| venues | 1 (`venue-prod-main`) |
| clubs | 0 |
| club_members | 0 |
| club_governance_assignments | 0 |
| tenant_members | 1 |
| club_data_v3 | 0 |
| team_tournaments | 0 |
| court_clusters | 0 |
| profiles with club_id/player_id | 0 |

Legacy overloads dropped: only V2 `club_list_registry(text,boolean)` and `club_submit_membership_request(uuid,text,text)` remain.

## Rollback

Restore from Supabase dashboard backup / prior dump if available. Do not delete Auth users.
