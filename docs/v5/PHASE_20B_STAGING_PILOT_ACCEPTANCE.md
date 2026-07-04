# Phase 20B — Staging Pilot Acceptance

**Ngày:** 2026-07-04  
**Branch:** `v5-platform-edition`  
**Commit:** `9f63fce` — `docs(v5): add Phase 19A production SQL apply pack`  
**Version:** `5.0.0-rc1` / `V5.0 SaaS Preview RC1`

**Phạm vi:** Xác nhận điều kiện pilot staging 1 sân thật. **Không** production deploy, **không** payment live, **không** apply production SQL.

---

## Step 1 — Repo snapshot

### Git

| Lệnh | Kết quả |
|------|---------|
| `git branch --show-current` | `v5-platform-edition` |
| `git log -1 --oneline` | `9f63fce docs(v5): add Phase 19A production SQL apply pack` |
| `git status` | Phase 20 code + docs chưa commit (modified + untracked) |

### Automated gates

| Lệnh | Kết quả |
|------|---------|
| `npm test` | ✅ **769/769 PASS** (thêm 3 test Phase 20B operational route) |
| `npm run build` | ✅ PASS (~1.2s) |
| `npm run lint` | ✅ **0 errors**, 128 warnings legacy |

### Staging script (local)

```bash
npm run test:verify-billing-tenant-mapping
```

| Kết quả | Ghi chú |
|---------|---------|
| ⚠️ **Không chạy được đầy đủ** | `.env.local` trả `Unregistered API key` — cần owner cập nhật credentials staging |

**Env cần có (không commit secret):**

| Biến | Bắt buộc | Mục đích |
|------|----------|----------|
| `VITE_SUPABASE_URL` | Có | Supabase staging project URL |
| `VITE_SUPABASE_ANON_KEY` | Có | Anon key staging |
| `SUPABASE_SERVICE_ROLE_KEY` | Khuyến nghị | Đọc `profiles.venue_id` alignment |
| `STAGING_PILOT_VENUE_ID` | Tùy chọn | Lọc venue pilot |
| `STAGING_PILOT_OWNER_EMAIL` | Tùy chọn | Xác nhận owner profile |
| Preview URL | Manual QA | Vercel Preview staging (owner điền khi test) |

---

## Step 2 — Owner smoke checklist

→ `docs/v5/PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` (17 mục tiếng Việt)

---

## Step 3 — Staging trial RPC verification

Script: `scripts/verify-billing-tenant-mapping-staging.mjs` (cập nhật Phase 20B)

Kiểm tra tự động khi có credentials:

1. Có venue staging
2. Có profile owner (khi set `STAGING_PILOT_OWNER_EMAIL`)
3. `profiles.venue_id = venues.id`
4. Có row `tenant_subscriptions`
5. Status `trialing` hoặc `active`
6. Báo `no_subscription` / `expired` / `suspended` không operational

**Trạng thái hiện tại:** Owner cần chạy script trên máy có `.env.local` staging hợp lệ.

---

## Step 4 — Operational route smoke (automated)

Tests: `tests/billing-phase20-pilot-hardening.test.js`

| Route | Tenant operational | Tenant blocked |
|-------|-------------------|----------------|
| `/` | Mở (gate) | Khóa |
| `/dashboard` | Mở | Khóa |
| `/billing` | Mở (exempt) | Mở |
| `/billing/support` | Mở (exempt) | Mở |
| `/court-engine` | Mở | **Khóa** |
| `/players` | Mở | **Khóa** |
| `/clubs` | Mở | Khóa |
| `/tournaments` | Mở | Khóa |
| `/profile`, `/403` | Mở (exempt) | Mở |

Module: `OperationalRouteGate.jsx`, `operationalRoutePolicy.js`, `TenantOperationalGate.jsx`

---

## Step 5 — Court Engine pilot safety

| Kiểm tra | Kết quả |
|----------|---------|
| Tenant-scoped storage key | ✅ Automated (`court-engine-storage.test.js`) |
| Tenant A ≠ Tenant B | ✅ |
| Reload cùng tenant | ✅ |
| `venue-demo` / `tenant-demo` production path | ⚠️ Chỉ dev fallback khi RBAC tắt (`authService.js`) — staging pilot **bắt buộc RBAC + owner thật** |
| localStorage backup | ⚠️ Pilot cần export trước vận hành |

→ Chi tiết: `docs/v5/PHASE_20_COURT_ENGINE_PERSISTENCE.md`

---

## Step 6 — Mobile pilot QA

→ `docs/v5/PHASE_20_MOBILE_PILOT_QA.md` (bảng tick owner)

---

## Step 7 — Verdict tạm thời

| Gate | Trạng thái |
|------|------------|
| Automated tests/build/lint | ✅ PASS |
| Staging Supabase verify script | ⏳ Owner (thiếu credentials local) |
| Owner manual smoke 17 mục | ⏳ Chưa điền |
| Mobile Android + iPhone | ⏳ Chưa điền |

**Verdict Phase 20B (automated):** **PARTIAL PASS** — sẵn sàng handoff owner QA staging.

**Báo cáo đầy đủ:** `docs/v5/PHASE_20B_VERIFICATION_REPORT.md`
