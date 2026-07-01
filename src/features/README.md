# Features modules (parallel architecture — v3.5.1)

**Trạng thái:** Song song với `src/pages/` — **chưa** thay route production.

## Nguyên tắc

1. Code mới nằm ở đây; `pages/` giữ nguyên cho đến khi bạn duyệt chuyển import.
2. Không xóa / không move file cũ khi chưa có approval.
3. Chuyển route: sửa `src/router.jsx` **sau khi** `npm run build` + test pass với module mới.

## Module sẵn sàng (copy + tách)

| Module | Path | Thay thế (khi duyệt) |
|--------|------|---------------------|
| Director Mode | `tournament/director/` | `pages/tournament/TournamentDirectorMode.jsx` |
| Statistics | `statistics/` | `pages/Statistics.jsx` |
| Identity (v4) | `identity/` | Nguồn RBAC — `src/auth/` re-export |

## Module identity (v4.0)

- Source of truth: `src/features/identity/`
- Phase A + B: `src/features/identity/ARCHITECTURE.md`
- SQL: sprint1 + `docs/supabase-identity-v40-phaseB.sql`
- QA: `docs/STAGING-APPLY-QA-v40-phaseB.md`

## Module tenant (v4.0 Sprint 2)

- `src/features/tenant/` — guards, service, seed
- `TenantContext`, `TenantSwitcher`, `/admin/tenants`
- QA: `docs/MULTI-TENANT-SPRINT2-CHECKLIST.md`

## Module club (v4.0 Sprint 3)

- `src/features/club/` — `/clubs`, `/clubs/:clubId`

## Module subscription (v4.0 Sprint 4)

- `src/features/subscription/` — lifecycle, 4 gói, banner/gate
- QA: `docs/SUBSCRIPTION-SPRINT4-CHECKLIST.md`

## Module tournament-engine (v4.0 Sprint 5)

- `src/features/tournament-engine/` — Seed, Draw, Schedule, Courts, Time, Ranking
- Routes: `/tournaments/:id/engine` (+ seed, draw, schedule, courts, ranking, logs)
- ARCHITECTURE: `src/features/tournament-engine/ARCHITECTURE.md`

## Module integrations (v4.0 Sprint 10)

- `src/features/api/` — API v1, keys, logs (`invokeApi`)
- `src/features/marketplace/` — products, orders
- `src/features/payments/` — PaymentProvider (mock, vnpay, momo, stripe)
- `src/features/notifications/` — email, sms, zalo adapters
- `src/features/integrations/` — settings, webhooks, feature flags
- ARCHITECTURE: `src/features/integrations/ARCHITECTURE.md`
- SQL: `docs/supabase-sprint10.sql`
- OpenAPI: `docs/openapi.yaml`

## Module court-engine (v4.0 Sprint 6)

- `src/features/court-engine/` — check-in, queue, auto assignment, timer, transfer, referee dispatch
- Route `/court-engine` — UI điều phối sân (localStorage per club)
- QA: `src/features/court-engine/ARCHITECTURE.md`

## Chưa làm

- `features/league/`, `court-management/`, `scheduler/`
- Archive `legacy/` — chỉ đánh dấu cleanup, không xóa `pages/Tournament.jsx`
