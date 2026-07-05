# V5.2 — Production Deploy Checklist (Owner + Engineering)

**Ngày cập nhật:** 2026-07-05  
**Target version:** `5.2.0` — ✅ tagged  
**Production URL:** https://pickleball-scheduler-eight.vercel.app  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Rollback deployment:** `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`

**Phạm vi:** Controlled Production pilot — **không** Commercial GA · **không** payment live

---

## A. Engineering — trước commit

| # | Việc | Tick | Ghi chú |
|---|------|------|---------|
| A1 | `npm test` PASS (gồm `rbac-v52.test.js`) | ✅ | 902/902 |
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
| B1 | Commit trên branch `v5-platform-edition` | ✅ `338b383` |
| B2 | `package.json` version `5.2.0` | ✅ |
| B3 | Tag `v5.2.0` | ✅ |
| B4 | Push branch + tag | ✅ branch · ⏳ `git push origin v5.2.0` |

---

## C. Supabase Production SQL (owner)

**File:** [`PHASE_V52_PRODUCTION_RBAC_ROLES.sql`](./PHASE_V52_PRODUCTION_RBAC_ROLES.sql)

| # | Bước | Tick |
|---|------|------|
| C1 | Backup/export `profiles` (khuyến nghị — Free plan không PITR) | ☐ |
| C2 | Chạy toàn file SQL Editor | ☐ |
| C3 | V52-1 → V52-8 verification PASS | ☐ |
| C4 | Sửa `REPLACE_ME_TOURNAMENT_ID` / `REPLACE_ME_TEAM_EXTERNAL_ID` cho `doitruong@gmail.com` sau khi có giải đồng đội thật | ☐ |
| C5 | (Tuỳ chọn) Tạo auth user + profile `SYSTEM_TECHNICIAN` test | ☐ |

---

## D. Vercel Production env (owner verify)

| Biến | Kỳ vọng | Tick |
|------|---------|------|
| `VITE_SUPABASE_URL` | `expuvcohlcjzvrrauvud` | ☐ |
| `VITE_SUPABASE_ANON_KEY` | Production anon | ☐ |
| `VITE_RBAC_ENABLED` | `true` | ☐ |
| `VITE_SEED_DEMO` | `false` | ☐ |
| `VITE_BILLING_SUPABASE` | `true` | ☐ |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | `true` | ☐ |
| `VITE_PAYMENT_MODE` | `dev` | ☐ |
| `VITE_API_ENABLED` | `false` / absent | ☐ |
| Không staging ref `qyewbxjsiiyufanzcjcq` | PASS | ☐ |

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
| E1 | Ghi deployment ID **trước** deploy | ✅ `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| E2 | Deploy Production | ✅ `dpl_Ey7v7gSCu21aqiGA7SR25AyppmZX` |
| E3 | Ghi deployment ID **sau** deploy | ✅ |
| E4 | Bundle scan — không staging ref | ☐ owner |
| E5 | `/login` HTTP 200 | ✅ |

---

## F. Smoke test T+0 (~30 phút)

| ID | Scenario | Tick |
|----|----------|------|
| F1 | Login COURT_OWNER — dashboard OK | ☐ |
| F2 | Menu CLB → **Vui chơi mỗi ngày** mở Daily Play | ☐ |
| F3 | Giải đấu → Tạo giải — không còn tiêu đề V3.3 | ☐ |
| F4 | RBAC retest 6 account (§16 `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`) | ☐ |
| F5 | `doitruong@gmail.com` TEAM_CAPTAIN → team portal | ☐ |
| F6 | PROD-23E-1 → 5 team tournament | ☐ |

**Fail P0 → rollback:** Vercel Promote deployment §E1

---

## G. Sign-off

| Role | GO V5.2 Production | Date |
|------|-------------------|------|
| Owner | ☐ | |
| Engineering | ☐ | |

**Không tick Commercial GA** — Gate 4/5 vẫn BLOCKED.

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` | Env baseline |
| `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md` | RBAC smoke §16 |
| `PHASE_23E_PRODUCTION_GO_REPORT.md` | Team tournament smoke |
| `PHASE_V52_PRODUCTION_RBAC_ROLES.sql` | SQL V5.2 roles |
