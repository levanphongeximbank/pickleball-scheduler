# Live Cutover Package (NOT APPLIED)

## Migration files

1. `docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/sql/10_CANONICAL_TOURNAMENTS.sql`
2. `docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/sql/90_ROLLBACK.sql`

## RPC changes

- `canonical_tournament_list`
- `canonical_tournament_get`
- `canonical_tournament_create`
- `canonical_tournament_update`
- `canonical_tournament_delete`
- `canonical_tournament_list_mine`
- `canonical_tournament_apply_engine_state`

## Table changes

- `public.canonical_tournaments` (+ RLS)

## Env flag changes (after SQL)

```
VITE_TOURNAMENT_CANONICAL_DATA_MODE=cloud
VITE_TOURNAMENT_CANONICAL_CUTOVER=true
VITE_TEAM_TOURNAMENT_SUPABASE=true
VITE_TEAM_TOURNAMENT_DATA_MODE=cloud_only
VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=remote
```

## Order of application

1. Backup Production/Staging
2. Apply `10_CANONICAL_TOURNAMENTS.sql`
3. One-time migrate organizer tournaments from `club_data_v3` blob → `canonical_tournaments` (script TBD at live GO)
4. Set env flags on Preview → Staging → Production
5. Smoke test
6. Remove transitional blob repository in follow-up PR if stable

## Rollback

1. Revert env to `transitional_blob` / prior TT mode
2. Apply `90_ROLLBACK.sql` only if no irreversible dependent data required
3. Redeploy previous app build if needed

## Expected data loss/reset

- Hard cutover may drop unmigrated local-only browser blob tournaments
- Owner is sole Production user → prefer hard cutover over long dual-run

## Post-cutover smoke

- `/tournament` hub stats load
- Create each mode (daily/internal/official/team)
- `/tournament/list` and `/tournament/my` same set
- Public `/tournaments` remote empty/error honest (no mock)
- Engine deep routes still open
- Referee hub opens
- Team cloud_only create/load

**OWNER_GO_REQUIRED_FOR_LIVE_CUTOVER=YES**
