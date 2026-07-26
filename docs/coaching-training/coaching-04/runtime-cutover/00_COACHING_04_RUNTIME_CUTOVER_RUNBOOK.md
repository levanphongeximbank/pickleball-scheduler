# COACHING-04 — Guarded Runtime Cutover Runbook

**Status:** Package authored — runtime inactive  
**Classification:** `COACHING_04_RUNTIME_CUTOVER_READY_WITH_PLAYER_UNMAPPED_GATE`  
**Staging:** `qyewbxjsiiyufanzcjcq`  
**Production:** untouched / refused  
**PR #292 dependency:** certification `fcecd79c2c0732e5bc7962fa1bfa91d6086818e6` · merge `98dedfc9814c4b81a6f3a5ffeae81aff9bf3bddd`

---

## Current certified state (must hold)

| Flag | Value |
|------|-------|
| `COACHING_DURABLE_RUNTIME_DEFAULT` | `false` |
| `LOCALSTORAGE_RETIRED` | `false` |
| `runtimeActivated` | `false` |
| `mappingRowCount` | `0` |
| Staging SQL/RLS/RPC | certified (PR #292) |
| Helper ACL anon/service_role/authenticated | `0/0/12` |

---

## Owner GO tokens (not granted)

| Token | Purpose |
|-------|---------|
| `COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING` | Staging-only durable Preview activation |
| `COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT` | Controlled LS retirement (separate later step) |

---

## Staging-only activation path (future Owner GO)

1. Confirm Staging target `qyewbxjsiiyufanzcjcq` (never Production `expuvcohlcjzvrrauvud`).
2. Set Preview env:
   - `VITE_APP_ENV=staging`
   - `VITE_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co`
   - `VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED=true`
3. Bind Owner GO evidence with exact commit SHA.
4. Inject `resolveTenantClub` + `resolveActor` + authenticated Supabase client.
5. Keep `COACHING_DURABLE_RUNTIME_DEFAULT=false` (global default stays legacy for Production builds).
6. Rollback: unset Vite flag **or** set mode `legacy` — legacy adapter retained.

---

## Explicit non-actions this package

- Do not flip `COACHING_DURABLE_RUNTIME_DEFAULT` to `true`.
- Do not set `LOCALSTORAGE_RETIRED=true`.
- Do not create mapping rows / fixtures / backfill.
- Do not call mutation RPCs.
- Do not touch Production.
- Do not merge without Owner review.

---

## Related docs

- `01_COACHING_04_STAGING_ONLY_ACTIVATION.md`
- `02_COACHING_04_PROVENANCE_AND_NO_SILENT_FALLBACK.md`
- `03_COACHING_04_LOCALSTORAGE_RETIREMENT_AND_ROLLBACK.md`
- `04_COACHING_04_MAPPING_READINESS_GATE.md`
- `05_COACHING_04_FAILURE_CLASSIFICATION.md`
