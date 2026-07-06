# V5.2 — Production GO Report

**Ngày:** 2026-07-05  
**Version:** `5.2.0` / tag `v5.2.0`  
**Commit:** `03ff308`  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Phạm vi:** Controlled Production Pilot — **không** Commercial GA

---

## 1. Verdict

| Hạng mục | Verdict |
|----------|---------|
| Engineering gates (test/build) | ✅ **PASS** |
| Git tag `v5.2.0` | ✅ **READY** (local tag `03ff308`) |
| Vercel Production deploy | ✅ **DONE** — `dpl_Ey7v7gSCu21aqiGA7SR25AyppmZX` |
| `/login` HTTP 200 | ✅ **PASS** |
| SQL V5.2 RBAC (`PHASE_V52_PRODUCTION_RBAC_ROLES.sql`) | ✅ **PASS** — MCP `v52_production_rbac_roles` 2026-07-05 |
| Manual smoke T+0 / T+24h | ⏳ **Owner** |
| Commercial GA | ⛔ **NO-GO** |

---

## 2. Prerequisites (đã đạt từ Gate 1–3 + 19B)

| Gate | Verdict |
|------|---------|
| Gate 1 Staging Pilot | ✅ PASS |
| Gate 2 Production SQL 22/22 | ✅ PASS |
| Gate 3 Runtime Preflight | ✅ PASS |
| Phase 19B RBAC patch deployed | ✅ `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| Phase 23E team tournament cloud | ✅ PASS |

**Rollback trước V5.2 deploy:** `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`

---

## 3. Engineering evidence (2026-07-05)

| Gate | Kết quả |
|------|---------|
| `npm test` | ✅ **902/902 PASS** |
| `npm run build` | ✅ PASS |
| Menu audit | ✅ 77 LIVE, 0 planned, 100% |
| `rbac-v52.test.js` | ✅ 16/16 PASS |
| Version `package.json` | ✅ `5.2.0` |
| UI label | ✅ `V5.2 Production Pilot` |

---

## 4. V5.2 deploy delta (so với RC1)

- RBAC SYSTEM_TECHNICIAN + TEAM_CAPTAIN
- Sidebar accordion + menu RBAC in-page
- Daily Play menu under CLB & Huấn luyện
- Phases 24–29 modules (dashboard, tournament, finance, CRM, coaching)
- Tournament flow orchestrator polish
- Production SQL pack V5.2 roles

---

## 5. Vercel deploy record

| Field | Value |
|-------|-------|
| Rollback deployment ID | `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| V5.2 deployment ID | **`dpl_Ey7v7gSCu21aqiGA7SR25AyppmZX`** |
| Deploy URL | https://pickleball-scheduler-go6gp8qlc-pickleball-scheduler.vercel.app |
| Alias | https://pickleball-scheduler-eight.vercel.app |
| Deploy time | 2026-07-05 |
| Branch | `v5-platform-edition` |
| Tag | `v5.2.0` |
| Payment live | ⛔ OFF |
| API/Marketplace/AI | ⛔ OFF |

---

## 6. Owner SQL (bắt buộc sau deploy app)

**File:** [`PHASE_V52_PRODUCTION_RBAC_ROLES.sql`](./PHASE_V52_PRODUCTION_RBAC_ROLES.sql)

| # | Bước | Tick |
|---|------|------|
| 1 | SQL Editor Production — chạy file | ✅ MCP migration |
| 2 | V52-1 → V52-8 verification PASS | ✅ |
| 3 | Sửa `REPLACE_ME_*` cho TEAM_CAPTAIN test | ⏳ Sau giải đồng đội thật |

---

## 7. Smoke T+0

| ID | Scenario | Tick |
|----|----------|------|
| S1 | `/login` — label **V5.2 Production Pilot** | ☐ |
| S2 | CLB → **Vui chơi mỗi ngày** | ☐ |
| S3 | Giải đấu → Tạo giải — không V3.3 | ☐ |
| S4 | RBAC retest 6 account §16 Phase 19B | ☐ |
| S5 | TEAM_CAPTAIN portal | ☐ |

**Fail P0 → rollback:** Promote `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`

---

## 8. Sign-off

| Role | V5.2 Production Pilot GO | Date |
|------|--------------------------|------|
| Engineering | ☑ deploy + gates | 2026-07-05 |
| Owner SQL + smoke | ☐ | |

---

## Tham chiếu

- `V5_2_PRODUCTION_DEPLOY_CHECKLIST.md`
- `RELEASE_NOTES_v5.2.md`
- `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`
