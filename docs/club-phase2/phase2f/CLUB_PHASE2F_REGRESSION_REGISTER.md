# Club Phase 2F — Regression Register

| ID | Severity | Area | Reproduction | Expected | Actual | Roles | Env | Root cause | Fix in 2F? |
|----|----------|------|--------------|----------|--------|-------|-----|------------|------------|
| REG-2F-1 | MEDIUM | Manage Members | Open manage members under V2 | VN role labels | Raw `governanceRoles` codes | Managers | Prod UI | Fallback `.join` | **Yes** — chips + resolver |
| REG-2F-2 | MEDIUM | Manage Members | Missing displayName | Neutral name | Could show `playerId` UUID | Managers | Prod UI | Unsafe fallback | **Yes** — `Chưa có thông tin` |
| REG-2F-3 | MEDIUM | Org Chart / My Club Gov | Open panels | Canonical hook + loading/error | `fetchGovernanceNameHints` only | Officers | Prod UI | Pre-2E residual | **Yes** — `useGovernanceReadModel` |
| REG-2F-4 | LOW | Org Chart empty labels | Unassigned officers | `Chưa gán` / `—` | `(trống)` | All | Prod UI | Hardcoded | **Yes** — canonical constants |

## Severity breakdown

| Severity | Found | Fixed | Open |
|----------|-------|--------|------|
| CRITICAL | 0 | 0 | 0 |
| HIGH | 0 | 0 | 0 |
| MEDIUM | 3 | 3 | 0 |
| LOW | 1 | 1 | 0 |
| INFORMATIONAL | 2 | 0 | 2 (Discover OFF hints; list RPC parallel) |

## Adjacent regression checks (no defects)

Club Home hook, member list My Club, membership actions, route guards, V2 flag, Manage Overview — **PASS** (prior suites green).
