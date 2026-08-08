# Live Cutover Package (NOT APPLIED)

## Owner data policy

`LEGACY_TOURNAMENT_DATA_MIGRATION=SKIPPED_BY_OWNER_POLICY`

- Do **not** migrate club_data_v3 / localStorage / MOCK tournaments.
- `canonical_tournaments` starts clean after SQL apply.
- Rollback = schema/deploy rollback, not dual-running legacy authority.

## Migration files

1. `supabase/migrations/20260808100000_canonical_tournaments_cutover.sql` (**deployable**)
2. Evidence copy: `docs/v5/qa-evidence/.../sql/10_CANONICAL_TOURNAMENTS.sql`
3. Rollback: `docs/v5/qa-evidence/.../sql/90_ROLLBACK.sql`

## Env (after SQL)

```
VITE_TOURNAMENT_CANONICAL_DATA_MODE=cloud
VITE_TOURNAMENT_CANONICAL_CUTOVER=true
VITE_TEAM_TOURNAMENT_SUPABASE=true
VITE_TEAM_TOURNAMENT_DATA_MODE=cloud_only
VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=remote
```

## Order

1. Backup
2. Apply supabase migration
3. Set env Preview → Staging → Production
4. Smoke: create daily/internal/official/team; list/my; engine apply; public remote
5. No blob dual-run

## Auth

SECURITY DEFINER RPCs require `user_has_permission` + tenant (`user_venue_id`).
PUBLIC/anon EXECUTE revoked.

**OWNER_GO_REQUIRED_FOR_LIVE_CUTOVER=YES**
