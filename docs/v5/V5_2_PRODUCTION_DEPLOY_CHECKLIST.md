# V5.2 — Production Deploy Checklist (Owner + Engineering)

**Ngày cập nhật:** 2026-07-07  
**Target version:** `5.2.0` — ✅ tagged  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Rollback deployment:** `dpl_Ey7v7gSCu21aqiGA7SR25AyppmZX` (trước deploy MLP `dpl_PKzeBkt7g1XyeK1cNU3b2Z6nA2MF`)

**Phạm vi:** Controlled Production pilot — **không** Commercial GA · **không** payment live

---

## A. Engineering — trước commit

| # | Việc | Tick | Ghi chú |
|---|------|------|---------|
| A1 | `npm test` PASS (gồm `rbac-v52.test.js`) | ✅ | 976/976 (2026-07-07) |
| A2 | `npm run build` PASS | ✅ | |
| A3 | Menu **Vui chơi mỗi ngày** dưới CLB & Huấn luyện | ✅ | `clubCoachingMenu.js` |
| A4 | Trang tạo giải bỏ nhãn V3.3 | ✅ | `TournamentHome.jsx` |
| A5 | RBAC V5.2 in-page nav đội trưởng | ✅ | `tournamentInPageNav.js` |
| A6 | SQL V5.2 sẵn sàng | ✅ | `PHASE_V52_PRODUCTION_RBAC_ROLES.sql` |

---

## B. Git — commit & tag

```bash
# 1. Stage (không commit .env / secret)
git add src/ tests/ package.json docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql docs/v5/V5_2_PRODUCTION_DEPLOY_CHECKLIST.md

# 2. Commit
git commit -m "$(cat <<'EOF'
feat(v5.2): daily play menu, RBAC roles, deploy prep

Add Vui chơi mỗi ngày under CLB menu, drop V3.3 tournament labels,
fix TEAM_CAPTAIN in-page nav, and ship V5.2 production SQL + deploy checklist.
EOF
)"

# 3. Bump version (package.json → 5.2.0) — cùng commit hoặc commit riêng
# 4. Tag
git tag -a v5.2.0 -m "Pickleball Scheduler Pro V5.2 — RBAC + menu"
```

| # | Việc | Tick |
|---|------|------|
| B1 | Commit trên branch `v5-platform-edition` | ✅ `338b383` · `1476ca7` (MLP team tournament) |
| B2 | `package.json` version `5.2.0` | ✅ |
| B3 | Tag `v5.2.0` | ✅ |
| B4 | Push branch + tag | ✅ |

---

## C. Supabase Production SQL (owner)

**File:** [`PHASE_V52_PRODUCTION_RBAC_ROLES.sql`](./PHASE_V52_PRODUCTION_RBAC_ROLES.sql)

| # | Bước | Tick | Ghi chú |
|---|------|------|---------|
| C1 | Backup/export `profiles` (khuyến nghị — Free plan không PITR) | ☐ | |
| C2 | Chạy toàn file SQL Editor | ✅ | Production có roles/team tables (MCP 2026-07-07) |
| C3 | V52-1 → V52-8 verification PASS | ✅ | `npm run verify:v52-production` + MCP roles/perms |
| C4 | Sửa `REPLACE_ME_TOURNAMENT_ID` / `REPLACE_ME_TEAM_EXTERNAL_ID` cho `doitruong@gmail.com` sau khi có giải đồng đội thật | ☐ | Profile vẫn REPLACE_ME |
| C5 | (Tuỳ chọn) Tạo auth `kythuat@gmail.com` + chạy `PHASE_V52_PRODUCTION_RBAC_SEED.sql` | ✅ | `kythuat` + `doitruong` auth OK |

---

## D. Vercel Production env (owner verify)

| Biến | Kỳ vọng | Tick | Ghi chú |
|------|---------|------|---------|
| `VITE_SUPABASE_URL` | `expuvcohlcjzvrrauvud` | ✅ | Bundle prod ref OK (2026-07-07) |
| `VITE_SUPABASE_ANON_KEY` | Production anon | ✅ | Có trên Vercel Production |
| `VITE_RBAC_ENABLED` | `true` | ✅ | Có trên Vercel — owner xác nhận giá trị |
| `VITE_SEED_DEMO` | `false` | ✅ | Có trên Vercel — owner xác nhận giá trị |
| `VITE_BILLING_SUPABASE` | `true` | ✅ | Có trên Vercel Production |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `true` | ✅ | Có trên Vercel Production |
| `VITE_PAYMENT_MODE` | `dev` | ✅ | Có trên Vercel Production |
| `VITE_API_ENABLED` | `false` / absent | ✅ | Không thấy trong `vercel env ls` |
| Không staging ref `qyewbxjsiiyufanzcjcq` | PASS | ✅ | Bundle scan — không có staging ref |

**Supabase Auth (P1):** Site URL + Redirect URLs → Production domain (sửa reset password localhost).

---

## E. Deploy

```bash
npm run build
npx vercel deploy --prod
# hoặc: git push → Vercel auto-deploy từ tag v5.2.0
```

| # | Việc | Tick | Ghi chú |
|---|------|------|---------|
| E1 | Ghi deployment ID **trước** deploy | ✅ `dpl_Ey7v7gSCu21aqiGA7SR25AyppmZX` |
| E2 | Deploy Production | ✅ `dpl_PKzeBkt7g1XyeK1cNU3b2Z6nA2MF` (commit `1476ca7`) |
| E3 | Ghi deployment ID **sau** deploy | ✅ |
| E4 | Bundle scan — không staging ref | ✅ | `expuvcohlcjzvrrauvud` có · staging không |
| E5 | `/login` HTTP 200 | ✅ |

---

## F. Smoke test T+0 (~30 phút)

| ID | Scenario | Tick | Ghi chú |
|----|----------|------|---------|
| F1 | Login COURT_OWNER — dashboard OK | ☐ | QA tay trên production |
| F2 | Menu CLB → **Vui chơi mỗi ngày** mở Daily Play | ☐ | |
| F3 | Giải đấu → Tạo giải — không còn tiêu đề V3.3 | ☐ | |
| F4 | RBAC retest 6 account (§16 `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`) | ☐ | |
| F5 | `doitruong@gmail.com` TEAM_CAPTAIN → team portal | ☐ | C4 REPLACE_ME chưa sửa |
| F6 | PROD-23E-1 → 5 team tournament | ☐ | |
| F7 | `verify:v52-production` + `verify:ai-v52-production-smoke` | ✅ | 10/10 AI smoke (2026-07-07) |
| F8 | Bundle MLP — `TeamTournamentSetup` + «AI ghép đội» / «Thêm mới» | ✅ | Chunk `BYTwhGN7` HTTP 200 |
| F9 | Supabase MCP — team tables + giải `mlp_4` | ✅ | 7 giải, 15 đội, 48 members |
| F10 | Giải MLP → AI ghép đội → Thêm VĐV → tạo lịch (UI) | ☐ | Owner ~5 phút trên browser |

**Fail P0 → rollback:** Vercel Promote deployment §E1

---

## G. Sign-off

| Role | GO V5.2 Production | Date |
|------|-------------------|------|
| Owner | ☐ | |
| Engineering | ✅ | 2026-07-07 — deploy `1476ca7`, smoke MCP/scripts/bundle |

**Không tick Commercial GA** — Gate 4/5 vẫn BLOCKED.

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` | Env baseline |
| `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md` | RBAC smoke §16 |
| `PHASE_23E_PRODUCTION_GO_REPORT.md` | Team tournament smoke |
| `PHASE_V52_PRODUCTION_RBAC_ROLES.sql` | SQL V5.2 roles |
