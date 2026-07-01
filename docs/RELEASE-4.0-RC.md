# Release 4.0.0-rc.1 — Go/No-Go

**Phiên bản hiện tại:** `4.0.0-beta` → mục tiêu `4.0.0-rc.1`  
**Sprint 11:** Release Candidate Hardening (không thêm tính năng mới)

---

## Release scope

| Sprint | Nội dung | SQL |
|--------|----------|-----|
| 1 | Identity Phase A — roles/permissions/audit | `supabase-identity-v40-sprint1.sql` |
| 2 | Multi-tenant | `supabase-multi-tenant-sprint2.sql` |
| 3 | Club Management | (localStorage, không SQL bắt buộc) |
| 4 | Subscription | `supabase-subscription-sprint4.sql` |
| 5 | Tournament Engine | (local) |
| 6 | Court Engine | (local) |
| 7 | AI Assistant | `supabase-ai-assistant-sprint7.sql` |
| 8 | Dashboard Analytics | (local) |
| 9 | Mobile/PWA/QR | `supabase-mobile-sprint9.sql` |
| 10 | API/Marketplace | `supabase-sprint10.sql` |
| 11 | Hardening | lint/RBAC/docs/CI |

---

## Build / test / lint (Sprint 11)

| Lệnh | Kỳ vọng RC |
|------|------------|
| `npm run lint` | PASS (0 errors) |
| `npm run test:unit` | PASS (542+ tests, gồm subscription-sprint4) |
| `npm run build` | PASS |

---

## Env Vercel Production (RC)

| Biến | Giá trị RC |
|------|------------|
| `VITE_SUPABASE_URL` | URL production |
| `VITE_SUPABASE_ANON_KEY` | Anon key |
| `VITE_RBAC_ENABLED` | **`true`** |
| `VITE_SEED_DEMO` | `false` |
| `VITE_PAYMENT_MODE` | `dev` (hoặc `stripe` khi có links) |
| `VITE_ENABLE_AI_ENGINE` | `false` (bật sau QA) |
| `VITE_API_ENABLED` | `false` |
| `VITE_MARKETPLACE_ENABLED` | `false` |

CI deploy (`.github/workflows/deploy.yml`): mặc định `VITE_RBAC_ENABLED=true`.

---

## SQL checklist (Supabase — bạn chạy thủ công)

Thứ tự đầy đủ: **`docs/SUPABASE-STAGING-CHECKLIST.md`**

Tóm tắt bổ sung Sprint 2–10 (sau Phase C):

11. `supabase-multi-tenant-sprint2.sql`
12. `supabase-subscription-sprint4.sql`
13. `supabase-ai-assistant-sprint7.sql` (nếu bật AI)
14. `supabase-mobile-sprint9.sql`
15. `supabase-sprint10.sql` (nếu bật API/Marketplace preview)

Rollback từng sprint: file `*-rollback.sql` tương ứng trong `docs/`.

---

## Manual QA checklist

### Auth cơ bản

- [ ] Login / Logout / session restore
- [ ] `/403` khi truy cập route không có quyền
- [ ] Profile bắt buộc từ `profiles` khi RBAC bật

### Core flows

- [ ] Players, Courts, Clubs, Tournament setup
- [ ] Director Mode, Court Engine, Dashboard
- [ ] Mobile routes (`/mobile/*`)
- [ ] Subscription gate (tenant expired)
- [ ] Tenant guard / TenantSwitcher

### Role-based QA

Chi tiết: **`docs/RBAC-RC-QA.md`**

| Role | Smoke test |
|------|------------|
| SUPER_ADMIN | Toàn menu + Tenant Management |
| COURT_OWNER | Sân + tài chính + settings venue |
| COURT_MANAGER | Vận hành sân, không system settings |
| ACCOUNTANT | Revenue / finance views |
| CASHIER | Bookings / check-in |
| REFEREE | `/referee`, match update |
| CLUB_OWNER | CLB của mình |
| PLAYER | Hồ sơ + giải + ranking self |

### Preview-only (flag OFF)

- [ ] Marketplace / Integrations **không** hiện menu
- [ ] Truy cập URL trực tiếp → thông báo "chưa bật", không white screen

---

## Known limitations (RC)

- Payment production: chưa có VNPay/MoMo/Stripe live — dùng `VITE_PAYMENT_MODE=dev`.
- API/Marketplace: preview-only, flags mặc định tắt.
- AI Assistant: opt-in `VITE_ENABLE_AI_ENGINE=true` + SQL sprint7.
- Push notifications: scaffold; cần Edge Function cho gửi thật.
- Module Xếp sân không ghi điểm mùa/Elo (theo thiết kế v3.5).

---

## Go / No-Go

### Go RC khi

- [x] Lint 0 errors, test:unit pass, build pass
- [ ] SQL staging checklist pass (bạn apply trên Supabase staging)
- [ ] RBAC QA theo role pass trên staging/preview
- [ ] `VITE_RBAC_ENABLED=true` trên Vercel Preview/Production

### No-Go nếu

- RLS chưa apply đủ → RBAC bật sẽ chặn hợp lệ hoặc lộ dữ liệu
- Profile/sync lỗi sau login production
- Blocker P0 còn trong audit thủ công

**Không tự gắn tag `v4.0.0` — chỉ RC sau khi checklist trên pass.**
