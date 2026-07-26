# Finance — Scope Reconciliation

**Module:** Finance  
**Classification:** `STRUCTURAL_FOUNDATION_COMPLETE`  
**A/B verdict:** **A** — canonical domain / persistence / authorization foundation exists; only live provider, Production rollout, and locked-scope product expansion (Phase 1K wiring) remain deferred.

## Why not `FULLY_COMPLETED_CLOSED`

Runtime foundation is real (not docs-only). Classification stays structural because:

1. Live payment provider is not implemented (mock port only).  
2. Staging runtime flag defaults OFF; Production runtime not enabled.  
3. Phase 1K command/booking/tournament/UI product surface remains deferred.  
4. Phase 1H Staging cert is **READY WITH CONDITIONS** (permission-negative probe condition remains).

Elevating to FULLY on documentation alone would violate workstream rules; elevating despite remaining product/provider gates would over-claim module maturity.

## Canonical surfaces

| Dimension | Path / authority |
|-----------|------------------|
| Canonical source | `src/features/finance/` |
| Public facade | `src/features/finance/index.js` |
| Ownership | Operational fees / invoices / payments / receipts / refunds |
| Non-ownership | `billing`, `payments`, `subscription`, `finance-ledger` prototypes |
| Runtime | Opt-in composition; default disabled (`VITE_FINANCE_STAGING_RUNTIME_ENABLED`) |
| Persistence | Staging-applied SQL (`docs/supabase-finance-phase1f.sql`); 11 `finance_*` tables; Supabase adapter |
| Authorization | RLS + `finance.view` / `finance.edit` via `user_has_permission` |
| Platform Core | `platform/financePlatformAdapter.js` |
| Ports | Repo ports + `PaymentProviderPort` (mock only) |

## Merge / cert evidence

- Foundation PRs #180, #184, #185; platform #202  
- Staging cert: `docs/.../persistence/staging/PHASE_1H_STAGING_CERTIFICATION.md` (READY WITH CONDITIONS)

## Tests (targeted)

- `tests/finance-phase-1b-domain.test.js` … `tests/finance-phase-1l-remediation.test.js`
- `tests/finance-platform-adoption.test.js` (if present on disk; CI list includes 1b–1l)

## localStorage / mock

Canonical SoT is **not** localStorage. `finance-ledger` LS is legacy/prototype and not Finance foundation SoT. Provider is mock-only.

## Deferred gates

- `FINANCE_LIVE_PAYMENT_PROVIDER`
- `FINANCE_PRODUCTION_SQL_RUNTIME`
- `FINANCE_PHASE_1K_PRODUCT_SURFACE`
- `FINANCE_STAGING_PERMISSION_NEGATIVE_PROBE`

## Verdict

**Option A confirmed.** No active implementation gap requiring domain edits in this workstream.  
Do not classify as FULLY. Do not classify as ACTIVE_IMPLEMENTATION_GAP.
