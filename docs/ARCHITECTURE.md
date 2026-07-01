# Kiến trúc v4.0 — Pickleball Scheduler Pro

Tài liệu tổng quan kiến trúc Release Candidate 4.0. Chi tiết từng module: `src/features/<module>/ARCHITECTURE.md`.

## Tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│  React SPA (Vite) — src/pages + src/features               │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ Auth/RBAC    │ Multi-Tenant │ Subscription │ Tournament    │
│ Identity     │ TenantContext│ lifecycle    │ Engine + AI     │
├──────────────┴──────────────┴──────────────┴───────────────┤
│ Court Engine │ Dashboard    │ Mobile/PWA   │ API/Marketplace│
│              │ Analytics    │ QR Check-in  │ (preview)      │
├─────────────────────────────────────────────────────────────┤
│ localStorage (club blob v3)  │  Supabase (RLS + RPC)         │
└─────────────────────────────────────────────────────────────┘
```

**Nguyên tắc:** Module mới trong `src/features/`. Production routes giữ trong `src/router.jsx`. Local-first; cloud sync qua `club_data_v3`.

---

## Auth & RBAC (Sprint 1, Identity Phase A–C)

| Thành phần | Path |
|------------|------|
| Roles / permissions | `src/features/identity/constants/` |
| Matrix quyền | `src/features/identity/matrix/rolePermissions.js` |
| `can()`, guards | `src/auth/rbac.js`, `guardAction.js` |
| Route guard | `RouteAccessGate`, `authGuard.js` |
| Menu guard | `menuAccess.js`, `sidebarMenu.js` |
| User mgmt / audit | `src/features/identity/services/` |

**Production:** `VITE_RBAC_ENABLED=true` (mặc định khi build `PROD` nếu env không set). Dev local: `false`.

**Fallback:** Khi RBAC bật, role không có permission → **deny**. `SUPER_ADMIN` → full access.

---

## Multi Tenant (Sprint 2)

- `tenantId` alias `venueId` — không duplicate bảng tenant.
- `TenantContext`, `TenantSwitcher`, `TenantGate`.
- SQL: `docs/supabase-multi-tenant-sprint2.sql` (view `tenants`, mở rộng `venues.status`).
- Guard: `src/features/tenant/guards/tenantGuard.js`.

---

## Subscription (Sprint 4)

- Gói: Trial / Starter / Professional / Enterprise.
- Lifecycle: gia hạn, grace 3 ngày, khóa khi expired.
- `SubscriptionBanner`, `SubscriptionGate`, `subscriptionGuard.js`.
- SQL: `docs/supabase-subscription-sprint4.sql`.

---

## Tournament Engine (Sprint 5) + AI Assistant (Sprint 7)

| Module | Path | Flag |
|--------|------|------|
| Tournament Engine 4.0 | `src/features/tournament-engine/` | luôn có (local) |
| AI Assistant | `src/features/ai-assistant/` | `VITE_ENABLE_AI_ENGINE` |

AI: seed, pairing, group, time prediction, schedule validator, rule suggestion. Không gọi API bên ngoài mặc định.

---

## Court Engine (Sprint 6)

- Check-in, queue, auto assignment, referee dispatch, timer, transfer.
- Route `/court-engine`. Module: `src/features/court-engine/`.

---

## Dashboard Analytics (Sprint 8)

- KPI, heatmap, peak hours, revenue chart, top players/courts.
- `src/features/dashboard-analytics/`. Dữ liệu từ club blob + booking aggregates.

---

## Mobile / PWA (Sprint 9)

- `vite-plugin-pwa`, bottom nav, offline queue.
- QR check-in, push subscription scaffold.
- Routes `/mobile/*`. SQL: `docs/supabase-mobile-sprint9.sql`.

---

## API & Marketplace (Sprint 10) — Preview

- `src/features/api/`, `src/features/integrations/`.
- Flags: `VITE_API_ENABLED`, `VITE_MARKETPLACE_ENABLED` (mặc định `false`).
- Payment providers mock/dev; VNPay/MoMo/Stripe qua env riêng.
- SQL: `docs/supabase-sprint10.sql`.

Menu ẩn khi flag tắt; trang hiển thị thông báo thay vì crash.

---

## Club Management (Sprint 3)

- Routes `/clubs`, `/clubs/:id` — members, ELO, matches, internal tournaments.
- `src/features/club/`.

---

## Storage & sync

| Key / table | Mục đích |
|-------------|----------|
| `pickleball-club-data-v3::{clubId}` | Unified blob per club |
| `club_data_v3` (Supabase) | Cloud backup |
| `profiles`, `venues` | Auth + tenant |
| `tournament_match_live` | Director / referee realtime |

---

## Feature flags (RC)

| Flag | RC status |
|------|-----------|
| `VITE_RBAC_ENABLED` | **Production-ready** (`true`) |
| `VITE_SUPABASE_*` | **Production-ready** (bắt buộc cho auth cloud) |
| `VITE_PAYMENT_MODE=dev` | **Beta** (upgrade local) |
| `VITE_ENABLE_AI_ENGINE` | **Beta** (opt-in) |
| `VITE_API_ENABLED` | **Preview** |
| `VITE_MARKETPLACE_ENABLED` | **Preview** |
| `VITE_*_ENABLED` (VNPay/MoMo/Stripe/Zalo/Email/SMS) | **Dev/mock** |

---

## SQL migration order

Xem `docs/SUPABASE-STAGING-CHECKLIST.md` — Sprint 1–10 theo thứ tự additive.

---

## Tests

`npm run test:unit` — 542+ tests gồm RBAC, tenant, subscription, mobile, court-engine, AI, sprint10.
