# PROD-OPS-7D-01 — Auth, RBAC, and Tenant Isolation

**Production accounts:** none created or altered.  
**Effective `VITE_RBAC_ENABLED`:** **VERIFIED_ENABLED** (see `02_ENVIRONMENT_AND_RBAC_EFFECTIVE_VALUE.md`; value not printed).

## Login / session / unauthorized posture

| Check | Evidence | Result |
|-------|----------|--------|
| Login route availability | `/login` HTTP 200 | PASS (shell) |
| Session persistence (interactive Production) | Credential login not performed | **NOT_EXERCISED** |
| Unauthorized route behavior (credentialed) | No Production test users | **NOT_EXERCISED** |
| Unauthenticated public catalog | Anon RPC Clubs/Courts 200 | PASS |
| Fail-closed invalid public inputs | Live 400 INVALID_SORT / INVALID_PAGINATION | PASS |

## RBAC contracts

| Item | Result |
|------|--------|
| Source fail-closed default when env unset in PROD | PASS (contract in `src/auth/config.js`) |
| Effective Production bake-in classification | **VERIFIED_ENABLED** |
| Unit suites `rbac` + `rbac-v52` | Run in Phase I |

## Tenant isolation

| Item | Result |
|------|--------|
| `tests/tenant-isolation-qa.test.js` | Run in Phase I |
| Public catalog privacy/tenant isolation unit tests | Included in Public Catalog focused set |
| Cross-tenant data exposure evidence in this window | **NONE observed** on public RPC privacy scan |

## Classification

```text
AUTH_ROUTE_AVAILABILITY=PASS_SHELL
EFFECTIVE_VITE_RBAC_ENABLED=VERIFIED_ENABLED
RBAC_SOURCE_FAIL_CLOSED=PASS
TENANT_ISOLATION_PUBLIC_SURFACE=PASS_OBSERVED
INTERACTIVE_PRODUCTION_AUTH=NOT_EXERCISED
```

## Marker

`PROD_OPS_7D_01_AUTH_RBAC_TENANT_ISOLATION_RECORDED`
