# PROD-OPS-24H-01 — Auth, RBAC, and Tenant Isolation

**Production users:** none created or altered.  
**Effective `VITE_RBAC_ENABLED`:** **NOT_VERIFIED** (preserve `RC-RBAC-01`).

## Unauthenticated / auth route availability

| Check | Evidence | Result |
|-------|----------|--------|
| Public routes without login | `/`, `/clubs`, `/courts` HTTP 200 | PASS |
| Auth route shell | `/login` HTTP 200 (SPA) | PASS |
| Public catalog RPC without user session | anon RPC clubs/courts 200 | PASS |
| Direct private table access | Prior `PORTAL_SMOKE` fail-closed 401 on direct table | Carry-forward PASS (not re-run as table probe) |

Interactive Production login/session restore: **not exercised** with credentials (boundary — no Production test accounts created). Availability of login route shell confirmed only.

## RBAC contract tests

| Suite | Result |
|-------|--------|
| `tests/rbac.test.js` + `tests/rbac-v52.test.js` | **PASS** 96/96 |

Code reference (default when env unset in production build):

- `src/auth/config.js` — `isRbacEnabledFromEnv()` returns `import.meta.env.PROD === true` when `VITE_RBAC_ENABLED` empty.
- This is **code-default evidence only**. Live Vercel value remains **NOT_VERIFIED**.

## Tenant isolation tests

| Suite | Result |
|-------|--------|
| `tests/tenant-isolation-qa.test.js` | **PASS** 9/9 |

Public catalog privacy / tenant isolation unit tests included in catalog suite (see `06_*`).

## Fail-closed behavior (evidence exists)

| Control | Evidence | Status |
|---------|----------|--------|
| Invalid public sort | Live RPC 400 `INVALID_SORT` | PASS |
| Over-limit pagination | Live RPC 400 `INVALID_PAGINATION` | PASS |
| RBAC off → permissive (unit) | `rbac.test.js` | PASS (unit) |
| Cross-tenant club guards (unit) | `tenant-isolation-qa.test.js` | PASS |

## Classification

```text
AUTH_ROUTE_AVAILABILITY=PASS_SHELL
RBAC_CONTRACT_TESTS=PASS
TENANT_ISOLATION_TESTS=PASS
EFFECTIVE_VITE_RBAC_ENABLED=NOT_VERIFIED
```

## Marker

`PROD_OPS_24H_01_AUTH_RBAC_TENANT_ISOLATION_RECORDED`
