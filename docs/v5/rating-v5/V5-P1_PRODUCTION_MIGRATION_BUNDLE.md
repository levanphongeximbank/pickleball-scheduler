# V5-P1 — Production Migration Bundle

**Gate:** P1-A complete readiness  
**Apply target:** Production `expuvcohlcjzvrrauvud` — **NOT APPLIED**

## Apply order (idempotent)

| Step | File | Purpose |
|------|------|---------|
| 1 | `PHASE_V5A_RATING_FOUNDATION.sql` | Tables, RLS base, permissions |
| 2 | `PHASE_V5B1_COMPLETE_ASSESSMENT.sql` | Version contract, scoring RPC |
| 3 | `PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql` | Service persistence RPC |
| 4 | `PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql` | Enrollment SOT, policy, invalidation |

## SHA256 checksums

Run before P1-B:

```bash
node scripts/compute-v5p1-migration-checksums.mjs
```

| File | SHA256 |
|------|--------|
| `PHASE_V5A_RATING_FOUNDATION.sql` | *(run script)* |
| `PHASE_V5B1_COMPLETE_ASSESSMENT.sql` | *(run script)* |
| `PHASE_V5B1P_PERSISTENCE_AND_EDGE.sql` | *(run script)* |
| `PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql` | *(run script)* |

Bundle manifest: `qa-evidence/v5-p1a-preflight/MIGRATION_CHECKSUMS.json`

## Safety

- No `DROP TABLE` on V2 or club data
- `CREATE IF NOT EXISTS` / `CREATE OR REPLACE` throughout
- Initial config sets `allow_v5_assessment = false`
- Cohort label: `club-rating-v5-production-pilot`

## Post-apply verification

```bash
# After P1-B only
psql or Supabase SQL editor — run:
docs/v5/rating-v5/V5-P1_PRODUCTION_VERIFICATION_QUERIES.sql
```

## Rollback

See `V5-P1_PRODUCTION_DISABLE_RUNBOOK.md` and `V5-P1_PRODUCTION_BACKUP_CHECKLIST.md`.
