# CC-02C — Migration Dry Run

Phase: **CC-02C** | Staging/production: **NOT APPLIED**

## Script

```bash
node scripts/cc02c-migration-dry-run.mjs
```

Optional env (local/test only):

- `CC02C_LOCAL_DB_URL`
- `LOCAL_DATABASE_URL`
- `DATABASE_URL`

## SQL files (apply order)

1. `docs/competition-core/supabase-cc02-rating-v2.sql`
2. `docs/competition-core/supabase-cc02c-rating-durability.sql`

## Checklist

| Check | Local run (2026-07-11) | Notes |
|-------|------------------------|-------|
| First apply CC-02 + CC-02C | SKIPPED | No local DB URL configured |
| Verification SQL | SKIPPED | Static review only |
| Duplicate/idempotent apply | SKIPPED | RPC catches `unique_violation` in SQL design |
| RLS player cannot update `competition_elo` | PARTIAL | Policy defined in SQL; live verify at staging QA |
| Unique idempotency constraint | PASS (static) | `unique(match_id, player_id, rating_type)` in proposal |
| Transaction rollback on mid-flight error | PARTIAL | RPC raises → PG rollback; unit tests cover blob path |

## Machine-readable report

Generated: `docs/competition-core/CC02C_MIGRATION_DRY_RUN.json`

## Verdict

**PARTIAL** — SQL/RPC proposal complete; live database dry-run blocked (no local Postgres URL in CI/dev env).

Preview deployment: **NOT DEPLOYED**  
Staging migration: **NOT APPLIED**  
Production migration: **NOT APPLIED**
