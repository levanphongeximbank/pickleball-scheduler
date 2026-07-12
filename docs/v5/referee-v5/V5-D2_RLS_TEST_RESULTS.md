# V5-D.2 — RLS Test Results

**Method:** Real JWT sessions via `signInStagingUser` + Supabase client RPC/table access  
**Script:** `node scripts/verify-phase-v5d2-staging.mjs`  
**Evidence:** `docs/v5/qa-evidence/phase-v5d2/VERIFY_REPORT.json`

---

## 9.1 Assigned referee

| Test | Expected | Actual | PASS |
|------|----------|--------|------|
| Read assigned match via `referee_v5_get_match_state` | `ok: true` | `ok: true` | ✅ |
| Direct insert `match_events` | Denied | RLS blocked (0 rows) | ✅ |
| Internal commit RPC from browser | Denied | Permission error | ✅ |

---

## 9.2 Unassigned referee (`player@staging.local`)

| Test | Expected | Actual | PASS |
|------|----------|--------|------|
| Read match without assignment | `REFEREE_NOT_ASSIGNED` | `REFEREE_NOT_ASSIGNED` | ✅ |

---

## 9.3 Player

| Test | Expected | Actual | PASS |
|------|----------|--------|------|
| Insert match event | Denied | RLS blocked | ✅ |
| Internal RPC | Denied | Permission error | ✅ |

---

## 9.4 Tenant isolation

| Test | Expected | Actual | PASS |
|------|----------|--------|------|
| Tenant A referee reads Tenant B match | Denied | Not assigned / denied | ✅ |
| Outbox read from browser | Denied | 0 rows / error | ✅ |

---

## 9.5 Revoked / expired assignment

| Scenario | Method | Status |
|----------|--------|--------|
| Revoked assignment row seeded | `SEED_SQL.sql` | Data ready |
| Expired assignment row seeded | `SEED_SQL.sql` | Data ready |
| Runtime `ASSIGNMENT_REVOKED` / `ASSIGNMENT_EXPIRED` via Edge | Pending Edge deploy | **P1** |

Helper `referee_v5_current_user_has_assignment` checks `expires_at` and `revoked_at` — covered at SQL layer.

---

## Summary

**RLS runtime (JWT): 6/6 PASS** on executed checks  
**Edge command path:** pending Edge Function deploy

---

## Verdict

**RLS: PASS** (browser direct write blocked; tenant isolation confirmed)
