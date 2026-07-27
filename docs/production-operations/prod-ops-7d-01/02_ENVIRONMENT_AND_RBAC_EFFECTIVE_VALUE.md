# PROD-OPS-7D-01 — Environment and RBAC Effective Value

**Boundary:** No Vercel env mutation. No secret/token/credential values printed.  
**Evidence:** `evidence/BUNDLE_RBAC_SCAN.json` (classification only).

## Production environment presence (non-secret)

| Check | Method | Result |
|-------|--------|--------|
| Vercel CLI `env ls` for Production | Attempted; project not linked in this worktree | **NOT_AVAILABLE** (CLI unlinked) |
| Full Production env inventory (names/presence) | Dashboard values historically unreadable to audit | **UNREADABLE** (preserve `RC-ENV-01`) |
| SPA publicly reachable | `https://pickvn.app` HTTP 200 | PASS |
| Current deploy bound to tip | Deploy `5626047618` SHA = `f52cfbf8…` = `origin/main` | PASS |

## `VITE_RBAC_ENABLED` effective classification

**Required classification (exactly one):**

```text
VERIFIED_ENABLED
```

### Why VERIFIED_ENABLED (without printing the value)

| Control | Evidence |
|---------|----------|
| Name present in Production SPA bundle | `viteRbacEnabledNamePresentInBundle=true` (hit count 5) |
| Diagnostic assignment pattern found in live bundle | `diagnosticAssignmentPatternFound=true` |
| Boolean classification from live bake-in | `viteRbacEnabledClassification=VERIFIED_ENABLED` |
| Value printed in evidence/docs | **false** / **NONE** |
| Bound to current Production deployment | Bundle served from `pickvn.app` on deploy tip `f52cfbf8…` |

### Source fallback (fail-closed)

| Control | Evidence | Result |
|---------|----------|--------|
| `src/auth/config.js` `isRbacEnabledFromEnv()` | When env empty → `import.meta.env.PROD === true` | Fail-closed / deny-by-default in Production builds |
| Unit RBAC suites | `tests/rbac.test.js` + `tests/rbac-v52.test.js` | Run in Phase I |

### Access posture (non-interactive)

| Check | Result |
|-------|--------|
| Unauthenticated public shells (`/`, `/clubs`, `/courts`, `/login`) | HTTP 200 (SPA) |
| Unauthorized Production credential login | **Not performed** (no Production users created) |
| Public RPC without session | Clubs/Courts anon RPC 200; fail-closed invalid sort/limit 400 |
| Interactive unauthorized protected-route probe with credentials | **NOT_EXERCISED** (boundary) |

## Residual env blind spots

| Item | Status |
|------|--------|
| Full redacted Production env name inventory | Still **UNREADABLE** without Owner-delivered inventory / linked CLI |
| Other `VITE_*` values | Not classified; not printed |
| Effective RBAC for this constrained web scope | **VERIFIED_ENABLED** (this workstream) |

## Marker

`PROD_OPS_7D_01_ENVIRONMENT_AND_RBAC_EFFECTIVE_VALUE_RECORDED`
