# CC-02D — SQL Review (pre-apply)

## Files & order

1. `supabase-cc02-rating-v2.sql` (CC-02A)
2. `supabase-cc02c-rating-durability.sql` (CC-02C)
3. `supabase-cc02d-staging-hardening.sql` (CC-02D patch)

## Safety checklist

| # | Requirement | Verdict |
|---|-------------|---------|
| 1 | Migration order clear | PASS |
| 2 | No drop of existing production tables | PASS — only `CREATE IF NOT EXISTS` |
| 3 | No overwrite of legacy rating data | PASS — new tables only |
| 4 | No automatic backfill / scale conversion | PASS |
| 5 | RLS enabled on sensitive tables | PASS |
| 6 | PLAYER cannot update `competition_elo` directly | PASS — update policy `using(false)` |
| 7 | SECURITY DEFINER only on atomic RPC | PASS |
| 8 | RPC `search_path = public` | PASS |
| 9 | EXECUTE limited to `service_role` + `authenticated` | PASS |
| 10 | Unique idempotency constraint | PASS — `(match_id, player_id, rating_type)` |
| 11 | Idempotent re-run | PASS |
| 12 | Rollback plan CC-02 scoped only | PASS — commented drops |

## CC-02D hardening additions

- Check constraints: `competition_match_count >= 0`, `public_skill_level` 1.0–8.0
- `rating_history` RLS deny-all for clients
- Advisory transaction lock per match (`pg_advisory_xact_lock`)
- Authenticated director/club_admin path inside RPC
- Postgres/service_role bypass for staging SQL verification (not anon)

## Verdict

**SAFE for staging apply.**

Production: **NOT APPLIED**
