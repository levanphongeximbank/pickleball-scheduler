# CUSTOMER-07 — Staging Apply & Live Integration Certification

**Branch:** `feature/customer-management-phase-7-staging-live-certification`  
**Scope:** Apply CUSTOMER-03 → 06 on Supabase Staging only, then live-certify.  
**Non-goals:** Production apply, UI, package dependency changes, other-module internals.

## Scripts

| Script | Role |
|--------|------|
| `node scripts/customer/phase-7-staging-preflight.mjs` | Offline static + safety |
| `node scripts/customer/phase-7-staging-preflight.mjs --live-gates --environment=staging` | Identity + backup probe |
| `node scripts/customer/phase-7-staging-apply.mjs --dry-run` | Manifest plan |
| `node scripts/customer/phase-7-staging-apply.mjs --apply-staging --environment=staging` | Controlled apply |
| `node scripts/customer/phase-7-staging-live-certify.mjs` | Live schema/RLS/repo suite |
| `node scripts/customer/phase-7-staging-cleanup.mjs` | Delete `CUSTOMER07_TEST_*` only |

## Gates (must PASS before write)

1. Safety baseline (branch, CUSTOMER-06 ancestry, CRM stash, package/lockfile)
2. Staging environment identity (`qyewbxjsiiyufanzcjcq`, not Production, not `pickvn.app`)
3. Backup/rollback (rollback SQL + soft-disable + pre-apply object state)
4. Credentials (Staging URL, access token, staging service role, anon)
5. Manifest SHA pin (23 migrations)

## Evidence

`docs/customer-management/phase-7/evidence/` — JSON only, no secrets.
