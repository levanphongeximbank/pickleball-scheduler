# PROD-OPS-30D-01 — Auth, RBAC, and Tenant Isolation

**Production users:** none created or modified.  
**Effective `VITE_RBAC_ENABLED`:** **VERIFIED_ENABLED** (value not printed; `evidence/BUNDLE_RBAC_SCAN.json`).

## Checks

| Check | Evidence | Result |
|-------|----------|--------|
| Login route availability | `/login` HTTP 200 | PASS (shell) |
| Session persistence | Owner safe account not provided | **NOT_EXERCISED** |
| Unauthorized route behavior (credentialed) | No Production test users | **NOT_EXERCISED** |
| Unauthenticated public catalog | Anon RPC 200 | PASS |
| Fail-closed invalid public inputs | Live 400 INVALID_SORT / INVALID_PAGINATION | PASS |
| Source fail-closed when env unset in PROD | `src/auth/config.js` | PASS (contract) |
| RBAC unit suites | Phase J | PASS expected |
| Tenant isolation unit suite | Phase J | PASS expected |
| Cross-tenant exposure on public RPC | Privacy field scan ABSENT | NONE observed |

## Classification

```text
AUTH_ROUTE_AVAILABILITY=PASS_SHELL
EFFECTIVE_VITE_RBAC_ENABLED=VERIFIED_ENABLED
INTERACTIVE_PRODUCTION_AUTH=NOT_EXERCISED
TENANT_ISOLATION_PUBLIC_SURFACE=PASS_OBSERVED
```

## Marker

`PROD_OPS_30D_01_AUTH_RBAC_TENANT_ISOLATION_RECORDED`
