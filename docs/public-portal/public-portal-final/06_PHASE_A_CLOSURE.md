# PUBLIC-PORTAL-FINAL — Phase A Closure (NO-GO Certification)

**Verdict:** `PUBLIC_PORTAL_FINAL_PRODUCTION_NO_GO_EMPTY_CATALOG`  
**Certification status:** `PUBLIC_PORTAL_FINAL_NO_GO_READY_FOR_OWNER_MERGE` (after gates + PR CI green)

Phase A audit package: `docs/public-portal/public-portal-final/`.

## Production mutation check (final)

| Action | Status |
|--------|--------|
| Apply SQL / RLS | **NOT performed** |
| Change `VITE_PUBLIC_CLUBS_COURTS_SOURCE` | **NOT performed** (still unset → code default `local`) |
| Deploy / Redeploy Production | **NOT performed** |
| Mutate Production business / publication data | **NOT performed** |
| Staging mutation | **NOT performed** (Staging read only for catalog-RPC presence contrast) |

Production remains untouched for this workstream.

## Root cause (fail-closed required)

1. **Production public Clubs count does not meet gate** — eligible public Clubs = **0** (publication columns `is_publicly_listed` / `public_slug` absent; deny-by-default after SQL-only apply would still be 0).
2. **Production public Courts count does not meet gate** — eligible public Courts = **0** (`public_catalog_courts` absent; projection empty after SQL-only apply).
3. **Cutover now would empty Production Portal** — switching `VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote` would replace current local MIXED Clubs/Courts with a LIVE empty catalog.
4. **Fail-closed is mandatory** — this workstream must not invent synthetic publication seed or mutate Production data to force a GO.

## Conditions to reopen rollout

All must be true before any `GO PRODUCTION`:

1. ≥1 Production Club is canonical opt-in public (`is_publicly_listed=true`, active, not deleted, privacy-safe).
2. ≥1 Production Court is canonical opt-in public (published + active projection row bound to a public Club).
3. Privacy / DTO allowlist verified on live Production RPCs (no private/PII/pricing/staff leakage).
4. Publication data is real Production data — **not** leftover synthetic staging seed.
5. Production portal rollback (`03_PORTAL_ROLLBACK.md`) and DB rollback (`04_DB_ROLLBACK.md` / `sql/90_…`) remain valid; canonical Vercel target still `https://pickleball-scheduler-eight.vercel.app`.

## Owner action

1. Merge this NO-GO certification PR (docs/tests only).  
2. Run a **separate publication workstream** to create real public Club + Court on Production.  
3. Resume Phase A re-audit (or new Agent chat) and only then send exact `GO PRODUCTION` if hard gates PASS.

Do **not** run Phase B / GO PRODUCTION from this package while empty-catalog gate FAILs.
