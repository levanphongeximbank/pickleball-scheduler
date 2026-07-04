# Phase 19A — Production Preflight (V5.0 RC1)

**Ngày:** 2026-07-03 (cập nhật trạng thái 2026-07-04)  
**Branch:** `v5-platform-edition`  
**RC1 tag:** `v5.0.0-rc1` → commit `b0942be`  
**Phase 18 complete:** commit `2a8ea60`  
**Môi trường:** Preflight + owner SQL apply — **không deploy Production app (Phase 19B)**  
**Ràng buộc:** Không pop stash `IntegrationSettingsPage.jsx`; không ghi secret/env value vào tài liệu; không apply SQL trừ khi owner phê duyệt rõ ràng; **không tag release mới**.

---

## Supabase project registry

| Môi trường | Tên project | Project ref | Supabase URL |
|------------|-------------|-------------|--------------|
| **Staging** | `pickleball-scheduler-stagin` | `qyewbxjsiiyufanzcjcq` | `https://qyewbxjsiiyufanzcjcq.supabase.co` |
| **Production** (mới tạo 2026-07-04) | `pickleball-scheduler-production` | `expuvcohlcjzvrrauvud` | `https://expuvcohlcjzvrrauvud.supabase.co` |

**Owner confirmed (2026-07-04):** Production ref `expuvcohlcjzvrrauvud` **khác** staging `qyewbxjsiiyufanzcjcq`. Chỉ chạy SQL trên project **Production**.

### Backup status (owner confirmed 2026-07-04)

| Hạng mục | Trạng thái |
|----------|------------|
| Supabase plan | **Free / Nano** |
| Dashboard → Database → Backups | **Không có backup hiển thị** |
| Production DB | **Trống** — project mới tạo, chưa apply migration |
| Baseline trước Migration #1 | Empty schema (không có dữ liệu production cần restore) |
| PITR / scheduled snapshot | **Không có** trên Free/Nano — không ghi timestamp backup |

> **Lịch sử:** Trước 2026-07-04 chỉ có **một** Supabase project (staging). Mọi QA trên `qyewbxjsiiyufanzcjcq` **không** được coi là Production SQL đã apply. Production DB mới = **trống** — Batch A bắt đầu lại từ Migration **#1**.

---

## Executive summary

| Hạng mục | Verdict |
|----------|---------|
| Phase 19A documentation | ✅ **COMPLETE** |
| Automated gates (Phase 19A session) | ✅ **PASS** |
| Production Supabase project | ✅ **CONFIRMED** (2026-07-04) — `pickleball-scheduler-production` / `expuvcohlcjzvrrauvud` |
| Production ENV verification | ⏳ **OWNER VERIFY** (trỏ env sang project Production mới) |
| Production SQL (22 migrations) | ⏳ **NOT STARTED** — Batch A **#1–15 NEEDS APPLY** trên project mới |
| Backup preflight | ✅ **CONFIRMED** (2026-07-04) — Free/Nano; không backup hiển thị; DB trống = baseline empty trước #1 |
| Stash `IntegrationSettingsPage.jsx` | ✅ **Intact** |
| **Production deploy (Phase 19B)** | ⛔ **NO-GO** |

**Go/No-Go recommendation:** ⛔ **NO-GO for Production deployment** until owner completes §1 ENV + §2 SQL + §3 Backup B4–B6 + §5 manual confirmations. Phase 19A preflight **backup + project confirmed**; SQL apply **NOT STARTED** — owner chạy Batch A từ #1 khi sẵn sàng; **không deploy app**.

---

## Phase 19A automated gates (2026-07-03)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `git diff --check` | ✅ Clean | Exit 0 |
| `npm test` | ✅ **752/752 PASS** | 58 suites, 0 fail |
| `npm run build` | ✅ PASS | Vite 8.1.0 + PWA 182 precache entries |
| `npm run lint` | ✅ **0 errors** | 128 warnings `react-hooks/exhaustive-deps` (pre-existing) |
| Stash `IntegrationSettingsPage.jsx` | ✅ Intact | `stash@{0}: wip: IntegrationSettingsPage mockPayment toggle key fix` |
| RC1 tag | ✅ Present | `v5.0.0-rc1` → `b0942be` |
| Production deploy performed | ✅ **None** | Phase 19A scope |
| Production SQL applied | ✅ **None** | Agent không apply |

---

## 1. Production ENV checklist (owner verification)

**Nguồn:** `docs/v5/PHASE_18_PRODUCTION_READINESS.md` §1.7  
**Vị trí:** Vercel Dashboard → Project → **Settings → Environment Variables** → scope **Production**.

> Agent không có quyền đọc Vercel dashboard. Owner tick từng mục và ghi ngày xác nhận. **Không** ghi giá trị thật vào repo.

### 1.1 Required Production values (RC1)

| # | Biến | Giá trị RC1 Production | Owner tick | Ngày |
|---|------|--------------------------|------------|------|
| E1 | `VITE_SUPABASE_URL` | **Production** project URL (khác staging) | ☐ | |
| E2 | `VITE_SUPABASE_ANON_KEY` | **Production** anon key (khác staging) | ☐ | |
| E3 | `VITE_RBAC_ENABLED` | **`true`** | ☐ | |
| E4 | `VITE_SEED_DEMO` | **`false`** | ☐ | |
| E5 | `VITE_BILLING_SUPABASE` | **`true`** (sau SQL billing #16–17) | ☐ | |
| E6 | `VITE_PAYMENT_MODE` | **`dev`** | ☐ | |

### 1.2 Must remain OFF for RC1

| # | Biến / setting | Giá trị RC1 | Owner tick | Ngày |
|---|----------------|-------------|------------|------|
| E7 | `VITE_API_ENABLED` | **`false`** | ☐ | |
| E8 | `VITE_MARKETPLACE_ENABLED` | **`false`** | ☐ | |
| E9 | `VITE_ENABLE_AI_ENGINE` | **`false`** | ☐ | |
| E10 | `VITE_VNPAY_*` / `VITE_MOMO_*` / `VITE_STRIPE_*` | **OFF / empty** | ☐ | |
| E11 | `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` (khuyến nghị) | ☐ | |

### 1.3 Server-only env (không expose client)

| # | Biến | RC1 Production | Owner tick | Ngày |
|---|------|----------------|------------|------|
| E12 | `SUPABASE_SERVICE_ROLE_KEY` | Set server-only — **không** prefix `VITE_` | ☐ | |
| E13 | `API_KEY_STORE` | `memory` hoặc unset (API OFF) | ☐ | |
| E14 | `AUDIT_STORE` | `memory` hoặc unset (API OFF) | ☐ | |

### 1.4 Cross-environment safety

| # | Kiểm tra | Owner tick | Ngày |
|---|----------|------------|------|
| E15 | Production scope **không** trỏ staging Supabase URL/key | ☐ | |
| E16 | Preview/Development **không** trỏ production Supabase | ☐ | |
| E17 | Không có placeholder `YOUR_PROJECT` / `YOUR_ANON_KEY` | ☐ | |
| E18 | **Redeploy** Production sau khi đổi env | ☐ | |

### 1.5 Integration / mobile (RC1)

| # | Kiểm tra | RC1 | Owner tick | Ngày |
|---|----------|-----|------------|------|
| E19 | `VITE_INTEGRATIONS_STORE_MODE` | unset / `local` | ☐ | |
| E20 | `VITE_INTEGRATIONS_SUPABASE` | unset hoặc `false` | ☐ | |
| E21 | PWA manifest + HTTPS trên production domain | Owner verify | ☐ | |

**Tham chiếu:** `docs/GA-PRODUCTION-ENV-CHECKLIST.md`, `.env.production.example`, `docs/v5/PHASE_18_PRODUCTION_READINESS.md` §1.2–§1.6

---

## 2. Production SQL preflight (22 migrations)

**Nguồn:** `docs/v5/PHASE_18_PRODUCTION_READINESS.md` §2.1  
**Thực hiện:** Supabase **Production** SQL Editor — **một migration mỗi lần**, đúng thứ tự.  
**Agent không apply SQL.** Chỉ owner apply sau phê duyệt rõ ràng.

**Trạng thái:**

| Status | Ý nghĩa |
|--------|---------|
| **CONFIRMED** | Owner xác nhận đã apply trên Production |
| **NEEDS APPLY** | Chưa xác nhận trên Production; bắt buộc trước V5 deploy |
| **UNKNOWN** | Agent không có quyền kiểm tra DB — owner phải verify |

**Ghi chú lịch sử:** Trước 2026-07-04 không có Supabase Production riêng — chỉ staging `qyewbxjsiiyufanzcjcq`. `docs/GA-PRODUCTION-QA.md` (2026-07-01) **không** chứng minh SQL trên Production DB mới. **Coi Production DB = trống;** apply đủ 22 migration theo thứ tự.

### Tier A — GA core (15 bước) — Batch A restart trên Production mới

| # | File | Mục đích | Rollback | Status | Owner tick | Ngày |
|---|------|----------|----------|--------|------------|------|
| 1 | `docs/supabase-club-v3.sql` | `club_data_v3` | — | **NEEDS APPLY** | ☐ | |
| 2 | `docs/supabase-rbac.sql` | venues, profiles, subscriptions | — | **NEEDS APPLY** | ☐ | |
| 3 | `docs/supabase-club-v3-rls.sql` | RLS club_data_v3 | `supabase-rls-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 4 | `docs/supabase-match-live.sql` | tournament_match_live | — | **NEEDS APPLY** | ☐ | |
| 5 | `docs/supabase-match-live-rls.sql` | RLS + referee RPC | — | **NEEDS APPLY** | ☐ | |
| 6 | `docs/supabase-security-hardening-v357.sql` | Signup/profile guards | — | **NEEDS APPLY** | ☐ | |
| 7 | `docs/supabase-match-live-v2.sql` | Status columns (nếu áp dụng) | — | **NEEDS APPLY** | ☐ | |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | roles/permissions/audit | `supabase-identity-v40-sprint1-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | Phase B identity | `supabase-identity-v40-phaseB-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | Phase C RPC | `supabase-identity-v40-phaseC-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | tenants view, venue status | `supabase-multi-tenant-sprint2-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 12 | `docs/supabase-subscription-sprint4.sql` | Subscription plans | — | **NEEDS APPLY** | ☐ | |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | ai_suggestions (schema ready) | — | **NEEDS APPLY** | ☐ | |
| 14 | `docs/supabase-mobile-sprint9.sql` | push, qr_tokens, checkins | `supabase-mobile-sprint9-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 15 | `docs/supabase-sprint10.sql` | API/marketplace tables | `supabase-sprint10-rollback.sql` | **NEEDS APPLY** | ☐ | |

### Tier B — V5 commercial / platform (sau Tier A)

| # | File | Mục đích | Rollback | Status | Owner tick | Ngày |
|---|------|----------|----------|--------|------------|------|
| 16 | `docs/supabase-billing-phase9.sql` | plans, tenant_subscriptions, invoices, payments | `supabase-billing-phase9-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 17 | `docs/supabase-billing-phase9-trial-rpc.sql` | RPC trial onboarding | `supabase-billing-phase9-trial-rpc-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 18 | `docs/supabase-sprint10-phase11a-rls.sql` | Sprint 10 RLS + webhook_endpoints | `supabase-sprint10-phase11a-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 19 | `docs/supabase-sprint10-phase11b-persistence.sql` | tenant_integration_settings, integration_audit_logs | `supabase-sprint10-phase11b-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 20 | `docs/supabase-sprint10-phase11c-api-key-guard.sql` | API key guard schema | `supabase-sprint10-phase11c-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 21 | `docs/supabase-sprint10-phase11e-integration-audit.sql` | Integration audit persistence | `docs/supabase-sprint10-phase11e-rollback.sql` | **NEEDS APPLY** | ☐ | |
| 22 | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` | **KN-6** tenant-scoped QR/checkins RLS | `supabase-phase16-kn6-qr-checkins-rls-rollback.sql` | **NEEDS APPLY** | ☐ | |

### Không chạy trên Production

| File | Lý do |
|------|-------|
| `docs/supabase-staging-phase16-kn6-seed.sql` | Seed verify only — staging |

### Optional (review trước prod)

| File | Khi nào |
|------|---------|
| `docs/supabase-billing-phase10e-staging-tenant-align.sql` | Nếu tenant mapping lệch |

### Post-SQL owner actions

- [ ] Replication bật: `tournament_match_live`
- [ ] SUPER_ADMIN bootstrap (nếu chưa có)
- [ ] Production venue + owner profile gán `venue_id`
- [ ] Verify schema queries — `docs/SUPABASE-PRODUCTION-CHECKLIST.md` § Verify schema (A–E)
- [ ] V5 billing tables query (Phase 18 §2.3)
- [ ] KN-6 policies query — **không** `USING (true)` trên `qr_tokens` / `checkins`

---

## 3. Backup preflight (owner checklist)

**Nguồn:** `docs/v5/PHASE_18_PRODUCTION_READINESS.md` §3.1–§3.5  
**Thực hiện trước** Phase 19B deploy hoặc SQL apply.

**Owner confirmed (2026-07-04):** Project `pickleball-scheduler-production` (`expuvcohlcjzvrrauvud`) trên plan **Free/Nano**. Dashboard **Backups** không hiển thị backup nào. DB **trống** — baseline trước Migration #1 = empty schema. PITR/snapshot **không khả dụng** trên plan hiện tại; rollback dựa vào scoped SQL files §3.2 (không drop toàn DB).

### 3.1 Pre-deploy backup

| # | Action | Owner | Tick | Ghi chú / timestamp |
|---|--------|-------|------|------------------------|
| B1 | Supabase Production **snapshot / PITR** confirm enabled | DevOps | ☑ | **N/A** — Free/Nano; không backup/PITR hiển thị (2026-07-04) |
| B2 | **Backup timestamp** recorded | DevOps | ☑ | **N/A** — DB trống; baseline = empty project trước #1 (2026-07-04) |
| B3 | Supabase **project ref** recorded — **khác** staging `qyewbxjsiiyufanzcjcq` | DevOps | ☑ | Production ref: `expuvcohlcjzvrrauvud` (2026-07-04) |
| B4 | Optional: export sample `profiles`, `venues`, `club_data_v3` | DevOps | ☐ | |
| B5 | Vercel **current Production deployment ID** recorded | DevOps | ☐ | Ghi: `________________` |
| B6 | Git deploy target **`v5.0.0-rc1`** (`b0942be`) confirmed | DevOps | ☐ | |
| B7 | Maintenance window communicated (if live users) | Owner | ☐ | N/A nếu không có user |
| B8 | **Không** chạy seed destructive trên Production | All | ☐ | Enforced |

### 3.2 Rollback files confirmed (repo)

| File | Exists |
|------|--------|
| `docs/supabase-rls-rollback.sql` | ✅ |
| `docs/supabase-identity-v40-sprint1-rollback.sql` | ✅ |
| `docs/supabase-identity-v40-phaseB-rollback.sql` | ✅ |
| `docs/supabase-identity-v40-phaseC-rollback.sql` | ✅ |
| `docs/supabase-multi-tenant-sprint2-rollback.sql` | ✅ |
| `docs/supabase-mobile-sprint9-rollback.sql` | ✅ |
| `docs/supabase-sprint10-rollback.sql` | ✅ |
| `docs/supabase-billing-phase9-rollback.sql` | ✅ |
| `docs/supabase-billing-phase9-trial-rpc-rollback.sql` | ✅ |
| `docs/supabase-sprint10-phase11a-rollback.sql` | ✅ |
| `docs/supabase-sprint10-phase11b-rollback.sql` | ✅ |
| `docs/supabase-sprint10-phase11c-rollback.sql` | ✅ |
| `docs/supabase-sprint10-phase11e-rollback.sql` | ✅ |
| `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` | ✅ |

**Vercel rollback:** Promote prior deployment (§3.2 Phase 18). **SQL rollback:** scoped files only — không drop toàn DB.

---

## 4. Go / No-Go decision table

### Phase 19A (this document)

| Criterion | Required | Status |
|-----------|----------|--------|
| Preflight document complete | ✅ | ✅ |
| Automated gates pass | ✅ | ✅ |
| ENV checklist prepared | ✅ | ✅ |
| SQL checklist (22 items) prepared | ✅ | ✅ |
| Backup checklist prepared | ✅ | ✅ |
| No Production deploy | ✅ | ✅ |
| No Production SQL applied by agent | ✅ | ✅ |
| Stash intact | ✅ | ✅ |
| No app code changes | ✅ | ✅ |

**Phase 19A:** ✅ **GO** (preflight complete)

### Phase 19B — Production deploy

| Criterion | Required | Status |
|-----------|----------|--------|
| RC1 tag `v5.0.0-rc1` @ `b0942be` | ✅ | ✅ |
| Phase 15 P0 Preview QA | ✅ | ✅ PASS |
| Phase 16 KN-6 staging | ✅ | ✅ CLOSED |
| §1 ENV E1–E21 owner tick | ✅ | ⏳ **Pending** |
| §2 SQL 1–22 owner CONFIRMED | ✅ | ⏳ **Not started** — Batch A #1–15 NEEDS APPLY (Production DB mới) |
| §3 Backup B1–B3 | ✅ | ✅ **Confirmed** (Free/Nano; empty DB baseline) |
| §3 Backup B4–B6 | ✅ | ⏳ **Pending** |
| §4 P0 smoke plan ready | ✅ | ✅ (`PHASE_18` §4) |
| P0 risks R6–R8, R10–R11 closed | ✅ | ⛔ **Open** |

**Production deployment (Phase 19B):** ⛔ **NO-GO**

---

## 5. Owner manual confirmations before Phase 19B

Owner phải **tick và ký xác nhận** (tên + ngày) trước khi agent/team tiến hành Phase 19B deploy.

### 5.1 Environment (bắt buộc)

- [ ] **E1–E2:** `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trỏ **Production** Supabase — không lẫn staging
- [ ] **E3–E6:** `VITE_RBAC_ENABLED=true`, `VITE_SEED_DEMO=false`, `VITE_BILLING_SUPABASE=true`, `VITE_PAYMENT_MODE=dev`
- [ ] **E7–E11:** `VITE_API_ENABLED=false`, `VITE_MARKETPLACE_ENABLED=false`, `VITE_ENABLE_AI_ENGINE=false`, live payment gateways OFF
- [ ] **E12–E14:** Service role server-only; API/Audit stores mặc định khi API OFF
- [ ] **E15–E18:** Cross-env safety + redeploy sau đổi env

**Owner signature:** ________________ **Date:** __________

### 5.2 Database (bắt buộc)

- [ ] Đã review và apply (hoặc xác nhận đã có) **cả 22** migration §2 theo đúng thứ tự
- [ ] Mỗi migration Tier A đổi status từ UNKNOWN → **CONFIRMED** sau verify
- [ ] Mỗi migration Tier B đổi status từ NEEDS APPLY → **CONFIRMED** sau apply
- [ ] Post-SQL verify queries pass (billing tables + KN-6 policies)
- [ ] **Không** chạy `supabase-staging-phase16-kn6-seed.sql` trên Production

**Owner signature:** ________________ **Date:** __________

### 5.3 Backup (bắt buộc)

- [x] **B1–B2:** Supabase backup/PITR + timestamp — **N/A** Free/Nano; không backup hiển thị; DB trống = baseline empty (2026-07-04)
- [x] **B3:** Production ref `expuvcohlcjzvrrauvud` ≠ staging `qyewbxjsiiyufanzcjcq` (2026-07-04)
- [ ] **B5:** Vercel Production deployment ID hiện tại ghi nhận (rollback target)
- [ ] **B6:** Deploy target = tag `v5.0.0-rc1` (`b0942be`)
- [ ] Rollback files §3.2 đã review

**Owner signature:** ________________ **Date:** __________

### 5.4 Operational (khuyến nghị)

- [ ] Maintenance window (nếu có user live)
- [ ] SUPER_ADMIN credential sẵn sàng (risk R3)
- [ ] Smoke tester có account COURT_OWNER + PLAYER trên Production
- [ ] Stash `IntegrationSettingsPage.jsx` — **không pop** trừ khi owner yêu cầu riêng

**Owner signature:** ________________ **Date:** __________

### 5.5 Final Go/No-Go (Phase 19B)

| Decision | Tick one |
|----------|----------|
| ⛔ **NO-GO** — giữ Production hiện tại | ☐ |
| ✅ **GO** — tiến hành Phase 19B deploy `v5.0.0-rc1` | ☐ |

**Chỉ tick GO khi §5.1 + §5.2 + §5.3 hoàn tất.**

**Owner signature:** ________________ **Date:** __________

---

## 6. Next actions

1. ~~**Owner:** Điền Supabase project registry~~ ✅ **Done** (2026-07-04)
2. ~~**Owner:** Xác nhận backup status Production~~ ✅ **Done** (2026-07-04) — Free/Nano; không backup hiển thị; DB trống
3. **Owner:** Apply Batch A §2 — **một migration mỗi lần** #1 → #15 trên project Production (không staging) — **chưa apply**
4. **Owner:** Sau Batch A: verify queries `PHASE_19A_PRODUCTION_SQL_APPLY_PACK.md` § A1–A5
5. **Owner:** Hoàn thành §1 ENV checklist trên Vercel (trỏ sang Production Supabase mới) — **chưa redeploy app**
6. **Owner:** Batch B (#16–21) + Batch C (#22) sau khi Batch A **CONFIRMED**
7. **Owner:** Ký §5 manual confirmations
8. **Phase 19B (sau):** Deploy `v5.0.0-rc1` → smoke `PHASE_18` §4 → monitor 24h — **⛔ chưa thực hiện**

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/v5/PHASE_18_PRODUCTION_READINESS.md` | Phase 18 baseline (§1.7, §2.1, §3) |
| `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Env GA baseline |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | SQL 15 bước + verify |
| `docs/GA-PRODUCTION-QA.md` | Production QA matrix |
| `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` | Env diff + smoke baseline |
| `docs/v5/PHASE_16_KN6_RLS_QA.md` | KN-6 patch |
| `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md` | Phase 18–19 roadmap |
