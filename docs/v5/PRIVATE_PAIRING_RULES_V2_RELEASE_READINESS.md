# Private Pairing Rules V2 — Release Readiness

| Field | Value |
|-------|-------|
| Date | 2026-07-14 |
| Branch | `feature/private-pairing-rules-v2` |
| Baseline PR-5 tip | `43b43c7` (UI) + later finalize commits |
| Staging complete HEAD | `59b3069a802ac632cd75f663dfac21de31a48429` |
| Staging project | `qyewbxjsiiyufanzcjcq` |
| Merge | **NOT READY until owner browser SA matrix signed** |
| Production | **NOT READY** |
| Preview deployment | https://pickleball-scheduler-c9g7jkawk-pickleball-scheduler.vercel.app |
| Preview alias | https://pickleball-scheduler-levanphongeximbank-pickleball-scheduler.vercel.app |

---

## 1. Staging gates

| Gate | Status |
|------|--------|
| PR-4 SQL on Staging | PASS |
| Raise patch (AUDIT_APPEND_ONLY P0001) | PASS |
| Preview flags ON | PASS (Preview only) |
| Preview redeploy includes route | PASS |
| Unit PR-2…PR-5 | PASS 48/48 |
| Pairing regression | PASS |
| Targeted lint (pairing) | PASS 0/0 |
| Full lint new errors | PASS (99 ≤ baseline 125) |
| Build | PASS |
| Live SUPER_ADMIN menu/RPC browser matrix | **PENDING OWNER** |
| Mobile Safari/Chrome browser | **PENDING OWNER** |

---

## 2. Preview

| Item | Value |
|------|-------|
| Alias (stable) | https://pickleball-scheduler-levanphongeximbank-pickleball-scheduler.vercel.app |
| Route | `/admin/ai-pairing/private-rules` |
| Menu | Quản trị → Quy tắc ghép cặp riêng |

---

## 3. Evidence paths

- `docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_SECURITY_VERIFY.json`
- `docs/v5/qa-evidence/phase-private-pairing-staging/STAGING_RAISE_PATCH_APPLY.json`
- `docs/v5/qa-evidence/phase-private-pairing-staging/UNIT_PR2_PR5.txt`
- `docs/v5/qa-evidence/phase-private-pairing-staging/TARGETED_LINT.txt`
- `docs/v5/qa-evidence/phase-private-pairing-staging/FULL_LINT.json`
- `docs/v5/PRIVATE_PAIRING_RULES_V2_STAGING_QA.md`
- `docs/v5/PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md`

---

## 4. Known limitations

1. Owner must complete live SA / non-SA / mobile checklist on Preview after login.
2. Branch contains unrelated Individual Tournament S1 history from prior GO; do not expand that scope when merging pairing.
3. Production migration and Production env flags remain **off / not applied**.

---

## 5. Merge readiness

| Question | Answer |
|----------|--------|
| OK to merge to main now? | **NO** — wait for owner browser SA matrix PASS + explicit merge GO |
| Staging feature complete (engineering)? | **YES with OWNER_MANUAL caveats** |
| Production ready? | **NO** |

---

## 6. Mobile / desktop owner checklist (copy into evidence)

- [ ] iPhone Safari: menu, page, forms, tables, dialogs, audit tab, no horizontal overflow
- [ ] Desktop Chrome: same
- [ ] SUPER_ADMIN create/activate/rollback/audit flows
- [ ] Non-admin 403 on direct route
