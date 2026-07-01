# Release Notes — Pickleball Scheduler Pro v4.0.0

**Release Date:** 2026-07-01  
**Codename:** General Availability (GA)  
**Previous:** `4.0.0-rc.1` (Sprint 11 Release Candidate)

---

## Tổng quan

Version 4.0 là bản **SaaS production-ready** đầu tiên: xác thực Supabase, RBAC đầy đủ, multi-tenant, subscription lifecycle, tournament/court engine, dashboard analytics, mobile PWA, và nền tảng API/marketplace (preview).

**Sprint 12** không thêm tính năng — chỉ hoàn thiện môi trường production, checklist SQL/QA, và tài liệu phát hành.

---

## Completed Sprints (1–12)

| Sprint | Nội dung |
|--------|----------|
| 1 | Identity Phase A — roles, permissions, audit_logs |
| 2 | Multi-tenant (tenant = venue) |
| 3 | Club Management — members, ELO, matches |
| 4 | Subscription — Trial/Starter/Pro/Enterprise |
| 5 | Tournament Engine 4.0 |
| 6 | Court Engine — check-in, queue, auto assign |
| 7 | AI Assistant (opt-in flag) |
| 8 | Dashboard Analytics |
| 9 | Mobile / PWA / QR Check-in |
| 10 | API / Marketplace / Integrations (preview) |
| 11 | Release Candidate hardening — lint, RBAC default, docs |
| 12 | GA — production env, SQL/QA checklists, release docs |

---

## Điểm nổi bật GA

### Production-ready

- **RBAC** bật mặc định trên production build (`VITE_RBAC_ENABLED=true`)
- **Supabase Auth** — login, session, profile từ `public.profiles`
- **RLS** — 15 bước SQL documented (`docs/SUPABASE-PRODUCTION-CHECKLIST.md`)
- **Security hardening** — signup luôn PLAYER; profile update guarded; Director JWT

### Vận hành giải đấu

- Internal / Official / Daily Play tournaments
- Director Mode + Realtime scoreboard
- Referee hub + token-scoped RPC
- Tournament Engine 4.0 + season/Elo

### Vận hành sân

- Court Management (bookings, calendar, revenue)
- Court Engine (queue, auto assignment, timer)
- Dashboard KPI, heatmap, peak hours

### SaaS

- Multi-tenant isolation
- Subscription lifecycle (renew, grace, lock)
- User Management, Audit Log (SUPER_ADMIN)
- Mobile shell + PWA + QR check-in

---

## Breaking Changes (từ v3.x)

1. **RBAC production bắt buộc** — Khi `VITE_RBAC_ENABLED=true`, mọi route/menu/action enforce permission; không fallback role từ metadata.
2. **Profile bắt buộc** — User phải có row `public.profiles` hợp lệ; thiếu profile → không vào app.
3. **Signup role cố định PLAYER** — Chỉ SUPER_ADMIN đổi role (SQL lần đầu hoặc User Management).
4. **Director Mode yêu cầu Supabase** — Realtime + JWT session; không dev anon fallback trên Preview/Production.
5. **Role alias** — `VENUE_*` ↔ `COURT_*` normalized trong code; SQL/UI có thể dùng cả hai tên legacy.
6. **Cloud sync schema v3** — Blob `pickleball-club-data-v3::{clubId}`; migration tự động từ v2 keys.

---

## Migration Notes

### Vercel

1. Set env production theo `docs/GA-PRODUCTION-ENV-CHECKLIST.md`
2. **`VITE_RBAC_ENABLED=true`** bắt buộc
3. Redeploy sau khi đổi env

### Supabase Production

Chạy **15 file SQL** theo thứ tự trong `docs/SUPABASE-PRODUCTION-CHECKLIST.md`:

1. club-v3 → rbac → club-v3-rls
2. match-live → match-live-rls → security-hardening → match-live-v2
3. identity sprint1 → phaseB → phaseC
4. multi-tenant → subscription → ai-assistant → mobile → sprint10

Sau SQL:

- Bật Realtime `tournament_match_live`
- Promote SUPER_ADMIN qua SQL Editor
- Tạo venue + gán role user vận hành

### Local dev

- Giữ `VITE_RBAC_ENABLED=false` trong `.env` — workflow cũ không đổi
- Production QA **không** dùng local dev bypass

---

## Known Limitations

- **Payment live** — VNPay/MoMo/Stripe chưa production; dùng `VITE_PAYMENT_MODE=dev` hoặc Stripe Payment Links khi sẵn sàng
- **API / Marketplace** — Preview-only; flags mặc định OFF
- **AI Assistant** — Opt-in `VITE_ENABLE_AI_ENGINE=true` + SQL sprint7
- **Push notifications** — Scaffold; cần Edge Function để gửi thật
- **Module Xếp sân** — Không ghi điểm mùa/Elo (theo thiết kế v3.5)
- **ESLint** — 0 errors; 111 warnings hooks (không chặn GA)

---

## Upgrade từ v3.5.x

1. Apply SQL checklist trên Supabase production
2. Bật RBAC trên Vercel
3. Promote admin + tạo venue
4. Sync CLB lên cloud; cập nhật `venue_id` trên `club_data_v3`
5. Chạy QA `docs/GA-PRODUCTION-QA.md`

---

## Tài liệu

| Tài liệu | Mục đích |
|----------|----------|
| `DEPLOYMENT_GUIDE.md` | Hướng dẫn deploy GA |
| `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Phase 1 env |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | Phase 2 SQL |
| `docs/GA-PRODUCTION-QA.md` | Phase 3 QA |
| `docs/GA-FINAL-AUDIT.md` | Phase 6 audit |
| `docs/ARCHITECTURE.md` | Kiến trúc v4 |
| `ROADMAP.md` | Hướng phát triển sau GA |

---

## Tag

Sau khi QA pass:

```bash
git tag -a v4.0.0 -m "Pickleball Scheduler Pro v4.0.0 GA"
# Không push tag cho đến khi bạn xác nhận
```
