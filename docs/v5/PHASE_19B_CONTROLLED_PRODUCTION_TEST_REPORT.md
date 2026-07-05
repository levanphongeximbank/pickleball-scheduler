# Phase 19B — Controlled Production Test Report

**Ngày cập nhật:** 2026-07-05  
**Phase:** 19B — Controlled Production Runtime Test  
**Branch:** `v5-platform-edition`  
**Deploy target:** `v5.0.0-rc1`  
**Production Supabase:** `expuvcohlcjzvrrauvud`  
**Production URL:** `https://pickleball-scheduler-eight.vercel.app`  
**Smoke tester:** Phong  

**Trạng thái hiện tại:** ✅ **RBAC PATCH DEPLOYED** (2026-07-05) — `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` · manual RBAC retest **PENDING** · T+24h **PENDING** · payment live **OFF**.

---

## 1. Verdict Phase 19B

| Hạng mục | Verdict |
|----------|---------|
| **Phase 19B prep (pre-deploy)** | ✅ **READY** (2026-07-05) |
| **Production env billing** | ✅ **SET** — `VITE_BILLING_SUPABASE` Production scope |
| **Phase 19B deploy (initial)** | ✅ **DONE** (2026-07-05) — `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` |
| **Phase 19B RBAC patch redeploy** | ✅ **DONE** (2026-07-05) — `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| **Phase 19B Manual RBAC smoke (pre-patch)** | ❌ **PARTIAL/FAIL** — xem §14 |
| **Phase 19B Manual RBAC retest (post-patch)** | ⏳ **PENDING** — owner §16 |
| **Phase 19B smoke T+24h** | ⏸ POST-DEPLOY |
| **Commercial sale** | ⛔ **NO** |
| **Payment live** | ⛔ **NO** |

---

## 2. Câu trả lời nhanh (owner)

| Câu hỏi | Trả lời |
|---------|---------|
| Phase 19B ready chưa? | ✅ Prep ready · ⏳ Deploy chờ owner GO |
| `VITE_BILLING_SUPABASE` đã true chưa? | ✅ **Có** — Production scope (owner 2026-07-05; CLI xác nhận tên biến) |
| Env Production còn lỗi gì? | ✅ **0 blocker** — redeploy sau GO để bundle nhận env mới |
| Có được owner ký GO deploy chưa? | ✅ **Có** — Phong 2026-07-05 |
| Bán thương mại được chưa? | ⛔ **NO** — Gate 4/5 chưa PASS |
| **Đôi tự do** chặn smoke 19B? | ⛔ **NO** — Known Pending **P1**, không phải P0 |
| Cần rollback vì thiếu Đôi tự do? | ⛔ **NO** |
| Forgot password email gửi OK? | ✅ **PASS** — Supabase Auth email tới Gmail |
| Reset link redirect đúng Production? | ❌ **FAIL** — mở `localhost:3000/#access_token=...` (ERR_CONNECTION_REFUSED) |
| Cần rollback vì reset redirect? | ⛔ **NO** — **P1** Auth URL config; sửa Supabase Dashboard, **không** redeploy app |

---

## 3. Prerequisites

| Gate / item | Verdict | Nguồn |
|-------------|---------|-------|
| Gate 1 Staging Pilot Ready | ✅ PASS | `PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` |
| Gate 2 Production SQL 22/22 | ✅ PASS | `GATE_2_PRODUCTION_SQL_READY_REPORT.md` |
| Gate 3 Runtime Preflight | ✅ PASS | `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` |
| Rollback ID recorded | ✅ | `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` |
| Backup/PITR ack | ✅ | Phong 2026-07-05 (Free/Nano — no PITR) |
| Bootstrap venue/owner | ⏳ | Owner — `PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` |

---

## 4. Vercel Production env verify (Phase 19B final)

**Method:** `npx vercel env ls production` (2026-07-05) + Gate 3 owner UI evidence. Values encrypted — không in secret.

### 4.1 Biến có trên Production scope

| Biến | Present | Expected | Status |
|------|---------|----------|--------|
| `VITE_SUPABASE_URL` | ✅ | `expuvcohlcjzvrrauvud` | ✅ PASS (Gate 3 owner) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Production anon | ✅ PASS (Gate 3 owner) |
| `VITE_RBAC_ENABLED` | ✅ | `true` | ✅ PASS |
| `VITE_SEED_DEMO` | ✅ | `false` | ⚠️ Bundle shows `true` — P2; không chặn controlled test |
| `VITE_PAYMENT_MODE` | ✅ | `dev` | ✅ PASS |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | ✅ | `mock` | ✅ PASS |
| `VITE_MARKETPLACE_ENABLED` | ✅ | `false` | ✅ PASS (bundle off) |
| `VITE_ENABLE_AI_ENGINE` | ✅ | `false` | ✅ PASS (bundle off) |
| `VITE_BILLING_SUPABASE` | ✅ | `true` | ✅ PASS (owner 2026-07-05) |
| `SUPABASE_URL` | ✅ | server-only | ✅ OK |
| `API_KEY_STORE` | ✅ | memory/unset | ✅ OK (API OFF) |

### 4.2 Biến absent (đúng kỳ vọng)

| Biến | Status |
|------|--------|
| `VITE_API_ENABLED` | ✅ Absent — API OFF |
| `VITE_*` service role | ✅ Không thấy |
| Staging ref `qyewbxjsiiyufanzcjcq` in Production bundle | ✅ NO (Gate 3) |

### 4.3 Blocker — resolved 2026-07-05

| Biến | Status | Evidence |
|------|--------|----------|
| `VITE_BILLING_SUPABASE` | ✅ **SET** (Production scope) | Owner confirm + `npx vercel env ls production` |

**Env summary:** **0 blocker** · bundle live ✅ (post-deploy scan 2026-07-05).

---

## 5. Engineering automated gates (2026-07-05)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `npm test` | ✅ **769/769 PASS** | 58 suites, 0 fail, ~8.0s |
| `npm run build` | ✅ PASS | `5.0.0-rc1`, Vite 8.1.0, PWA 182 precache |
| `npm run lint` | ✅ **0 errors** | 128 warnings (P2 pre-existing) |
| Production deploy performed | ✅ **DONE** | `npx vercel --prod` 2026-07-05 |

---

## 6. Deploy plan snapshot

| Field | Value |
|-------|-------|
| Target branch | `v5-platform-edition` |
| Target tag | `v5.0.0-rc1` |
| Rollback deployment ID (pre-RBAC-patch) | `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` |
| **Live deployment ID (RBAC patch)** | **`dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`** |
| Deploy URL | `https://pickleball-scheduler-eight.vercel.app` |
| Inspector (live) | `https://vercel.com/pickleball-scheduler/pickleball-scheduler/93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| Previous deployment ID | `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` |
| Smoke tester | Phong |
| Smoke window | Sau deploy → T+24h |
| Payment live | OFF |
| API / Marketplace / AI | OFF |

**Rollback nếu RBAC patch FAIL nghiêm trọng:** promote `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB`

---

## 7. Smoke test status

| # | Check | Automated | Owner manual |
|---|-------|-----------|--------------|
| A1 | `/login` HTTP 200 | ✅ | ☐ |
| A2 | Owner login | — | ☐ |
| A3 | Navigation | — | ☐ |
| A4 | `/billing` trial | — | ☐ |
| A5 | `/court-engine` | — | ☐ |
| A6 | Mobile 375px | — | ☐ |
| A7 | API health | ✅ 200 public (health route public by design) | ☐ |
| A8 | PLAYER RBAC | — | ☐ |
| A9 | Console P0 | — | ☐ |
| A10 | Logout | — | ☐ |
| A11 | HTTPS + manifest 200 | ✅ | ☐ |
| A12 | Forgot password — email gửi | — | ✅ PASS |
| A13 | Reset password — link redirect | — | ❌ FAIL → `localhost:3000` |

**Bundle env scan (post-deploy, `integrationFlags` chunk):**

| Biến | Bundle value |
|------|--------------|
| `VITE_BILLING_SUPABASE` | `true` ✅ |
| `VITE_RBAC_ENABLED` | `true` ✅ |
| `VITE_PAYMENT_MODE` | `dev` ✅ |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` ✅ |
| `VITE_MARKETPLACE_ENABLED` | `false` ✅ |
| `VITE_ENABLE_AI_ENGINE` | `false` ✅ |
| `VITE_SEED_DEMO` | `true` ⚠️ P2 — owner nên set `false` + redeploy sau smoke |

| Window | Status | Date |
|--------|--------|------|
| T+0 P0 owner manual | ⏳ **IN PROGRESS** — Phong (A12 PASS · A13 FAIL) | 2026-07-05 |
| T+1h / T+4h / T+24h | ⏸ | — |

---

## 8. Owner GO deploy signature

| Item | Status |
|------|--------|
| Owner read Phase 19B runbook | ☑ |
| `VITE_BILLING_SUPABASE=true` set | ☑ 2026-07-05 |
| Bootstrap complete (if needed) | ☐ Owner verify |
| **GO deploy signed** | ☑ **Phong, 2026-07-05** |

```
Phase 19B Production Deploy — GO
Tôi approve deploy v5.0.0-rc1 lên Production controlled test.
Payment live: OFF · API/Marketplace/AI: OFF · Không bán thương mại.

Owner: Phong   Date: 2026-07-05
```

---

## 9. Post-deploy update (engineering fill after GO)

| Milestone | Date | Result | Notes |
|-----------|------|--------|-------|
| Deploy completed (initial) | 2026-07-05 | ✅ | `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` |
| Manual RBAC smoke (pre-patch) | 2026-07-05 | ❌ **PARTIAL/FAIL** | §14 |
| RBAC patch GO signed | 2026-07-05 | ✅ | Phong — §16 |
| RBAC patch redeploy | 2026-07-05 | ✅ | `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| T+0 smoke post-patch (automated) | 2026-07-05 | ✅ | login/manifest 200 · bundle labels OK |
| Manual RBAC retest (post-patch) | 2026-07-05 | ⏳ **PENDING** | Owner §16 — 6 accounts |
| T+24h smoke PASS | — | ⏳ | |
| Phase 19B overall | — | ⏳ **IN PROGRESS** | Chờ manual RBAC retest PASS |

**Rollback used:** ☐ Yes · ☑ **No**  
**Payment live:** ⛔ **OFF** (giữ nguyên)  
**Incident log:** P1-Auth-01 · P1-RBAC-01..05 pre-patch (§14) · retest §16

---

## 10. Smoke T+0 finding — P1 Auth reset redirect (2026-07-05)

### 10.1 Symptom (owner smoke)

| Bước | Kết quả |
|------|---------|
| Production `/forgot-password` → gửi email | ✅ **PASS** |
| Email Supabase Auth tới Gmail | ✅ **PASS** |
| Bấm **Reset password** trong email | ❌ **FAIL** — browser mở `http://localhost:3000/#access_token=...` |
| Chrome | `ERR_CONNECTION_REFUSED` |
| Kỳ vọng | `https://pickleball-scheduler-eight.vercel.app/reset-password` (hash tokens) |

| Field | Value |
|-------|-------|
| **Severity** | **P1** — Auth URL config / redirect mismatch |
| **Rollback** | ⛔ **NO** |
| **Redeploy app** | ⛔ **Không cần** (nếu chỉ sửa Supabase Auth URL) |
| **Payment live / API / Marketplace / AI** | ⛔ Giữ OFF |

### 10.2 Code audit (engineering 2026-07-05)

**Kết luận:** App **không** hard-code `localhost:3000` trong forgot/reset flow.

| Chuỗi / file | Kết quả rà soát |
|--------------|-----------------|
| `localhost:3000` | ❌ **Không có** trong `src/` auth flow |
| `resetPasswordForEmail` | `src/features/identity/services/passwordService.js` — `redirectTo = \`${window.location.origin}/reset-password\`` |
| `redirectTo` | Dynamic theo origin trình duyệt (Production URL khi user mở app Production) |
| `/forgot-password` | `src/pages/ForgotPasswordPage.jsx` → `requestPasswordReset()` |
| `/reset-password` | `src/router.jsx` + `src/pages/ResetPasswordPage.jsx` |
| `detectSessionInUrl` | `src/auth/supabaseClient.js` — `true` (hash `#access_token` OK sau redirect đúng) |
| `requestManagedPasswordReset` | `userManagementService.js` — delegate `requestPasswordReset()` |

**Các `localhost` khác (không liên quan reset):** `api/v1/[...path].js` (server URL parse), `NotificationSettingsPage.jsx` (HTTPS hint), docs/test fixtures.

**Root cause (khả năng cao):** Supabase Production project `expuvcohlcjzvrrauvud` — **Authentication → URL Configuration** vẫn **Site URL = `http://localhost:3000`**, hoặc **Redirect URLs** chưa whitelist Production → Supabase fallback Site URL khi redirect recovery link.

### 10.3 Owner fix — Supabase Production Auth URL (không deploy)

**Project:** `pickleball-scheduler-production` / ref `expuvcohlcjzvrrauvud`  
**Không** dùng staging `qyewbxjsiiyufanzcjcq`.

1. Supabase Dashboard → **pickleball-scheduler-production**
2. **Authentication** → **URL Configuration**
3. **Site URL** → set:

   ```
   https://pickleball-scheduler-eight.vercel.app
   ```

4. **Redirect URLs** — thêm (Save):

   ```
   https://pickleball-scheduler-eight.vercel.app
   https://pickleball-scheduler-eight.vercel.app/*
   https://pickleball-scheduler-eight.vercel.app/login
   https://pickleball-scheduler-eight.vercel.app/reset-password
   https://pickleball-scheduler-eight.vercel.app/forgot-password
   ```

5. **Save** — có hiệu lực ngay; **không** cần Vercel redeploy.

### 10.4 Retest (owner, sau §10.3)

| # | Bước | Kỳ vọng |
|---|------|---------|
| R1 | Mở Production `/forgot-password` | Trang OK |
| R2 | Gửi lại email reset (email test) | Email mới |
| R3 | Bấm link **Reset password** | URL bắt đầu `https://pickleball-scheduler-eight.vercel.app/...` — **không** `localhost` |
| R4 | Trang `/reset-password` load | Form đặt mật khẩu mới |
| R5 | Lưu mật khẩu mới | Success → redirect `/login` |
| R6 | Login bằng mật khẩu mới | ✅ PASS |

**Lưu ý:** Link cũ trong email (trước khi sửa Site URL) vẫn trỏ localhost — dùng email **mới** sau khi Save config.

**Ghi kết quả retest:** cập nhật A13 → ✅ PASS trong §7 khi R1–R6 OK.

---

## 11. Known Pending — Feature gaps (không chặn smoke)

> Ghi nhận sau deploy Production 2026-07-05. **Không** coi là P0 · **không** rollback · **không** chặn Commercial Beta/GA checklist (Gate 4/5 vẫn BLOCKED vì lý do khác).

| ID | Severity | Feature | Trạng thái Production (RC1 deploy) | Smoke 19B | Rollback? |
|----|----------|---------|-------------------------------------|-----------|-----------|
| **P1-Auth-01** | **P1** | **Reset password redirect → localhost:3000** | ❌ Site URL / Redirect URLs Supabase Production | ⛔ **Không chặn** (sửa Dashboard §10.3) | ⛔ **Không** |
| **P1-Tournament-01** | **P1** | **Đôi tự do / `open_doubles`** | ❌ Chưa có trên bundle live | ⛔ **Không chặn** | ⛔ **Không** |
| **P1-RBAC-01** | **P1** | **SUPER_ADMIN — runtime platform chặn giải/sân** | ❌ Trên bundle live | ⛔ Patch sẵn · redeploy | ⛔ **Không** |
| **P1-RBAC-02** | **P1** | **COURT_OWNER — hiểu nhầm chủ 1 sân đơn lẻ** | ❌ UX/terminology | ⛔ Patch sẵn · redeploy | ⛔ **Không** |
| **P1-RBAC-03** | **P1** | **CLUB_OWNER — 403 khu vực CLB** | ❌ Trên bundle live | ⛔ Patch sẵn · redeploy | ⛔ **Không** |
| **P1-RBAC-04** | **P1** | **REFEREE — menu quá rộng** | ❌ Trên bundle live | ⛔ Patch sẵn · redeploy | ⛔ **Không** |
| **P2-RBAC-05** | **P2** | **Team Captain capability (PLAYER tạm PASS)** | ⏳ Sau Gate 4 | ⛔ Không chặn | ⛔ **Không** |

### P1-Auth-01 — Reset password redirect (smoke T+0)

| | |
|---|---|
| Severity | **P1** — Auth URL config |
| Forgot email | ✅ PASS |
| Reset link | ❌ FAIL → `localhost:3000/#access_token=...` |
| Code hard-code localhost | ❌ **Không** — `passwordService.js` dùng `window.location.origin` |
| Fix | Owner §10.3 Supabase URL Configuration — **không redeploy** |
| Retest | §10.4 — email reset **mới** sau Save |

### P1-Tournament-01 — Đôi tự do (`open_doubles`)

**Nghiệp vụ:**

- **Đôi tự do** = hạng mục đôi không phân biệt giới tính
- Nam + nam ✅ · Nữ + nữ ✅ · Nam + nữ ✅
- Chỉ cần đúng **2 người** hợp lệ — **không** check giới tính
- **Đôi nam nữ** (`mixed_double`) giữ riêng: bắt buộc **1 nam + 1 nữ**
- **Không** dùng tên "Đôi hỗn hợp" (tránh nhầm với Đôi nam nữ)

**Phân loại:**

| | |
|---|---|
| Severity | **P1** (feature gap) — **không phải P0** |
| Ảnh hưởng runtime core | Không — auth, billing mock, court-engine, RBAC smoke vẫn chạy |
| Ảnh hưởng Gate 1/2/3 | Không |
| Ảnh hưởng SQL Production | Không (app-layer only) |
| Payment live / API / Marketplace / AI | Không bật |

**Quyết định Phase 19B:**

1. Smoke test **tiếp tục** — owner manual §A + T+24h như kế hoạch
2. **Không rollback** deploy vì thiếu tính năng này
3. **Không** đánh dấu Commercial Beta / GA
4. Sau smoke **PASS** → task engineering riêng (xem §11)

**Engineering prep (local, chưa deploy Production):** `docs/v5/TOURNAMENT_OPEN_DOUBLES_FIX_REPORT.md`

---

## 12. Post-smoke follow-up task (sau PASS)

| Task | Priority | Khi làm | Deliverable |
|------|----------|---------|-------------|
| Fix **P1-Auth-01** reset redirect (Supabase Site URL + Redirect URLs) | **P1** | **Ngay** (smoke T+0) | §10.3 owner Dashboard — retest §10.4 — **không deploy** |
| Implement + deploy **open_doubles — Đôi tự do** | **P1** | **Post-19B patch** (sau smoke T+0/T+24h PASS, **trước Gate 4**) | UI + validation + tests + build/lint PASS |
| Scope task | | | `open_double` / alias `open_doubles`; validation 2 người không check gender; giữ `mixed_double` = Đôi nam nữ |
| Deploy | | Controlled redeploy RC — **không** payment live · **không** API/Marketplace/AI Production |
| Gate impact | | Không mở Gate 4/5 — chỉ đóng P1 backlog |

**Không tạo phase gate mới** — xử lý như **Post-19B P1 engineering patch** trên branch `v5-platform-edition`, owner GO redeploy nhỏ khi sẵn sàng.

---

## 13. Gate progression

```
Gate 1 Staging Pilot Ready     ✅ PASS
Gate 2 Production SQL Ready    ✅ PASS (22/22)
Gate 3 Production Runtime      ✅ PASS
Phase 19B Controlled Test      ⏳ IN PROGRESS (RBAC patch deployed; manual retest §16 pending)
Gate 4 Commercial Beta         ⛔ BLOCKED
Gate 5 Commercial GA           ⛔ NO-GO
```

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `PHASE_19B_CONTROLLED_PRODUCTION_RUNTIME_TEST.md` | Runbook + deploy plan |
| `PHASE_19B_PRODUCTION_SMOKE_TEST_CHECKLIST.md` | Owner smoke ticks |
| `PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` | Tenant bootstrap SQL |
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` | Env baseline |
| `TOURNAMENT_OPEN_DOUBLES_FIX_REPORT.md` | P1 follow-up — spec + engineering prep |
| `PHASE_19B_RBAC_NAVIGATION_RUNTIME_PATCH_REPORT.md` | RBAC/navigation/runtime patch (2026-07-05) |

**Report author:** Engineering (Codex session 2026-07-05)  
**Next owner action:** Manual RBAC retest §16 (6 accounts) → T+24h

---

## 14. Manual RBAC smoke — PRE-PATCH PARTIAL/FAIL (2026-07-05)

**Deployment:** `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` (trước RBAC patch)

**Production URL:** `https://pickleball-scheduler-eight.vercel.app`  
**Tester:** Phong  
**Verdict:** ❌ **PARTIAL/FAIL** — CASHIER + PLAYER PASS; 4/6 role FAIL  
**Rollback:** ⛔ **NO**  
**Payment live:** ⛔ **OFF**

| # | Account | Role | Result | Ghi chú |
|---|---------|------|--------|---------|
| 1 | lephong.eximbank@gmail.com | SUPER_ADMIN | ❌ FAIL | Runtime platform chặn quản lý giải/sân |
| 2 | chusantest@gmail.com | COURT_OWNER | ❌ FAIL | Hiểu nhầm chủ 1 sân đơn lẻ; cần chủ cụm sân |
| 3 | ketoan@gmail.com | CASHIER | ✅ PASS | |
| 4 | chutichclb@gmail.com | CLUB_OWNER | ❌ FAIL | 403 khu vực CLB |
| 5 | trongtai@gmail.com | REFEREE | ❌ FAIL | Menu quá rộng |
| 6 | doitruong@gmail.com | PLAYER | ✅ PASS (tạm) | Team Captain = P2 sau |

---

## 15. RBAC patch — engineering + deploy (2026-07-05)

| Item | Status |
|------|--------|
| Owner GO redeploy | ✅ **Phong, 2026-07-05** |
| Deployed Production | ✅ `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz` |
| Rollback target | `dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB` |
| `npm test` (pre-deploy) | ✅ 847/847 PASS |
| `npm run build` (pre-deploy) | ✅ PASS |
| Bundle verify post-deploy | ✅ `navigationConfig` có "Vận hành cụm sân", "Sân thi đấu", `usePageRuntimeAccess` |
| Payment live | ⛔ **OFF** |
| Gate 4 / Commercial Beta / GA | ⛔ **NO** |
| Chi tiết patch | `PHASE_19B_RBAC_NAVIGATION_RUNTIME_PATCH_REPORT.md` |

```
Phase 19B RBAC Patch Redeploy — GO
Tôi approve redeploy patch RBAC/Navigation/Runtime lên Production.
Rollback nếu lỗi nghiêm trọng: dpl_JDEQL1VAP8AMfLWFYi4KuQCWbvLB
Payment live: OFF · API/Marketplace/AI: OFF · Không Gate 4/GA.

Owner: Phong   Date: 2026-07-05
```

---

## 16. Manual RBAC retest — POST-PATCH (PENDING owner)

**Deployment:** `dpl_93AzPgp1oRQQGcnmLJSYHnCyAHGz`  
**URL:** `https://pickleball-scheduler-eight.vercel.app`  
**Tester:** Phong  
**Verdict:** ⏳ **PENDING**  
**Rollback:** ⛔ **NO** (trừ khi P0 sau retest)  
**Payment live:** ⛔ **OFF**

| # | Account | Role | Pre-patch | Post-patch | Ghi chú retest |
|---|---------|------|-----------|------------|----------------|
| 1 | lephong.eximbank@gmail.com | SUPER_ADMIN | ❌ | ☐ | Không bị runtime block giải/sân; vào admin/tenant |
| 2 | chusantest@gmail.com | COURT_OWNER | ❌ | ☐ | Label "Chủ cụm sân"; quản lý nhiều sân; billing/court-engine/tournament |
| 3 | ketoan@gmail.com | CASHIER | ✅ | ☐ | Regression — menu thu ngân OK |
| 4 | chutichclb@gmail.com | CLUB_OWNER | ❌ | ☐ | `/club` không 403; dashboard CLB |
| 5 | trongtai@gmail.com | REFEREE | ❌ | ☐ | Menu tối giản: Chấm trận, QR, Kết quả, Hồ sơ |
| 6 | doitruong@gmail.com | PLAYER | ✅ | ☐ | Regression — không thấy admin |

**Automated T+0 post-patch (engineering):**

| Check | Result |
|-------|--------|
| `/login` HTTP 200 | ✅ |
| `/manifest.webmanifest` 200 | ✅ |
| Bundle `navigationConfig` labels | ✅ Vận hành cụm sân / Sân thi đấu |
| Bundle `usePageRuntimeAccess` | ✅ present |

**Cập nhật verdict §16 khi owner tick xong 6 account.**
