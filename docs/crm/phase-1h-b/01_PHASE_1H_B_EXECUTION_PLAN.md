# 01 — Phase 1H-B Execution Plan

**Phase:** CRM Phase 1H-B — Controlled Staging Apply and Live Post-Apply QA
**Branch:** `feature/crm-phase-1h-b-staging-apply`
**Starting HEAD:** `6285476fc2665a49a9e3f290ed5cb6a79c4c666d`
**Status at plan time:** Gates implemented; **no SQL write** until Owner tokens + Staging identity + backup evidence exist.

## Objectives (ordered)

1. Pre-apply safety baseline (repo / branch / manifest / flags)
2. Owner approval gates (four separate tokens — never inferred from 1H-A merge)
3. Staging identity gate (allowlist `qyewbxjsiiyufanzcjcq`, blocklist `expuvcohlcjzvrrauvud`)
4. Backup / restore evidence gate
5. Controlled migration apply (manifest order, SHA re-verify, stop on first error)
6. Post-apply schema / RLS / permission / RPC / cross-tenant QA
7. Runtime safety confirmation (durable off)
8. Evidence pack under `docs/crm/phase-1h-b/`
9. Regression tests + secret scan
10. Final certification verdict

## Controlled apply sequence (manifest)

| Order | Path | Notes |
|------:|------|-------|
| 1 | `docs/crm/phase-1g/10_CRM_PHASE_1G_TABLES.sql` | Requires Phase 1G apply approval |
| 2 | `docs/crm/phase-1g/20_CRM_PHASE_1G_INDEXES.sql` | |
| 3 | `docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql` | |
| 4 | `docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql` | |
| 5 | `docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql` | |
| 6 | `docs/crm/phase-1g/60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql` | |
| 7 | `docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql` | Requires permission-seed approval |
| 8 | `docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql` | Requires role-matrix approval; else **deferred** |

## Scripts

| Script | Role |
|--------|------|
| `scripts/crm/phase-1h-staging-preflight.mjs` | Offline + `--live-gates` (no SQL) |
| `scripts/crm/phase-1h-staging-apply.mjs` | Dry-run default; live apply only after gates |
| `src/features/crm/staging/phase1hBGates.js` | Fail-closed gate evaluator |

## Hard stops before any database write

- Wrong branch / workspace / unrelated dirty tree
- Missing any required Owner approval
- Staging identity unverified or Production detected
- Backup evidence missing
- Manifest checksum / order failure
- Required credentials missing
- Durable runtime enabled
- Apply script cannot prove Staging-only execution

## Explicit non-goals

- Production connection or Production SQL
- Deploy
- Enable durable CRM runtime
- Enable workers / Email / SMS / Push / Notification delivery
- Commit / push / PR unless separately instructed
- Print secrets, JWTs, passwords, keys, or database URLs
