# Tournament Rollback Plan

**Status:** IMPLEMENTATION-READY  
**Audit date:** 2026-08-05  
**Commit-gate correction:** 2026-08-05 — aligned to WP1–WP8  
**Production GO:** NO  
**Production mutations (audit):** 0  

**Live note:** Owner defect tournaments are not in Production `club_data_v3`; app-code rollback does not require cloud tournament row restore for those three IDs until WP3 migration has occurred under a separate Owner GO.

## Sequencing rules (same as remediation plan)

- HIDING_THE_MISSING_TENANT_BANNER_IS_NOT_A_VALID_FIRST_REMEDIATION
- LOCAL_BROWSER_TOURNAMENT_PRESERVATION_PRECEDES_RUNTIME_CHANGES
- PRODUCTION_DATA_MIGRATION_REQUIRES_SEPARATE_OWNER_GO

## Rollback by work package (WP1 → WP8)

### WP1 — Preserve / export

| Item | Action |
|------|--------|
| Trigger | Export incomplete or checksum mismatch |
| Rollback | Do **not** clear browser storage; retain local payload + checksum copies; halt all later WPs |
| Tests | Re-run export completeness and SHA verification |
| Owner GO | None (local only) |

### WP2 — Cloud durable authority

| Item | Action |
|------|--------|
| Trigger | Dual SSOT, wrong ownership, persistence failure |
| Rollback | Disable cloud-as-SSOT feature flags; continue reading WP1 local exports; no Production Owner-ID writes |
| Tests | Confirm local export still authoritative for Owner IDs |
| Owner GO | Staging revert; Production schema revert only if applied under prior GO |

### WP3 — Local-to-cloud migrate / reconcile

| Item | Action |
|------|--------|
| Trigger | Dry-run failure, duplicates, relationship loss, unauthorized Production write |
| Rollback | Use reconciliation evidence + WP1 export to reverse or quarantine cloud rows; **stop** Production mutation |
| Tests | ID map integrity; duplicate scan; relationship checks |
| Owner GO | Any Production reverse-write requires separate Owner mutation GO |

### WP4 — Tenant / club / venue scope

| Item | Action |
|------|--------|
| Trigger | Cross-tenant exposure; pairing under wrong scope; banner-only “fix” |
| Rollback | Revert app deploy to prior SHA; restore prior resolvers |
| Tests | Scope unit/integration; ACCC `venue-prod-main` path |
| Owner GO | Production deploy revert is Owner-controlled |

### WP5 — Dual writers / dual readers

| Item | Action |
|------|--------|
| Trigger | Data divergence between writers/readers |
| Rollback | Re-enable explicit compatibility adapters behind flags; restore single-path flags |
| Tests | Dual-writer/reader conflict matrix |
| Owner GO | Staging + Production app revert as needed |

### WP6 — Legacy route migration

| Item | Action |
|------|--------|
| Trigger | Broken deep links; dual menus; lost query params |
| Rollback | Disable redirect shim; serve legacy `/tournament/*` temporarily |
| Tests | Deep-link and public-link preservation |
| Owner GO | Production deploy revert |

### WP7 — RBAC / tenant isolation

| Item | Action |
|------|--------|
| Trigger | Unauthorized access or over-lock of legitimate roles |
| Rollback | Revert RLS/RPC policy migration; restore prior policies |
| Tests | Role matrix + cross-tenant denial |
| Owner GO | Production SQL/policy revert requires Owner GO |

### WP8 — Production-safe rollout

| Item | Action |
|------|--------|
| Trigger | Post-deploy persistence failure; cross-browser failure; incomplete WP1–WP7 gates |
| Rollback | Constrained rollback to last known-good deploy; re-verify WP1 exports still intact; forward-fix only after gates pass |
| Tests | Post-deploy persistence; cross-browser; mutation ledger = expected only |
| Owner GO | Explicit Production rollback / forward-fix GO |

## Global rollback triggers

- Staging certification failure after remediation deploy
- New tenant mis-scoping or cross-tenant data exposure
- Pairing mutations creating orphaned records under wrong scope
- Engine 4.0 redirect causing broken deep links for active Production tournaments
- Any attempt to proceed past WP1 without verified export

## Application (Vercel)

1. Revert to prior Production deployment SHA (Owner-controlled — not agent merge)
2. Verify legacy `/tournament/*` behavior if WP6 redirect is rolled back
3. Confirm zero unexpected delta in durable tournament writes post-rollback window

## Data rollback notes

- **Pre-WP3:** No cloud tournament rows for Owner IDs — prioritize browser-local preservation (WP1)
- **Post-WP3:** Use reconciliation evidence + WP1 export; Team path may use `team_tournament_restore_setup_snapshot` if cloud mutations occurred
- **Audit phase:** No Production mutations performed — no data rollback required for audit

## Communication

- Owner notification before any Production deploy, mutation, or rollback
- Defect log updated with rollback event and SHA
