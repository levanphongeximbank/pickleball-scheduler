# V5-A.3 — JWT RLS Runtime Results

**Generated:** 2026-07-12  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Verdict:** **14/14 PASS**

Evidence JSON: [`qa-evidence/v5-a3-jwt-rls/JWT_RLS_REPORT.json`](./qa-evidence/v5-a3-jwt-rls/JWT_RLS_REPORT.json)

---

## Staging test fixtures

| Actor | Email | Role | Tenant |
|-------|-------|------|--------|
| User A | `player@staging.local` | PLAYER | `venue-staging-a` |
| User B | `owner-b@staging.local` | VENUE_OWNER | `venue-staging-b` |
| Manager A | `manager@staging.local` | VENUE_MANAGER | `venue-staging-a` |
| Coach A (proxy) | `club@staging.local` | PLAYER | `venue-staging-a` |

User B assessment seeded via `service_role` (no PLAYER on tenant B; owner lacks `assess_self`).

---

## Cross-tenant (1–5)

| # | Test | Result |
|---|------|--------|
| 1 | User A cannot read User B private assessment | **PASS** |
| 2 | User A cannot update User B profile | **PASS** |
| 3 | User A cannot create assessment for Tenant B | **PASS** |
| 4 | Manager A cannot update Tenant B assessment | **PASS** |
| 5 | Manager A cannot read Tenant B review cases | **PASS** |

## Canonical protection (6–10)

| # | Test | Result |
|---|------|--------|
| 6 | PLAYER cannot insert canonical profile | **PASS** |
| 7 | PLAYER cannot set verified rating | **PASS** |
| 8 | PLAYER cannot set reliability | **PASS** |
| 9 | PLAYER cannot set evidence level > 3 | **PASS** |
| 10 | Manager cannot override canonical profile | **PASS** |

## Append-only (11–13)

| # | Test | Result |
|---|------|--------|
| 11 | PLAYER cannot insert rating event | **PASS** |
| 12 | PLAYER cannot update rating event | **PASS** |
| 13 | PLAYER cannot delete rating event | **PASS** |

## Shadow isolation (14)

| # | Test | Result |
|---|------|--------|
| 14 | V5 start_assessment does not change V2 rows | **PASS** |

---

## Command

```bash
node scripts/verify-v5a3-jwt-rls-staging.mjs
```

**JWT RLS TESTS = 14/14 PASS** → Server scoring phase authorized to proceed.
