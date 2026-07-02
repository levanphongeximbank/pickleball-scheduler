# Phase 10D — Cross-tenant RLS Manual QA

**Ngày:** 2026-07-02  
**Cập nhật final:** 2026-07-02  
**Branch:** `v5-platform-edition` (post `c048008` RBAC billing, `ff7124d` Phase 10D docs)  
**Supabase staging:** `qyewbxjsiiyufanzcjcq`  
**Không deploy production**

## Final verdict

| Gate | Verdict |
|------|---------|
| **Phase 10D core cross-tenant RLS** | **PASS** |
| Owner A ↔ Owner B bidirectional isolation | **PASS** |
| PLAYER route/admin/billing/court-engine | **Blocked** (đúng spec) |
| Cross-tenant leak thực tế | **Không phát hiện** |
| Mobile policy hardening | **P2 accepted** — trước mobile production data |

**Automated JWT probe (2026-07-02):** `PASS=31` `PARTIAL=4` `FAIL=0` `BLOCKED=0`  
Script: `node scripts/verify-cross-tenant-rls-staging.mjs` (authenticated JWT only — không dùng `service_role` để kết luận RLS).

---

## Mục tiêu

Xác nhận **tenant isolation** với **authenticated JWT**:

- Tenant A không đọc/sửa dữ liệu Tenant B
- Tenant B không đọc/sửa dữ liệu Tenant A
- `PLAYER` không vào billing/admin/court-engine routes
- `COURT_OWNER` chỉ thấy venue của mình
- `SUPER_ADMIN` tách riêng — quyền global hợp lệ

**Mapping chuẩn (Phase 10E):**

```
profiles.venue_id = venues.id = tenant_subscriptions.tenant_id
```

---

## Users / roles đã test

| User | Role DB | venue_id | JWT verify | Ghi chú |
|------|---------|----------|------------|---------|
| `owner@staging.local` | `VENUE_OWNER` | `venue-staging-a` | ✅ | Tenant A |
| `owner-b@staging.local` | `VENUE_OWNER` | `venue-staging-b` | ✅ | Tenant B — Admin API staging setup |
| `player@staging.local` | `PLAYER` | `venue-staging-a` | ✅ | Route RBAC blocked |
| `manager@staging.local` | `VENUE_MANAGER` | `venue-staging-a` | ✅ | Reset staging (không trong matrix chính) |
| `admin@staging.local` | `SUPER_ADMIN` | null | ⏳ Skip | Password docs không khớp — không ảnh hưởng tenant isolation |

**Tenant A:** `venue-staging-a`  
**Tenant B:** `venue-staging-b`

---

## SQL / staging data đã apply

| SQL | Trạng thái |
|-----|------------|
| `docs/supabase-billing-phase10e-staging-tenant-align.sql` | ✅ Applied |
| `docs/supabase-staging-phase10d-tenant-b-seed.sql` | ✅ Applied (profile align Owner B) |

**Setup staging users:** thực hiện qua Admin API local (password trong `.env.local` only). **Không** commit helper script hoặc password.

### Re-run verify

```bash
# .env.local: VITE_SUPABASE_* + passwords staging (không commit)
STAGING_OWNER_A_PASSWORD=... \
STAGING_OWNER_B_PASSWORD=... \
STAGING_PLAYER_PASSWORD=... \
  node scripts/verify-cross-tenant-rls-staging.mjs
```

---

## Bảng kiểm tra RLS (authenticated JWT)

| Bảng | Owner A | Owner B | PLAYER | Ghi chú |
|------|---------|---------|--------|---------|
| `profiles` | **PASS** | **PASS** | **PASS** | A: 5 rows venue A; B: 1 row (self); PLAYER own scope |
| `venues` | **PASS** | **PASS** | **PASS** | Mỗi owner chỉ venue của mình |
| `tenant_subscriptions` | **PASS** | **PASS** | **PASS** | Bidirectional filter/insert blocked; PLAYER đọc cùng venue (P2) |
| `invoices` | **PASS** | **PASS** | **PASS** | 0 rows |
| `payments` | **PASS** | **PASS** | **PASS** | 0 rows |
| `billing_audit_logs` | **PASS** | **PASS** | **PASS** | Isolated per tenant |
| `billing_events` | **PASS** | **PASS** | **PASS** | Isolated |
| `club_data_v3` | **PASS** | **PASS** | **PASS** | 0 rows staging |
| `tournament_match_live` | **PASS** | **PASS** | **PASS** | 0 rows |
| `notifications` | **PASS** | **PASS** | **PASS** | own-user policy |
| `push_subscriptions` | **PASS** | **PASS** | **PASS** | own-user policy |
| `qr_tokens` | **PARTIAL** | **PARTIAL** | **PARTIAL** | `USING (true)` — 0 rows, no current leak |
| `checkins` | **PARTIAL** | **PARTIAL** | **PARTIAL** | `USING (true)` — 0 rows, no current leak |
| `audit_logs` | **PASS** | **PASS** | **PASS** | Venue-scoped |
| `ai_suggestions` | **PASS** | **PASS** | **PASS** | 0 rows |
| `plans` / `plan_limits` | **N/A** | — | — | Global catalog |
| `players` / `courts` / `clubs` / `tournaments` | **N/A** | — | — | Data trong `club_data_v3` blob |

---

## Write isolation (bidirectional)

| Thao tác | Owner A → B | Owner B → A |
|----------|-------------|-------------|
| `SELECT` tenant subscription khác venue | ✅ 0 rows | ✅ 0 rows |
| `INSERT tenant_subscriptions` venue khác | ✅ RLS blocked | ✅ RLS blocked |
| `SELECT venues` venue khác | ✅ 0 rows | ✅ 0 rows |

---

## Route RBAC (app layer)

| Route | Owner A | Owner B | PLAYER |
|-------|---------|---------|--------|
| `/billing` | ✅ | ✅ | ❌ blocked |
| `/admin/billing` | ❌ | ❌ | ❌ blocked |
| `/court-engine` | ✅ | ✅ | ❌ blocked |

---

## Browser QA

| Check | Kết quả |
|-------|---------|
| Login `owner@staging.local` + `/billing` | ✅ PASS (Phase 10E) |
| JWT automated matrix | ✅ PASS |
| Browser Owner B / PLAYER | ⏳ Optional manual — JWT đã PASS |

**Preview URL:** https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app

---

## Remaining P2 accepted risks

| ID | Mức | Mô tả | Khuyến nghị |
|----|-----|-------|-------------|
| 10D-1 | **P2** | `qr_tokens` RLS `USING (true)` — 0 rows staging, no current leak | Harden `tenant_id = user_venue_id()` trước mobile production data |
| 10D-2 | **P2** | `checkins` RLS `USING (true)` — tương tự | Cùng sprint mobile hardening |
| 10D-3 | **P2** | `tenant_subscriptions` readable by `PLAYER` within same venue via JWT; routes `/billing` vẫn blocked | Tuỳ chọn: tighten RLS by role nếu cần ẩn API subscription khỏi PLAYER |
| 10D-4 | **P2** | `tournament_match_live` `is_venue_staff()` không lọc `venue_id` | Regression khi có match data |

**Không có P0/P1 cross-tenant leak** trên billing/core tables đã có data.

---

## Kết luận production readiness

| Gate | Verdict |
|------|---------|
| Phase 10D core cross-tenant RLS | **PASS** |
| Phase 10E Billing QA | **PASS** |
| Mobile RLS hardening | **P2 backlog** |
| Production Go/No-Go tổng thể | Vẫn **NO-GO** theo `PHASE_10_RELEASE_AUDIT.md` (các gate khác) |

---

## Bước tiếp theo

1. ~~Seed Owner B + PLAYER JWT verify~~ ✅
2. **Phase 11** — Marketplace/API foundation (scope tiếp theo)
3. **P2 backlog** — harden `qr_tokens` / `checkins` RLS trước mobile production data
4. (Tuỳ chọn) Browser QA Owner B trên Preview

---

## Phạm vi không đụng

- ✅ Không sửa Billing / Court Engine runtime
- ✅ Không Marketplace/API production
- ✅ Không apply production SQL
- ✅ Kết luận RLS không dùng `service_role`
- ✅ Không commit `.env.local`, passwords, hoặc setup helper script
