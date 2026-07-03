# Phase 19A — Production SQL Apply Pack (V5.0 RC1)

**Ngày:** 2026-07-03  
**Branch:** `v5-platform-edition`  
**Preflight complete:** commit `5881f1e`  
**RC1 tag:** `v5.0.0-rc1` → commit `b0942be`  
**Môi trường:** Owner-review pack only — **không apply SQL trong Phase 19A**  
**Ràng buộc:** Không deploy Production; không pop stash `IntegrationSettingsPage.jsx`; không ghi secret/env value vào repo.

---

## Executive summary

| Hạng mục | Verdict |
|----------|---------|
| Apply pack document | ✅ **READY for owner review** |
| Production SQL applied | ⛔ **NONE** — owner must apply manually |
| Production deploy (Phase 19B) | ⛔ **NO-GO** until §Owner checklist complete |
| Stash `IntegrationSettingsPage.jsx` | ✅ **Intact** |

**Mục tiêu pack này:** Cung cấp kế hoạch apply an toàn, có thứ tự, có verify và rollback cho **22 migration** trên Supabase **Production** — owner review và phê duyệt trước khi chạy.

**Nguồn:** `docs/v5/PHASE_19A_PRODUCTION_PREFLIGHT.md`, `docs/v5/PHASE_18_PRODUCTION_READINESS.md`, `docs/SUPABASE-PRODUCTION-CHECKLIST.md`

---

## Trạng thái Production SQL (baseline)

| Batch | Migrations | Trạng thái hiện tại | Blocker? |
|-------|------------|---------------------|----------|
| **A** — GA baseline | #1–15 | **UNKNOWN** (owner verify từng bước) | **P0** nếu thiếu |
| **B** — Billing / platform | #16–21 | **NEEDS APPLY** | **P0** (#16–17 billing); P1 (#18–21 API OFF) |
| **C** — KN-6 RLS | #22 | **NEEDS APPLY** | **P0** (mobile QR) |

> **Lưu ý lịch sử:** `docs/GA-PRODUCTION-QA.md` (2026-07-01) ghi Auth + Court Engine PASS trên Production — một phần Tier A có thể đã tồn tại. **Không assume** đủ 15 bước; owner verify từng migration trước khi skip.

---

## Quy trình apply (owner)

1. Hoàn thành **Owner checklist** (cuối tài liệu) — backup + project ID trước khi chạy SQL đầu tiên.
2. Mở Supabase Dashboard → **Production project** → **SQL Editor**.
3. Chạy **một file mỗi lần**, đúng thứ tự #1 → #22.
4. Sau mỗi **batch** (A / B / C): chạy verify queries § tương ứng.
5. Tick migration trong bảng; đổi status → **CONFIRMED** + ghi ngày.
6. **Không** chạy `docs/supabase-staging-phase16-kn6-seed.sql` trên Production.

**Thời gian ước tính:** 45–90 phút (tùy partial apply Tier A).

---

## Batch A — Baseline GA SQL (#1–15)

**Khi nào chạy:** Luôn là batch đầu tiên. Phải hoàn tất (hoặc owner xác nhận đã có) trước Batch B.

**Cách chạy:** Supabase **Production** SQL Editor — copy toàn bộ file → Run.

| # | File | Mục đích | Idempotent? | Rollback |
|---|------|----------|-------------|----------|
| 1 | `docs/supabase-club-v3.sql` | Bảng `club_data_v3`, `club_ai_data`; RLS cơ bản | ✅ **Có** — `CREATE IF NOT EXISTS`, `DROP POLICY IF EXISTS` | — |
| 2 | `docs/supabase-rbac.sql` | `venues`, `profiles`, `subscriptions`, helpers RBAC | ✅ **Có** — `CREATE IF NOT EXISTS` | — |
| 3 | `docs/supabase-club-v3-rls.sql` | RLS `club_data_v3` theo venue/club | ✅ **Có** — `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` | `docs/supabase-rls-rollback.sql` |
| 4 | `docs/supabase-match-live.sql` | Bảng `tournament_match_live` | ✅ **Có** | — |
| 5 | `docs/supabase-match-live-rls.sql` | RLS match live + RPC referee token-scoped | ✅ **Có** — `CREATE OR REPLACE` RPC | — |
| 6 | `docs/supabase-security-hardening-v357.sql` | PLAYER signup guard, profile update guard | ✅ **Có** — `CREATE OR REPLACE` triggers/functions | — |
| 7 | `docs/supabase-match-live-v2.sql` | Cột `stage_label`, `audit_log` bổ sung | ✅ **Có** — `ADD COLUMN IF NOT EXISTS` | — |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | roles, permissions, audit_logs | ✅ **Có** — `ON CONFLICT DO NOTHING` seed | `docs/supabase-identity-v40-sprint1-rollback.sql` |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | audit columns, password_reset_tokens | ✅ **Có** — `ADD COLUMN IF NOT EXISTS` | `docs/supabase-identity-v40-phaseB-rollback.sql` |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | RPC identity + RLS venue admin | ✅ **Có** — `CREATE OR REPLACE` | `docs/supabase-identity-v40-phaseC-rollback.sql` |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | View `tenants`, mở rộng `venues.status` | ✅ **Có** — `CREATE OR REPLACE VIEW`, `DROP CONSTRAINT IF EXISTS` | `docs/supabase-multi-tenant-sprint2-rollback.sql` |
| 12 | `docs/supabase-subscription-sprint4.sql` | Plan starter/pro/enterprise, auto_renew columns | ✅ **Có** — `ADD COLUMN IF NOT EXISTS` | — |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | `ai_suggestions` + RLS (schema ready, flag OFF) | ✅ **Có** | — |
| 14 | `docs/supabase-mobile-sprint9.sql` | push, notifications, qr_tokens, checkins | ✅ **Có** — baseline Sprint 9 (KN-6 patch ở #22) | `docs/supabase-mobile-sprint9-rollback.sql` |
| 15 | `docs/supabase-sprint10.sql` | api_*, marketplace, payments, webhooks (`tenant_id text`) | ✅ **Có** — block `$fix_tenant_id$` idempotent | `docs/supabase-sprint10-rollback.sql` |

### Batch A — Owner tick

| # | Status | Owner tick | Ngày |
|---|--------|------------|------|
| 1 | UNKNOWN | ☐ | |
| 2 | UNKNOWN | ☐ | |
| 3 | UNKNOWN | ☐ | |
| 4 | UNKNOWN | ☐ | |
| 5 | UNKNOWN | ☐ | |
| 6 | UNKNOWN | ☐ | |
| 7 | UNKNOWN | ☐ | |
| 8 | UNKNOWN | ☐ | |
| 9 | UNKNOWN | ☐ | |
| 10 | UNKNOWN | ☐ | |
| 11 | UNKNOWN | ☐ | |
| 12 | UNKNOWN | ☐ | |
| 13 | UNKNOWN | ☐ | |
| 14 | UNKNOWN | ☐ | |
| 15 | UNKNOWN | ☐ | |

### Batch A — Post-apply verification

**Chạy trong Supabase SQL Editor (Production):**

#### A1. RLS enabled (`SUPABASE-PRODUCTION-CHECKLIST.md` § A)

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
  'profiles', 'venues', 'subscriptions', 'payment_events',
  'club_data_v3', 'tournament_match_live', 'audit_logs',
  'ai_suggestions', 'push_subscriptions', 'notifications',
  'qr_tokens', 'checkins', 'api_clients', 'api_keys'
)
order by tablename;
```

**Kỳ vọng:** `rls_enabled = true` cho mọi bảng.

#### A2. Bảng Sprint 7–10 tồn tại (§ B)

```sql
select tablename from pg_tables
where schemaname = 'public'
and tablename in (
  'ai_suggestions', 'push_subscriptions', 'notifications',
  'qr_tokens', 'checkins', 'api_clients', 'api_keys', 'api_logs',
  'marketplace_products', 'marketplace_orders', 'payment_transactions',
  'notification_logs', 'webhook_events'
)
order by tablename;
```

#### A3. Sprint 10 — `tenant_id` kiểu text (§ B2)

```sql
select c.table_name, c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'api_clients', 'api_keys', 'api_logs',
    'marketplace_products', 'marketplace_orders', 'payment_transactions',
    'notification_logs', 'webhook_events'
  )
  and c.column_name = 'tenant_id'
order by c.table_name;
```

**Kỳ vọng:** mọi dòng `data_type = 'text'`.

#### A4. RPC Identity & Referee (§ C)

```sql
select proname from pg_proc
where proname in (
  'referee_get_match_by_token',
  'referee_update_match_score',
  'identity_list_users',
  'identity_admin_update_user',
  'identity_list_audit_logs'
)
order by proname;
```

#### A5. View tenants + subscription columns (§ D, E)

```sql
select * from public.tenants limit 3;

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'subscriptions'
and column_name in ('auto_renew', 'locked_at', 'last_renewed_at');
```

### Batch A — Post-apply manual actions

- [ ] Replication bật: `tournament_match_live` (Dashboard → Database → Replication)
- [ ] SUPER_ADMIN bootstrap (nếu chưa có) — xem `SUPABASE-PRODUCTION-CHECKLIST.md` § Sau SQL
- [ ] Production venue + owner profile gán `venue_id`

### Batch A — Script verification (optional)

| Script | Scope | Production? |
|--------|-------|-------------|
| `scripts/verify-mobile-sprint9-staging.mjs` | Mobile tables | ⚠️ Chỉ sau khi owner đặt Production URL/key trong `.env.local` — script không có staging guard cứng |
| `scripts/verify-cross-tenant-rls-staging.mjs` | Cross-tenant RLS JWT | ⚠️ Có guard `STAGING_REF` — **không chạy trực tiếp**; dùng queries § A1–A5 hoặc tạo prod test accounts riêng |

---

## Batch B — Billing / Platform SQL (#16–21)

**Khi nào chạy:** Sau Batch A **CONFIRMED**. Trước khi bật `VITE_BILLING_SUPABASE=true` trên Vercel.

**Cách chạy:** Supabase **Production** SQL Editor — một file mỗi lần, thứ tự #16 → #21.

| # | File | Mục đích | Idempotent? | Rollback |
|---|------|----------|-------------|----------|
| 16 | `docs/supabase-billing-phase9.sql` | `plans`, `plan_limits`, `tenant_subscriptions`, invoices, payments, billing RLS | ✅ **Có** — `CREATE IF NOT EXISTS`, seed `ON CONFLICT DO NOTHING` | `docs/supabase-billing-phase9-rollback.sql` |
| 17 | `docs/supabase-billing-phase9-trial-rpc.sql` | RPC `billing_create_trial_subscription` (trial onboarding) | ✅ **Có** — `CREATE OR REPLACE`; RPC idempotent | `docs/supabase-billing-phase9-trial-rpc-rollback.sql` |
| 18 | `docs/supabase-sprint10-phase11a-rls.sql` | Sprint 10 RLS hardened + `webhook_endpoints` | ✅ **Có** — `DROP POLICY IF EXISTS`, FK guard blocks | `docs/supabase-sprint10-phase11a-rollback.sql` |
| 19 | `docs/supabase-sprint10-phase11b-persistence.sql` | `tenant_integration_settings`, `integration_audit_logs` | ✅ **Có** — `CREATE IF NOT EXISTS`, `$fk$` guards | `docs/supabase-sprint10-phase11b-rollback.sql` |
| 20 | `docs/supabase-sprint10-phase11c-api-key-guard.sql` | `api_keys.expires_at` + indexes | ✅ **Có** — `ADD COLUMN IF NOT EXISTS` | `docs/supabase-sprint10-phase11c-rollback.sql` |
| 21 | `docs/supabase-sprint10-phase11e-integration-audit.sql` | Integration audit persistence columns + RLS | ✅ **Có** — header "Idempotent migration" | `docs/supabase-sprint10-phase11e-rollback.sql` |

### Batch B — Owner tick

| # | Status | Owner tick | Ngày |
|---|--------|------------|------|
| 16 | NEEDS APPLY | ☐ | |
| 17 | NEEDS APPLY | ☐ | |
| 18 | NEEDS APPLY | ☐ | |
| 19 | NEEDS APPLY | ☐ | |
| 20 | NEEDS APPLY | ☐ | |
| 21 | NEEDS APPLY | ☐ | |

### Batch B — Post-apply verification

#### B1. Billing tables (Phase 18 §2.3)

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'plan_limits', 'tenant_subscriptions', 'invoices',
    'invoice_items', 'payments', 'billing_events', 'billing_audit_logs'
  )
order by table_name;
```

**Kỳ vọng:** 8 bảng billing tồn tại.

#### B2. Plan seed

```sql
select code, name, is_active from public.plans
where code in ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')
order by sort_order;
```

**Kỳ vọng:** 4 plan rows.

#### B3. Trial RPC exists

```sql
select proname, proargnames
from pg_proc
where proname = 'billing_create_trial_subscription';
```

#### B4. Phase 11 tables + RLS

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'webhook_endpoints', 'tenant_integration_settings', 'integration_audit_logs'
  )
order by tablename;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'api_keys'
  and column_name = 'expires_at';
```

#### B5. Integration audit columns (11E)

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'integration_audit_logs'
  and column_name in ('request_id', 'tenant_id', 'event_type', 'route', 'status_code')
order by column_name;
```

### Batch B — Script verification (optional, owner creds)

| Script | Verifies | Production notes |
|--------|----------|------------------|
| `scripts/verify-billing-phase9-staging.mjs` | Billing tables + plan seed + RLS | Đặt `VITE_SUPABASE_URL` / anon key → **Production** trong `.env.local`; optional `SUPABASE_SERVICE_ROLE_KEY` |
| `scripts/verify-billing-cross-tenant-staging.mjs` | Billing cross-tenant isolation | Cần prod test accounts A/B |
| `scripts/verify-phase11b-marketplace-rls-staging.mjs` | 11B persistence RLS | Staging-oriented; adapt creds |
| `scripts/verify-phase11c-api-key-guard-staging.mjs` | 11C schema + guard | Staging-oriented; adapt creds |
| `scripts/verify-phase11e-integration-audit-staging.mjs` | 11E audit persistence | Staging-oriented; adapt creds |

> **RC1:** `VITE_API_ENABLED=false` trên Production — Batch B schema vẫn cần apply; API runtime verify có thể defer.

### Batch B — Optional alignment (review only)

| File | Khi nào |
|------|---------|
| `docs/supabase-billing-phase10e-staging-tenant-align.sql` | Chỉ nếu tenant mapping lệch sau verify — **review trước prod** |

---

## Batch C — Phase 16 KN-6 RLS SQL (#22)

**Khi nào chạy:** Sau Batch B. **Bắt buộc** trước mobile QR traffic trên Production.

**Cách chạy:** Supabase **Production** SQL Editor — `docs/supabase-phase16-kn6-qr-checkins-rls.sql`

| # | File | Mục đích | Idempotent? | Rollback |
|---|------|----------|-------------|----------|
| 22 | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` | Tenant-scoped RLS cho `qr_tokens`, `checkins` — thay `USING (true)` | ✅ **Có** — `DROP POLICY IF EXISTS` + recreate | `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` |

### Batch C — Owner tick

| # | Status | Owner tick | Ngày |
|---|--------|------------|------|
| 22 | NEEDS APPLY | ☐ | |

### Batch C — Post-apply verification

#### C1. KN-6 policies — không còn `USING (true)` (Phase 18 §2.3)

```sql
select tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename, policyname;
```

**Kỳ vọng:**

- Policies dùng `tenant_id = user_venue_id()` hoặc `is_super_admin()`
- **Không** có `USING (true)` hoặc `WITH CHECK (true)` trên authenticated policies
- Không có anon policies (staff JWT required)

#### C2. Policy count smoke

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
group by tablename
order by tablename;
```

**Kỳ vọng:** 3 policies mỗi bảng (SELECT, INSERT, UPDATE).

### Batch C — Script verification (optional)

| Script | Verifies | Production notes |
|--------|----------|------------------|
| `scripts/verify-phase16-kn6-rls-staging.mjs` | JWT cross-tenant + anon block | **Có guard staging ref** — không chạy trực tiếp; owner tạo prod probe accounts hoặc dùng C1/C2 queries |
| `scripts/verify-cross-tenant-rls-staging.mjs` | Broader cross-tenant matrix | Staging guard — SQL Editor queries ưu tiên cho prod |

### Batch C — Không chạy trên Production

| File | Lý do |
|------|-------|
| `docs/supabase-staging-phase16-kn6-seed.sql` | Seed verify only — staging QA |

---

## SQL Editor vs script — tóm tắt

| Loại | Phương thức | Ghi chú |
|------|-------------|---------|
| **Apply migration (#1–22)** | ✅ **Bắt buộc Supabase SQL Editor** | Agent/CI không apply Production |
| **Verify schema (queries § A–C)** | ✅ **SQL Editor** | Owner chạy sau mỗi batch |
| **Verify scripts (`scripts/verify-*.mjs`)** | ⚠️ **Optional** — local terminal | Cần Production URL/key trong `.env.local`; nhiều script có staging guard |
| **Seed / destructive** | ⛔ **Không** trên Production | `supabase-staging-phase16-kn6-seed.sql`, staging seeds khác |

---

## Rollback inventory (Production)

Chỉ rollback **theo phạm vi lỗi** — không drop toàn DB. PITR restore là last resort.

| Phạm vi | Rollback file | Điều kiện |
|---------|---------------|-----------|
| KN-6 RLS (khẩn cấp mobile) | `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` | Cẩn thận prod — mở lại open policy |
| Billing Phase 9 | `docs/supabase-billing-phase9-rollback.sql` | Chưa có billing data quan trọng |
| Trial RPC | `docs/supabase-billing-phase9-trial-rpc-rollback.sql` | |
| Phase 11E / 11C / 11B / 11A | `docs/supabase-sprint10-phase11*-rollback.sql` | Tắt `VITE_API_ENABLED` trước |
| Sprint 10 tables | `docs/supabase-sprint10-rollback.sql` | |
| Mobile Sprint 9 | `docs/supabase-mobile-sprint9-rollback.sql` | Mất QR/push tables |
| Identity / multi-tenant | `docs/supabase-identity-*-rollback.sql`, `supabase-multi-tenant-sprint2-rollback.sql` | Last resort |
| Club RLS anon-open | `docs/supabase-rls-rollback.sql` | **Emergency only** |

**Sau rollback nghiêm trọng:** tạm `VITE_RBAC_ENABLED=false` → redeploy → khắc phục → bật lại.

**Vercel rollback:** Promote deployment trước V5 — xem `PHASE_18_PRODUCTION_READINESS.md` §3.2.

---

## Owner checklist (bắt buộc trước apply)

### Pre-apply gates

| # | Action | Owner | Tick | Ghi chú / timestamp |
|---|--------|-------|------|---------------------|
| P1 | **Backup completed** — Supabase Production snapshot / PITR confirmed | DevOps | ☐ | Timestamp: `________________` |
| P2 | **Production project ID confirmed** — khác staging | DevOps | ☐ | Project ref: `________________` |
| P3 | Maintenance window communicated (nếu live users) | Owner | ☐ | N/A nếu không có user |
| P4 | Rollback files § trên đã review | Owner | ☐ | |
| P5 | Git deploy target `v5.0.0-rc1` (`b0942be`) confirmed | DevOps | ☐ | |
| P6 | Vercel current Production deployment ID recorded | DevOps | ☐ | ID: `________________` |

### Per-batch approval

| Batch | Migrations | SQL batch approved | Owner signature | Ngày |
|-------|------------|-------------------|-----------------|------|
| **A** | #1–15 | ☐ | ________________ | ________ |
| **B** | #16–21 | ☐ | ________________ | ________ |
| **C** | #22 | ☐ | ________________ | ________ |

### Post-apply verification

| # | Verification | Owner | Tick | Ngày |
|---|--------------|-------|------|------|
| V1 | Batch A queries § A1–A5 pass | Owner | ☐ | |
| V2 | Batch A manual: Realtime + SUPER_ADMIN + venue | Owner | ☐ | |
| V3 | Batch B queries § B1–B5 pass | Owner | ☐ | |
| V4 | Batch C queries § C1–C2 pass (KN-6 hardened) | Owner | ☐ | |
| V5 | **Post-apply verification completed** — all batches | Owner | ☐ | |
| V6 | Production env updated per `PHASE_19A_PRODUCTION_PREFLIGHT.md` §1 | Owner | ☐ | |
| V7 | **Không** chạy staging seed trên Production | Owner | ☐ | |

### Final Go/No-Go (Phase 19B deploy)

| Decision | Tick one |
|----------|----------|
| ⛔ **NO-GO** — giữ Production hiện tại | ☐ |
| ✅ **GO** — tiến hành Phase 19B deploy `v5.0.0-rc1` | ☐ |

**Chỉ tick GO khi P1–P2 + per-batch approval + V1–V7 hoàn tất.**

**Owner signature:** ________________ **Date:** __________

---

## Idempotency guidance (owner)

Hầu hết migration dùng pattern additive (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING`).

| Tình huống | Hành động |
|------------|-----------|
| Migration đã apply trước đó | Chạy lại thường **an toàn** — verify query xác nhận state |
| Lỗi giữa chừng (partial apply) | Ghi lỗi + bước #; **không** skip — fix root cause rồi re-run cùng file |
| Bảng tồn tại nhưng thiếu policy/RPC | Re-run file tương ứng (idempotent) |
| Tier A UNKNOWN | Owner verify từng bước #1–15; skip chỉ khi query confirm đủ schema |

---

## Phase 19A automated gates (this session)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `git diff --check` | ✅ Clean | Exit 0 |
| `npm test` | ✅ **752/752 PASS** | 58 suites, 0 fail |
| `npm run build` | ✅ PASS | Vite 8.1.0 + PWA 182 precache entries |
| `npm run lint` | ✅ **0 errors** | 128 warnings `react-hooks/exhaustive-deps` (pre-existing) |
| Production SQL applied | ✅ **None** | Agent không apply |
| Production deploy | ✅ **None** | Phase 19A scope |
| Stash `IntegrationSettingsPage.jsx` | ✅ Intact | `stash@{0}: wip: IntegrationSettingsPage mockPayment toggle key fix` |

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/v5/PHASE_19A_PRODUCTION_PREFLIGHT.md` | Preflight ENV + SQL status |
| `docs/v5/PHASE_18_PRODUCTION_READINESS.md` | Readiness baseline, smoke plan |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | GA 15 bước + verify A–E |
| `docs/v5/PHASE_16_KN6_RLS_QA.md` | KN-6 policy spec |
| `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Env after SQL |
| `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md` | Phase 19B next |
