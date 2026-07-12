# V5-D.2 — Staging Apply Runbook

**Phase:** Referee V5-D.2 — Staging Apply & Verification  
**Owner decision:** CONDITIONAL GO — STAGING ONLY  
**Production:** NOT PERFORMED

---

## Project refs (mandatory pre-flight)

| Environment | Project ref | Verified |
|-------------|-------------|----------|
| **Staging** | `qyewbxjsiiyufanzcjcq` | PASS |
| **Production** | `expuvcohlcjzvrrauvud` | PASS (different from staging) |

If refs match → **STOP — DO NOT APPLY**

---

## Pre-flight checklist

| Check | Expected | Actual |
|-------|----------|--------|
| Staging project | PASS | PASS |
| Not production | PASS | PASS |
| Branch | `feature/competition-core-standardization` | PASS |
| Working tree | Known changes (team-tournament + referee-v5 + rating-v5) | PASS (documented) |
| Migration files | V5A, V5D, V5D1 exist | PASS |
| Migration order | V5A → V5D → V5D1 | PASS |
| Rollback plan | `V5-D_ROLLBACK_PLAN.md` | PASS |
| Feature flag default | `VITE_REFEREE_V5_ENABLED=false` | PASS |
| Legacy untouched | `tournament_match_live` exists | PASS |

---

## Apply commands

```bash
# Option A — Management API (requires SUPABASE_ACCESS_TOKEN)
node scripts/apply-phase-v5d2-staging.mjs

# Option B — Supabase MCP staging apply_migration (applied 2026-07-12)
# phase_v5a_referee_foundation
# phase_v5d_referee_persistence
# phase_v5d1_referee_hardening (+ phase_v5d1_referee_hardening_rpcs)

# Seed isolated QA data
node scripts/seed-referee-v5-test-staging.mjs

# Verify
node scripts/verify-phase-v5d2-staging.mjs
```

---

## Migration order (do not reorder)

1. `docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql`
2. `docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql`
3. `docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql`

---

## Post-apply verification (each migration)

After each migration:

1. Object exists
2. Constraints / indexes
3. Triggers (append-only on `match_events`)
4. Functions (`referee_v5_*`)
5. Policies (RLS deny client write)
6. Grants (internal RPC → `service_role` only)
7. Legacy objects unchanged

---

## Edge Function deploy (staging)

```bash
node scripts/bundle-referee-v5-edge-shared.mjs
node scripts/deploy-referee-v5-edge-staging.mjs   # requires SUPABASE_ACCESS_TOKEN
```

Functions:

- `referee-v5-get-match-state`
- `referee-v5-apply-command`
- `referee-v5-finalize`

**Status:** Bundle scripts added; deploy blocked without `SUPABASE_ACCESS_TOKEN` in local env (see P1).

---

## Feature flags

| Environment | Flag | Value |
|-------------|------|-------|
| Production | `VITE_REFEREE_V5_ENABLED` | `false` |
| Staging QA | `VITE_REFEREE_V5_ENABLED` | `true` (when testing remote adapter) |

---

## Rollback (staging)

See `V5-D_ROLLBACK_PLAN.md` and `V5-D2_ROLLBACK_REHEARSAL.md`.

Do **not** drop append-only event tables before evidence export.

---

## Test data prefix

All QA fixtures use prefix `REFEREE_V5_TEST_`. Safe to delete after audit export.

Evidence: `docs/v5/qa-evidence/phase-v5d2/SEED_SQL.sql`
