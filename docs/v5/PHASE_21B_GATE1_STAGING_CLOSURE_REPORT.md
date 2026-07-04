# Phase 21B — Gate 1 Staging Closure Report

**Ngày:** 2026-07-04  
**Phase:** 21B — Owner Staging Gate 1 Closure  
**Mục tiêu:** Đóng **Gate 1 — Staging Pilot Ready** (không Production)

---

## 1. Verdict Phase 21B

| Hạng mục | Verdict |
|----------|---------|
| Script + tài liệu owner env fix | ✅ **PASS** |
| `npm run test:verify-staging-env` | ✅ **PASS** |
| `npm run test:verify-billing-tenant-mapping` | ✅ **PASS** |
| Owner smoke desktop (Preview) | ✅ **PASS** — 2026-07-04 owner manual |
| Mobile ≥1 OS (iPhone Safari) | ✅ **PASS** — 2026-07-04 owner manual |
| **Gate 1 Staging Pilot Ready** | ✅ **PASS** |

**Verdict tổng Phase 21B:** ✅ **PASS** — automated + owner smoke + mobile đã đóng Gate 1.

---

## 2. Tiêu chí Gate 1

| # | Tiêu chí | Trạng thái | Ghi chú |
|---|----------|------------|---------|
| 1 | `test:verify-staging-env` PASS | ✅ | 2026-07-04 local |
| 2 | `test:verify-billing-tenant-mapping` PASS | ✅ | 1 venue operational (`venue-staging-a` / trialing) |
| 3 | Owner login Preview (owner thật) | ✅ | Smoke desktop §1–2 |
| 4 | Billing trial/active hiển thị | ✅ | Smoke desktop §4 |
| 5 | Court Engine vào được | ✅ | Smoke desktop §5; mobile §4 |
| 6 | Reload không trắng màn | ✅ | Smoke desktop §6; mobile §5 |
| 7 | Mobile ≥1 OS | ✅ | iPhone Safari — 2026-07-04 |

---

## 3. Owner manual smoke (2026-07-04)

### Desktop (owner staging)

| # | Mục | Kết quả |
|---|-----|---------|
| 1 | Mở Preview URL | ✅ PASS |
| 2 | Login owner staging | ✅ PASS |
| 3 | Venue hiển thị đúng | ✅ PASS |
| 4 | Billing trial/active | ✅ PASS |
| 5 | Court Engine vào được | ✅ PASS |
| 6 | Reload Court Engine không trắng màn | ✅ PASS |
| 7 | Logout/login lại | ✅ PASS |

**Blocker desktop:** Không có.

### Mobile

| Thông tin | Giá trị |
|-----------|---------|
| Thiết bị | iPhone Safari |

| # | Mục | Kết quả |
|---|-----|---------|
| 1 | Login | ✅ PASS |
| 2 | Menu mobile | ✅ PASS |
| 3 | Billing | ✅ PASS |
| 4 | Court Engine | ✅ PASS |
| 5 | Reload | ✅ PASS |
| 6 | QR/camera | ⏭️ SKIP — không test trong phiên này (không chặn Gate 1) |

**Blocker mobile:** Không có.

**Checklist đầy đủ:** `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` (17 mục — core path PASS).

---

## 4. Kết quả staging scripts (2026-07-04)

### `test:verify-staging-env`

- URL staging `qyewbxjsiiyufanzcjcq` — OK
- Anon key hợp lệ — API probe PASS
- Không in secret

### `test:verify-billing-tenant-mapping`

- `venues`: 2 rows (`venue-staging-a`, `venue-staging-b`)
- `tenant_subscriptions`: 1 row — `venue-staging-a` / trialing
- `profiles.venue_id` alignment — OK (service role)
- Operational: 1 venue trialing; `venue-staging-b` — no_subscription (không chặn pilot nếu owner dùng venue-a)

---

## 5. Verification local (engineering)

```bash
npm test                    # 769/769 PASS
npm run build               # PASS
npm run lint                # 0 errors, 128 warnings legacy
npm run test:verify-staging-env              # PASS
npm run test:verify-billing-tenant-mapping   # PASS
```

---

## 6. Files Phase 21B

### Mới

- `docs/v5/PHASE_21B_OWNER_STAGING_ENV_FIX.md` — hướng dẫn owner sửa `.env.local`
- `docs/v5/PHASE_21B_GATE1_STAGING_CLOSURE_REPORT.md` — file này

### Cập nhật

- `scripts/verify-staging-env-preflight.mjs` — cảnh báo service role, message tiếng Việt rõ hơn
- `scripts/verify-billing-tenant-mapping-staging.mjs` — bảng giải thích lỗi khi probe fail
- `docs/v5/PHASE_21_COMMERCIAL_READINESS_REPORT.md` — trạng thái Gate 1 / Phase 21B

### Không tạo

- Checklist smoke mới (dùng `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md`)

---

## 7. Phase tiếp theo (sau Gate 1 PASS)

| Việc | Owner / Engineering | Ghi chú |
|------|---------------------|---------|
| **Pilot staging 1 sân** | Owner | ✅ **GO** — vận hành thử trên Preview staging |
| Production SQL Batch A #1–#15 → Batch B #16–#21 → Batch C #22 | Owner | Gate 2 — chưa apply (Production DB trống) |
| Production Preflight execution | Owner | Chỉ **bắt đầu** sau owner approve SQL apply |
| Production deploy | — | ⛔ NO-GO — Gate 2+3 chưa PASS |
| Payment live | — | ⛔ NO-GO — không bật |

---

## 8. Production / Commercial

| Câu hỏi | Trả lời |
|---------|---------|
| Gate 1 Staging Pilot Ready? | ✅ **PASS** |
| Đủ pilot staging 1 sân? | ✅ **GO** — owner smoke + iPhone mobile PASS |
| Sang Production SQL Ready (Gate 2)? | ❌ **NO-GO** — SQL #1–#22 chưa apply trên Production; Gate 2 riêng biệt |
| Commercial GA? | ❌ **NO-GO** — xem `PHASE_21_COMMERCIAL_READINESS_REPORT.md` |

**Không thực hiện trong Phase 21B:** Production SQL apply, Production deploy, payment live.

---

## Tham chiếu

| File | Vai trò |
|------|---------|
| `PHASE_21B_OWNER_STAGING_ENV_FIX.md` | Sửa env staging |
| `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | Smoke manual |
| `PHASE_20_MOBILE_PILOT_QA.md` | Mobile QA |
| `V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gate 1–3 |
