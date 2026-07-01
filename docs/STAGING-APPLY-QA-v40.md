# Staging Apply & Manual QA — v4.0 (tổng hợp)

**Mục tiêu:** Apply SQL + QA toàn bộ v4.0 trên Supabase staging và Vercel **Preview**. **Không** deploy production.

---

## Thứ tự thực hiện

| Bước | Tài liệu | Nội dung |
|------|----------|----------|
| 1 | `docs/SUPABASE-STAGING-CHECKLIST.md` | SQL bước 1–9, tạo admin, gán role |
| 2 | `docs/STAGING-APPLY-QA-v358.md` | Regression v3.5.8 (RLS, referee RPC, director) |
| 3 | `docs/STAGING-APPLY-QA-v40-phaseB.md` | Identity: `/403`, `/profile`, `/users`, password, audit, referee session |
| 4 | `docs/MULTI-TENANT-SPRINT2-CHECKLIST.md` | Multi-tenant: isolation, TenantSwitcher, `/admin/tenants` |
| 5 | SQL bước 10 `supabase-identity-v40-phaseC.sql` + QA `/audit` | RPC user/audit server-side |

---

## Env Preview (bắt buộc QA v4)

```env
VITE_SUPABASE_URL=<staging>
VITE_SUPABASE_ANON_KEY=<staging>
VITE_RBAC_ENABLED=true
VITE_SEED_DEMO=false
VITE_PAYMENT_MODE=dev
```

Local dev mặc định `VITE_RBAC_ENABLED=false` — workflow cũ không đổi.

---

## User test tối thiểu (10)

| Email | Role | Dùng cho |
|-------|------|----------|
| `admin@staging.local` | SUPER_ADMIN | Mọi QA + tenant switch |
| `owner@staging.local` | VENUE_OWNER | Venue ops |
| `cashier@staging.local` | CASHIER | Booking |
| `player@staging.local` | PLAYER | `/profile`, `/403` |
| `referee@staging.local` | REFEREE | `/referee` session |
| `club@staging.local` | CLUB_OWNER | Giải / CLB |
| `owner@futurearena.local` | TENANT_OWNER (dev) | Tenant isolation |
| `owner@abc.local` | TENANT_OWNER (dev) | Tenant B |
| `owner@elite.local` | TENANT_OWNER (dev) | Tenant C |
| `manager@futurearena.local` | CLUB_MANAGER (dev) | Manager scope |

Dev users `*.local` hoạt động khi chưa cấu hình Supabase hoặc dev login panel.

---

## Automated gate (trước deploy Preview)

```bash
npm run build
npm test
```

**Kỳ vọng hiện tại:** build pass, 438+ tests pass.

---

## Go / No-Go v4.0 Preview

### Go

- [ ] SQL 1–9 không lỗi
- [ ] v3.5.8 QA pass
- [ ] Phase B QA pass (`/403`, users, profile, audit)
- [ ] Sprint 2 tenant isolation pass
- [ ] RBAC tắt local → màn cũ không đổi
- [ ] Legacy `/referee/:token` vẫn chấm được

### No-Go

- Cross-tenant data leak
- Password/token trong audit metadata
- PLAYER vào `/users`
- Build hoặc test fail trên branch deploy

---

## Sau v4.0 (Phase C — chưa làm)

- RLS server-side cho user management read/write
- Audit log read API cho admin
- Gỡ dần referee token-only
