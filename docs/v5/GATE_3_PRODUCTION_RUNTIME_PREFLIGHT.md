# Gate 3 — Production Runtime Preflight (Owner Runbook)

**Ngày cập nhật:** 2026-07-05  
**Branch:** `v5-platform-edition`  
**Version:** `5.0.0-rc1`  
**Prerequisite:** Gate 1 ✅ PASS · Gate 2 ✅ PASS (22/22 SQL)  
**Production Supabase:** `expuvcohlcjzvrrauvud` (`pickleball-scheduler-production`)  
**Staging Supabase:** `qyewbxjsiiyufanzcjcq` (`pickleball-scheduler-stagin`) — **không** dùng cho Production env

**Ràng buộc Gate 3:**

| ⛔ Không làm trong Gate 3 | Lý do |
|---------------------------|-------|
| Deploy Production | Chờ Gate 3 PASS + owner signature Phase 19B |
| Redeploy Production sau đổi env | Chỉ sau owner approve deploy |
| Bật payment live (`stripe`, VNPay, MoMo live) | Phase 23 + owner sign-off riêng |
| Ghi secret / anon key vào repo hoặc docs | Bảo mật |
| Trộn staging ref vào Production scope | Cross-env safety |

---

## 1. Mục tiêu Gate 3

Gate 3 **Production Runtime Ready** = mọi điều kiện runtime đã sẵn sàng để **thảo luận deploy** (Phase 19B). Gate 3 **không** tự động deploy.

| Hạng mục | Owner | Engineering |
|----------|-------|-------------|
| Vercel Production env verify (read-only) | ✅ | Hướng dẫn §3 |
| Cross-env safety (không lẫn staging ref) | ✅ | Script staging local |
| RBAC/Billing/API/Payment flags an toàn | ✅ verify | Documented §4 |
| Rollback deployment ID ghi nhận | ✅ | — |
| Smoke test 24h plan assigned | ✅ | Template §6 |
| Backup/PITR risk acknowledged | ✅ | §5 |
| `npm test` / `build` / `lint` | — | ✅ 2026-07-05 |

**Verdict hiện tại:** xem `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md`.

---

## 2. Supabase project registry (đối chiếu)

| Môi trường | Project ref | URL pattern (không ghi key) |
|------------|-------------|------------------------------|
| **Production** | `expuvcohlcjzvrrauvud` | `https://expuvcohlcjzvrrauvud.supabase.co` |
| Staging | `qyewbxjsiiyufanzcjcq` | `https://qyewbxjsiiyufanzcjcq.supabase.co` |

**Quy tắc:**

- Production scope Vercel **phải** chứa ref `expuvcohlcjzvrrauvud` trong `VITE_SUPABASE_URL`.
- Production scope **không được** chứa `qyewbxjsiiyufanzcjcq`.
- Preview / Development **không được** trỏ Production Supabase.

---

## 3. Owner — Kiểm tra Vercel Production Environment Variables (từng bước)

> **Chỉ đọc / verify.** Không Save thay đổi và **không Redeploy** trong Gate 3 trừ khi engineering + owner đồng thuận deploy (Phase 19B).

### Bước 0 — Mở đúng màn hình

1. Mở [Vercel Dashboard](https://vercel.com/dashboard).
2. Chọn project **pickleball-scheduler** (hoặc tên project tương ứng).
3. Tab **Settings** → **Environment Variables**.
4. Ở filter **Environment**, chọn **Production** (chỉ Production — không mix Preview).

### Bước 1 — Kiểm tra Supabase Production URL (E1, E15)

| # | Biến | Kỳ vọng | Cách kiểm tra | Tick |
|---|------|---------|---------------|------|
| G3-E1 | `VITE_SUPABASE_URL` | URL chứa **`expuvcohlcjzvrrauvud`** | Click biến → xem value (masked OK) — ref phải khớp Production | ☐ |
| G3-E1b | Không lẫn staging | Value **không** chứa `qyewbxjsiiyufanzcjcq` | Nếu thấy staging ref → **FAIL** — dừng, liên hệ engineering | ☐ |
| G3-E2 | `VITE_SUPABASE_ANON_KEY` | Đã set (Production anon) | Biến tồn tại, scope Production, không placeholder `YOUR_ANON_KEY` | ☐ |

**Cách nhận biết đúng project (không cần copy key):**

- Supabase Dashboard → project `pickleball-scheduler-production` → **Settings → API** → so sánh **Project URL** với `VITE_SUPABASE_URL` trên Vercel (cùng ref `expuvcohlcjzvrrauvud`).

### Bước 2 — Core flags (E3–E6) — verify giá trị, chưa redeploy

| # | Biến | Giá trị an toàn cho RC1 | Ý nghĩa | Tick |
|---|------|-------------------------|---------|------|
| G3-E3 | `VITE_RBAC_ENABLED` | `true` | RBAC bắt buộc Production | ☐ |
| G3-E4 | `VITE_SEED_DEMO` | `false` | Không seed demo | ☐ |
| G3-E5 | `VITE_BILLING_SUPABASE` | `true` **hoặc chưa set** | SQL #16–17 đã PASS — có thể set `true` trước deploy; **Gate 3 không redeploy** | ☐ |
| G3-E6 | `VITE_PAYMENT_MODE` | `dev` | Upgrade local — **không live** | ☐ |

> **Lưu ý Gate 3:** Nếu `VITE_BILLING_SUPABASE` chưa có trên Production scope — ghi nhận "NEEDS SET before deploy", **không** Save trong Gate 3 trừ khi đã có lệnh deploy.

### Bước 3 — Flags phải OFF / an toàn (E7–E11)

| # | Biến | Giá trị bắt buộc Gate 3 | Tick |
|---|------|-------------------------|------|
| G3-E7 | `VITE_API_ENABLED` | `false` hoặc **không set** | ☐ |
| G3-E8 | `VITE_MARKETPLACE_ENABLED` | `false` hoặc **không set** | ☐ |
| G3-E9 | `VITE_ENABLE_AI_ENGINE` | `false` hoặc **không set** | ☐ |
| G3-E10 | `VITE_VNPAY_*` / `VITE_MOMO_*` / `VITE_STRIPE_*` (client) | **OFF / empty** — không live credentials | ☐ |
| G3-E11 | `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` (khuyến nghị) | ☐ |

**Nếu bất kỳ flag trên = `true` hoặc có live payment credentials → Gate 3 FAIL** — liên hệ engineering trước khi deploy.

### Bước 4 — Server-only env (E12–E14)

| # | Biến | Kỳ vọng | Tick |
|---|------|---------|------|
| G3-E12 | `SUPABASE_SERVICE_ROLE_KEY` | Có thể set server-only — **không** prefix `VITE_` | ☐ |
| G3-E13 | `API_KEY_STORE` | `memory` hoặc unset (API OFF) | ☐ |
| G3-E14 | `AUDIT_STORE` | `memory` hoặc unset (API OFF) | ☐ |

### Bước 5 — Cross-environment safety (E15–E18)

| # | Kiểm tra | Tick |
|---|----------|------|
| G3-E15 | Production scope **không** trỏ staging URL/key | ☐ |
| G3-E16 | Chuyển filter **Preview** + **Development** — **không** trỏ `expuvcohlcjzvrrauvud` (Production) | ☐ |
| G3-E17 | Không có placeholder `YOUR_PROJECT` / `YOUR_ANON_KEY` trên Production | ☐ |
| G3-E18 | **Chưa** Redeploy Production trong Gate 3 (ghi nhận: chưa redeploy = OK) | ☐ |

### Bước 6 — Integration / mobile (E19–E21)

| # | Biến / check | RC1 | Tick |
|---|--------------|-----|------|
| G3-E19 | `VITE_INTEGRATIONS_STORE_MODE` | unset / `local` | ☐ |
| G3-E20 | `VITE_INTEGRATIONS_SUPABASE` | unset / `false` | ☐ |
| G3-E21 | Production domain HTTPS + PWA (sau deploy) | Owner verify sau Phase 19B | ☐ (post-deploy) |

### Bước 7 — Ghi nhận kết quả (không ghi secret vào repo)

Điền vào file riêng của owner (Notion / ticket / email nội bộ):

```
Gate 3 Vercel Production env verify
Date: __________
Verified by: __________
G3-E1 Production ref in URL: PASS / FAIL
G3-E1b No staging ref in Production: PASS / FAIL
G3-E2 Anon key set: PASS / FAIL
G3-E3–E11 Safe flags: PASS / FAIL
G3-E15–E17 Cross-env: PASS / FAIL
Notes: __________
```

**Không** paste giá trị key vào GitHub issue công khai hoặc docs repo.

---

## 4. RBAC / Billing / API / Payment — trạng thái an toàn

| Layer | Biến | Trạng thái Gate 3 | Ghi chú |
|-------|------|-------------------|---------|
| Auth/RBAC | `VITE_RBAC_ENABLED=true` | Verify trên Vercel | Không fallback PLAYER metadata |
| Billing | `VITE_BILLING_SUPABASE` | Verify / set trước deploy | SQL #16–17 ✅ PASS Gate 2 |
| Payment | `VITE_PAYMENT_MODE=dev` | **Bắt buộc** | ⛔ Không `stripe` / live |
| Payment providers | `VITE_*_ENABLED=false` | **Bắt buộc** | Phase 23 |
| API | `VITE_API_ENABLED=false` | **Bắt buộc** | Chưa prod smoke |
| Marketplace | `VITE_MARKETPLACE_ENABLED=false` | **Bắt buộc** | Phụ thuộc API |
| AI | `VITE_ENABLE_AI_ENGINE=false` | Khuyến nghị OFF | Không blocker core |

**Thứ tự bật sau owner approve deploy (Phase 19B — không làm trong Gate 3):**

1. Set/confirm env core (Supabase + RBAC + billing + `PAYMENT_MODE=dev`)
2. Deploy RC1
3. Smoke 24h (§6)
4. Sau smoke: cân nhắc `API_KEY_STORE` / `AUDIT_STORE=supabase`
5. Sau API staging repeat: `VITE_API_ENABLED`
6. Payment staging → payment live (owner sign-off riêng)

Chi tiết: `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` §6.

---

## 5. Backup / PITR — risk acknowledgement

| Hạng mục | Trạng thái | Owner action |
|----------|------------|--------------|
| Supabase plan | Free/Nano | Acknowledge limitation |
| PITR / scheduled backup | **Không có** trên plan hiện tại | Tick §5.1 report |
| SQL rollback files | ✅ 14 rollback files trong repo | Review `PHASE_19A_PRODUCTION_PREFLIGHT.md` §3.2 |
| Post-SQL data | Schema + seed plans đã apply | Export thủ công sau venue đầu tiên (khuyến nghị) |

### Owner acknowledgement (ký trong report)

- [ ] Tôi hiểu Production **không có PITR** trên plan Free/Nano.
- [ ] Rollback app = promote Vercel deployment cũ (§7).
- [ ] Rollback SQL = scoped files only — **không** drop toàn DB.
- [ ] Sau venue đầu tiên: export mẫu `venues`, `profiles`, `tenant_subscriptions` (khuyến nghị).

**Owner signature:** ________________ **Date:** __________

---

## 6. Smoke test 24h plan (assign trước deploy)

Adapt từ `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` — chạy trên **Production URL** sau Phase 19B deploy (không chạy trong Gate 3 preflight).

| Window | Check | Owner | Tick |
|--------|-------|-------|------|
| Pre-deploy | Gán người smoke + account COURT_OWNER + PLAYER trên Production | Owner | ☐ |
| T+0 | Login owner + staff; `/dashboard` load | Owner | ☐ |
| T+0 | Billing page; trial status hiển thị | Owner | ☐ |
| T+0 | OperationalRouteGate — `no_subscription` blocked đúng | Owner | ☐ |
| T+1h | Court Engine session tạo/lưu (localStorage pilot) | Owner | ☐ |
| T+4h | Mobile login + bottom nav | Owner | ☐ |
| T+24h | Không spike lỗi auth/403; subscription state ổn | Owner | ☐ |

**Engineering pre-deploy (local — đã chạy 2026-07-05):**

```bash
npm test
npm run build
npm run lint
```

**Staging scripts (credentials local — không thay Vercel checklist):**

```bash
npm run test:verify-staging-env
npm run test:verify-billing-tenant-mapping
```

---

## 7. Vercel rollback — ghi deployment ID

> Thực hiện **trước** mọi Production deploy Phase 19B.

### Bước owner

1. Vercel → project → tab **Deployments**.
2. Lọc **Production**.
3. Deployment **đang live** (hoặc deployment cuối cùng nếu chưa có custom domain) → copy **Deployment ID** (hoặc URL slug).
4. Ghi vào ticket nội bộ / report § owner evidence — **không** commit vào repo.

| Field | Ghi nhận |
|-------|----------|
| Deployment ID | `________________` |
| Deployment URL | `________________` |
| Git commit / tag hiện tại | `________________` |
| Ngày ghi | `________________` |
| Ghi bởi | `________________` |

**Rollback:** Deployments → chọn deployment cũ → **Promote to Production**.

---

## 8. Gate 3 GO / NO-GO

### GO — Gate 3 PASS (cho phép thảo luận Phase 19B deploy)

| # | Điều kiện |
|---|-----------|
| 1 | Gate 2 ✅ PASS (22/22 SQL) |
| 2 | G3-E1 → G3-E17 owner tick **PASS** |
| 3 | Không staging ref trong Production env |
| 4 | Payment/API flags an toàn (§4) |
| 5 | Rollback deployment ID ghi nhận (§7) |
| 6 | Backup/PITR ack signed (§5) |
| 7 | Smoke 24h plan assigned (§6) |
| 8 | Engineering: `npm test` + `build` + `lint` PASS |

### NO-GO — giữ nguyên (mặc định Gate 3 hiện tại)

| # | Blocker |
|---|---------|
| 1 | Deploy Production app |
| 2 | Redeploy sau đổi env (trước owner approve) |
| 3 | Bật payment live |
| 4 | `VITE_API_ENABLED=true` trên Production |
| 5 | Production env trỏ staging ref |

---

## 9. Câu hỏi thường gặp

**Hỏi: Gate 3 có deploy Production không?**  
Trả lời: **Không.** Gate 3 chỉ preflight + owner verify env.

**Hỏi: Tôi có Save env mới trên Vercel không?**  
Trả lời: Chỉ **đọc/verify** trong Gate 3. Set giá trị mới + redeploy thuộc Phase 19B sau Gate 3 PASS.

**Hỏi: `VITE_BILLING_SUPABASE` bật chưa?**  
Trả lời: Gate 3 **verify** — có thể chưa set. Bật + redeploy khi owner approve deploy (SQL billing đã PASS).

**Hỏi: Staging script PASS có thay Vercel checklist không?**  
Trả lời: **Không.** `test:verify-staging-env` chỉ validate staging credentials local.

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `GATE_3_PRODUCTION_RUNTIME_PREFLIGHT_REPORT.md` | Verdict + evidence |
| `GATE_2_PRODUCTION_SQL_READY_REPORT.md` | Prerequisite Gate 2 |
| `PHASE_21_PRODUCTION_PREFLIGHT_PLAN.md` | Master preflight + flag plan |
| `PHASE_19A_PRODUCTION_PREFLIGHT.md` | ENV E1–E21 baseline |
| `GA-PRODUCTION-ENV-CHECKLIST.md` | GA env reference |
| `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | Smoke template |
| `V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gate 3–5 definition |
| `V5_COMMERCIAL_GA_BLOCKER_REGISTER.md` | B08, B11, B10 |
