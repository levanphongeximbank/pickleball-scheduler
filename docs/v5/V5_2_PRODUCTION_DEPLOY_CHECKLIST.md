# V5.3 — Production Deploy Checklist (Owner + Engineering)

**Ngày cập nhật:** 2026-07-09  
**Target version:** `5.3.2` — ✅ tagged  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Rollback deployment:** `dpl_J2YxgPK4EBhE3oTnefXK5hfnF5mu` (V5.3.1 `0be1375`)

**Phạm vi:** Controlled Production pilot — **không** Commercial GA · **không** payment live

> Archive V5.2 deploy (2026-07-07): xem mục [Archive V5.2](#archive-v52-2026-07-07) cuối file.

---

## A. Engineering — trước commit

| # | Việc | Tick | Ghi chú |
|---|------|------|---------|
| A1 | `npm test` PASS (gồm pairing + rbac-v52) | ✅ | 1149/1149 (2026-07-09) |
| A2 | `npm run build` PASS | ✅ | |
| A3 | Pairing constraints + intervention (Super Admin) | ✅ | `pairing-constraints/`, `pairing-intervention/` |
| A4 | Platform athlete service + team group seed | ✅ | `platformAthleteService.js`, `teamGroupSeedEngine.js` |
| A5 | Club governance + My Club updates | ✅ | commits `ff8695b` → `0f38a09` |
| A6 | Effect prelude (tournament animation) | ✅ | `effectPreludeConfig.js` + tests |
| A7 | SQL Phase 22–35 đã có trên Production | ✅ | MCP verify 2026-07-09 |

---

## B. Git — commit & tag

| # | Việc | Tick | Ghi chú |
|---|------|------|---------|
| B1 | Commit trên branch `v5-platform-edition` | ✅ | `5e085c8` |
| B2 | `package.json` version `5.3.2` | ✅ | |
| B3 | Tag `v5.3.2` | ✅ | |
| B4 | Push branch + tag | ✅ | origin `v5-platform-edition` + `v5.3.2` |

---

## C. Supabase Production SQL (owner)

| # | Bước | Tick | Ghi chú |
|---|------|------|---------|
| C1 | Backup/export `profiles` (khuyến nghị — Free plan không PITR) | ☐ | Owner |
| C2 | `PHASE_V52_PRODUCTION_RBAC_ROLES.sql` | ✅ | Applied (2026-07-07) |
| C3 | V52-1 → V52-8 verification PASS | ✅ | MCP 2026-07-09: TECH 24 perms · CAPTAIN 17 perms |
| C4 | Sửa `REPLACE_ME_*` cho `doitruong@gmail.com` | ☐ | Profile vẫn REPLACE_ME |
| C5 | `kythuat@gmail.com` + `doitruong@gmail.com` auth/role | ✅ | SYSTEM_TECHNICIAN · TEAM_CAPTAIN |
| C6 | `PHASE_22_CLOUD_PERSISTENCE.sql` | ✅ | `court_engine_stores`, `club_data_v3.version` |
| C7 | `PHASE_33_TENANT_ROLE_CUSTOMIZE.sql` | ✅ | `tenant.role.customize` có trên Production |
| C8 | Phase 23/32/33 claim/34/35 SQL | ✅ | `court_clusters`, `court_claim_requests`, RPC `court_admin_assign_cluster_owner` |
| C11 | `PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql` | ✅ | RPC upsert/remove/delete owner + `court_admin_delete_cluster` (MCP 2026-07-09) |
| C12 | `PHASE_36_PRODUCTION_BACKFILL_NAM_LONG.sql` | ✅ | `venue-prod-main-main` backfill 2026-07-09 |
| C9 | Phase 30/31 VPR + club membership SQL | ✅ | `pick_vn_player_ratings`, `club_governance`, `club_membership_requests` |
| C10 | `npm run verify:phase33-tenant-owner-rbac-production` | ☐ | Cần `SUPABASE_SERVICE_ROLE_KEY` local — MCP đã spot-check |

**Pairing constraints/intervention:** không cần SQL — client-only.

---

## D. Vercel Production env (owner verify)

| Biến | Kỳ vọng | Tick | Ghi chú |
|------|---------|------|---------|
| `VITE_SUPABASE_URL` | `expuvcohlcjzvrrauvud` | ✅ | |
| `VITE_SUPABASE_ANON_KEY` | Production anon | ✅ | |
| `VITE_RBAC_ENABLED` | `true` | ✅ | |
| `VITE_SEED_DEMO` | `false` | ✅ | |
| `VITE_BILLING_SUPABASE` | `true` | ✅ | |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `true` | ✅ | |
| `VITE_COURT_ENGINE_STORE` | `supabase` | ☐ | SQL C6 ✅ — owner bật env + redeploy |
| `VITE_CLUB_CLOUD_SYNC` | `true` | ☐ | SQL C6 ✅ — owner bật env + redeploy |
| `VITE_COURT_CLUSTERS_ENABLED` | `true` | ☐ | SQL C8 ✅ — owner bật env + redeploy |
| `VITE_VPR_RANKING_ENABLED` | `true` | ☐ | SQL C9 ✅ — tuỳ chọn |
| `VITE_VPR_CLOUD_SYNC` | `true` | ☐ | SQL C9 ✅ — tuỳ chọn |
| `VITE_PAYMENT_MODE` | `dev` | ✅ | |
| `VITE_API_ENABLED` | `false` / absent | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role | ☐ | **Server only** — bắt buộc cho `/api/identity/create-user` (Super Admin tạo user) |
| `SUPABASE_URL` | Mirror `VITE_SUPABASE_URL` | ☐ | Khuyến nghị — serverless đọc trước `VITE_*` |
| `SUPABASE_ANON_KEY` | Mirror `VITE_SUPABASE_ANON_KEY` | ☐ | Khuyến nghị — JWT check trên API create-user |
| Không staging ref `qyewbxjsiiyufanzcjcq` | PASS | ✅ | Bundle deploy `0121740` |

**Supabase Auth (P1):** Site URL + Redirect URLs → Production domain (`/login`, `/reset-password`).

**Super Admin tạo user:** `npm run verify:identity-admin-create-production` (local cần `SUPABASE_SERVICE_ROLE_KEY`). Self-signup có thể bật xác nhận email; admin tạo user qua `/users` dùng `email_confirm=true` — đăng nhập ngay, không cần bấm link.

---

## E. Deploy

| # | Việc | Tick | Ghi chú |
|---|------|------|---------|
| E1 | Ghi deployment ID **trước** deploy | ✅ | `dpl_J2YxgPK4EBhE3oTnefXK5hfnF5mu` (V5.3.1) |
| E2 | Deploy Production | ✅ | `dpl_9tBeCfGQ6wgbLC5KphC8QGWCRC7c` (commit `5e085c8`) |
| E3 | Alias production domain | ✅ | `pickleball-scheduler-eight.vercel.app` |
| E4 | Bundle scan — không staging ref | ✅ | |
| E5 | `/login` HTTP 200 | ✅ | 2026-07-09 |

**Fail P0 → rollback:** Vercel Promote `dpl_J2YxgPK4EBhE3oTnefXK5hfnF5mu`

---

## F. Smoke test T+0 (~30 phút)

| ID | Scenario | Tick | Ghi chú |
|----|----------|------|---------|
| F1 | Login COURT_OWNER — dashboard OK | ☐ | QA tay |
| F2 | Menu CLB → **Vui chơi mỗi ngày** | ☐ | |
| F3 | **My Club** — governance / join panel | ☐ | V5.3 mới |
| F4 | Super Admin — pairing intervention (tournament setup) | ☐ | Draft/ready only |
| F5 | Team tournament — AI ghép đội + group seed | ☐ | `teamGroupSeedEngine` |
| F6 | RBAC retest 6 account (§16 `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`) | ☐ | |
| F7 | `doitruong@gmail.com` TEAM_CAPTAIN → team portal | ☐ | C4 REPLACE_ME chưa sửa |
| F8 | Admin → Cụm sân (sau bật `VITE_COURT_CLUSTERS_ENABLED`) | ☐ | |
| F9 | MCP RBAC + team tables | ✅ | 7 giải, 15 đội, 48 members |
| F10 | `verify:v52-production` script local | ☐ | Cần service role key |
| F11 | Super Admin → `/users` → Tạo user + mật khẩu → login ngay | ☐ | `verify:identity-admin-create-production` |

---

## G. Sign-off

| Role | GO V5.3 Production | Date |
|------|-------------------|------|
| Owner | ☐ | |
| Engineering | ✅ | 2026-07-09 — deploy `5e085c8` / `dpl_9tBeCfGQ6wgbLC5KphC8QGWCRC7c` |

**Không tick Commercial GA** — Gate 4/5 vẫn BLOCKED.

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` | Env baseline |
| `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md` | RBAC smoke §16 |
| `PHASE_23E_PRODUCTION_GO_REPORT.md` | Team tournament smoke |
| `PHASE_33_QA_CHECKLIST.md` | Chủ sân RBAC QA |
| `PHASE_V52_PRODUCTION_RBAC_ROLES.sql` | SQL V5.2 roles |

---

## Archive V5.2 (2026-07-07)

| Hạng mục | Giá trị |
|----------|---------|
| Version | `5.2.0` — tag `v5.2.0` |
| Commit | `1476ca7` (MLP team tournament) |
| Deploy | `dpl_PKzeBkt7g1XyeK1cNU3b2Z6nA2MF` |
| Rollback trước đó | `dpl_Ey7v7gSCu21aqiGA7SR25AyppmZX` |
| Tests lúc đó | 976/976 |
