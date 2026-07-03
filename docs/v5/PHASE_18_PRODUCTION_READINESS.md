# Phase 18 — Production Readiness (V5.0 RC1)

**Ngày:** 2026-07-03  
**Branch:** `v5-platform-edition`  
**RC1 tag:** `v5.0.0-rc1` → commit `b0942be`  
**Môi trường:** Chuẩn bị Production — **không deploy Production trong Phase 18**  
**Ràng buộc:** Không pop stash `IntegrationSettingsPage.jsx`; không ghi secret/env value vào tài liệu.

---

## Executive summary

| Hạng mục | Verdict |
|----------|---------|
| Phase 18 documentation | ✅ **COMPLETE** |
| Automated gates (Phase 18 session) | ✅ **PASS** |
| Production env audit | ⏳ **OWNER VERIFY** — checklist sẵn sàng |
| Production SQL readiness | ⛔ **NOT READY** — V5 migrations chưa xác nhận trên Production |
| Backup / rollback plan | ✅ **DOCUMENTED** |
| Production smoke test plan | ✅ **DOCUMENTED** |
| **Production deploy (Phase 19)** | ⛔ **NO-GO** |

**Go/No-Go recommendation:** ⛔ **NO-GO for Production deployment** until owner completes §1 env tick + §2 SQL apply + §3 backup + §5 P0 risks mitigated. Phase 18 **preparation GO** — proceed to owner-run checklist, then Phase 19.

---

## Phase 18 automated gates (2026-07-03)

| Gate | Kết quả | Evidence |
|------|---------|----------|
| `git diff --check` | ✅ Clean | Exit 0 |
| `npm test` | ✅ **752/752 PASS** | 58 suites, 0 fail |
| `npm run build` | ✅ PASS | Vite + PWA precache |
| `npm run lint` | ✅ **0 errors** | 128 warnings `react-hooks/exhaustive-deps` (pre-existing) |
| Stash `IntegrationSettingsPage.jsx` | ✅ Intact | `stash@{0}: wip: IntegrationSettingsPage mockPayment toggle key fix` |
| RC1 tag | ✅ Present | `v5.0.0-rc1` → `b0942be` |

---

## 1. Production environment audit

### 1.1 Scope

Vercel Dashboard → Project → **Settings → Environment Variables** → scope **Production**.  
So sánh với Preview/Staging (Phase 14A + Phase 12 env diff).

**Agent không có quyền đọc Vercel/Supabase dashboard** — mục dưới là checklist owner tick. Không ghi giá trị thật vào repo.

### 1.2 Required client env (Production RC1)

| Biến | Production RC1 | Preview/Staging (QA) | Bắt buộc | Ghi chú |
|------|----------------|----------------------|----------|---------|
| `VITE_SUPABASE_URL` | **Production project URL** | Staging project URL | ✅ | **Phải khác** staging — không lẫn project |
| `VITE_SUPABASE_ANON_KEY` | Production anon key | Staging anon key | ✅ | Public client key — OK trên Vercel |
| `VITE_RBAC_ENABLED` | **`true`** | `true` | ✅ | Deny-by-default; explicit trên Production |
| `VITE_SEED_DEMO` | **`false`** | `false` | ✅ | Không seed demo trên Production |
| `VITE_PAYMENT_MODE` | **`dev`** (RC1) | `dev` | ✅ | Mock/dev billing — **không** live gateway RC1 |
| `VITE_BILLING_SUPABASE` | **`true`** | `true` | ✅ | Sau SQL billing Phase 9 apply |
| `VITE_ENABLE_AI_ENGINE` | **`false`** | `false` | ✅ | Tab AI ẩn |
| `VITE_API_ENABLED` | **`false`** | `true` (11C–11E QA) | ✅ | API layer **OFF** trên Production RC1 |
| `VITE_MARKETPLACE_ENABLED` | **`false`** | `false` | ✅ | Marketplace ẩn |
| `VITE_PAYMENT_DEFAULT_PROVIDER` | `mock` | `mock` | Khuyến nghị | Không live VNPay/MoMo/Stripe |

### 1.3 Server-only env (Vercel Production — không expose client)

| Biến | Production RC1 | Preview | Ghi chú |
|------|----------------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Set **server only** | Staging service role | **Không** prefix `VITE_` |
| `API_KEY_STORE` | `memory` hoặc unset | `supabase` (11D QA) | Chỉ cần `supabase` khi `VITE_API_ENABLED=true` |
| `AUDIT_STORE` | `memory` hoặc unset | `supabase` (11E QA) | Cùng điều kiện API |

**RC1 Production:** API OFF → server stores có thể để mặc định memory. Khi bật API sau GA: set `API_KEY_STORE=supabase`, `AUDIT_STORE=supabase` + SQL 11C/11E.

### 1.4 Feature flags — unsafe / mock / placeholder (RC1 acceptable)

| Flag / setting | RC1 Production | Rủi ro | Action |
|----------------|----------------|--------|--------|
| `VITE_PAYMENT_MODE=dev` | ✅ Expected | Thanh toán mock — không thu tiền thật | OK cho RC1; document cho user |
| `VITE_PAYMENT_DEFAULT_PROVIDER=mock` | ✅ Expected | Provider giả | OK |
| `VITE_VNPAY_*` / `VITE_MOMO_*` / `VITE_STRIPE_*` | **OFF / empty** | Live gateway chưa QA | Giữ OFF |
| `VITE_STRIPE_LINK_*` | Empty | Redirect Stripe chưa config | OK với `dev` mode |
| `VITE_API_ENABLED=true` on Production | ⛔ **Unsafe** | Public API chưa harden cho prod traffic | Giữ **false** |
| Staging URL/key on Production scope | ⛔ **Critical** | Cross-env data leak | Owner verify — phải production project |
| `VITE_SEED_DEMO=true` | ⛔ **Unsafe** | Demo data trên prod | Phải `false` |
| Service role in `VITE_*` | ⛔ **Critical** | Secret leak to browser | Không bao giờ |

### 1.5 Mobile / PWA settings

| Kiểm tra | Production RC1 | Ghi chú |
|----------|------------------|---------|
| PWA manifest same origin | ⏳ Owner verify | `manifest.webmanifest` + icons |
| HTTPS | ⏳ Owner verify | Vercel default |
| Push notifications | Optional | Cần SQL mobile sprint9 + user consent |
| QR check-in | Cần SQL Phase 16 | RLS hardened trước mobile prod traffic |

**Không có env PWA riêng** — build Vite + `vite-plugin-pwa` dùng origin deploy.

### 1.6 Integration flags

| Flag | Production RC1 | Preview |
|------|----------------|---------|
| `VITE_MARKETPLACE_ENABLED` | `false` | `false` |
| `VITE_API_ENABLED` | `false` | `true` (QA) |
| `VITE_INTEGRATIONS_STORE_MODE` | unset / `local` | `supabase` khi configured |
| `VITE_INTEGRATIONS_SUPABASE` | unset hoặc `false` | optional |

Menu Tích hợp / Marketplace **ẩn** khi flags OFF. URL trực tiếp → thông báo "chưa bật", không white screen.

### 1.7 Env audit checklist (owner tick)

- [ ] Production scope dùng Supabase **production** project (khác staging)
- [ ] `VITE_RBAC_ENABLED=true`
- [ ] `VITE_SEED_DEMO=false`
- [ ] `VITE_BILLING_SUPABASE=true` (sau SQL billing)
- [ ] `VITE_API_ENABLED=false`
- [ ] `VITE_MARKETPLACE_ENABLED=false`
- [ ] `VITE_ENABLE_AI_ENGINE=false`
- [ ] `VITE_PAYMENT_MODE=dev` (hoặc `stripe` chỉ khi Payment Links sẵn sàng)
- [ ] Không có placeholder `YOUR_PROJECT` / `YOUR_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **không** trong client env
- [ ] Preview/Development **không** trỏ production Supabase
- [ ] **Redeploy** Production sau khi đổi env

**Tham chiếu:** `docs/GA-PRODUCTION-ENV-CHECKLIST.md`, `.env.production.example`, `.env.example`

### 1.8 Known Production state (historical)

| Nguồn | Ghi chú |
|-------|---------|
| `docs/GA-FINAL-AUDIT.md` (2026-07-01) | Vercel Production env + Supabase SQL 15 bước = **PENDING** |
| `docs/GA-PRODUCTION-QA.md` (2026-07-01) | Auth ✅ + Court Engine ✅ trên Production — implies partial prod stack tồn tại |
| V5 phases 9–16 | SQL/API/billing/KN-6 **chưa** documented as applied Production |

**Kết luận env:** Owner phải re-verify toàn bộ trước V5 deploy — không assume staging parity.

---

## 2. Production database readiness

### 2.1 SQL migration inventory (V5 RC1)

**Thứ tự bắt buộc** — additive, chạy trên Supabase **Production** SQL Editor.  
**Agent không apply SQL tự động.**

#### Tier A — GA core (15 bước)

Tham chiếu: `docs/SUPABASE-PRODUCTION-CHECKLIST.md`

| # | File | Mục đích | Rollback |
|---|------|----------|----------|
| 1 | `docs/supabase-club-v3.sql` | `club_data_v3` | — |
| 2 | `docs/supabase-rbac.sql` | venues, profiles, subscriptions | — |
| 3 | `docs/supabase-club-v3-rls.sql` | RLS club_data_v3 | `supabase-rls-rollback.sql` |
| 4 | `docs/supabase-match-live.sql` | tournament_match_live | — |
| 5 | `docs/supabase-match-live-rls.sql` | RLS + referee RPC | — |
| 6 | `docs/supabase-security-hardening-v357.sql` | Signup/profile guards | — |
| 7 | `docs/supabase-match-live-v2.sql` | Status columns (nếu áp dụng) | — |
| 8 | `docs/supabase-identity-v40-sprint1.sql` | roles/permissions/audit | `supabase-identity-v40-sprint1-rollback.sql` |
| 9 | `docs/supabase-identity-v40-phaseB.sql` | Phase B identity | `supabase-identity-v40-phaseB-rollback.sql` |
| 10 | `docs/supabase-identity-v40-phaseC.sql` | Phase C RPC | `supabase-identity-v40-phaseC-rollback.sql` |
| 11 | `docs/supabase-multi-tenant-sprint2.sql` | tenants view, venue status | `supabase-multi-tenant-sprint2-rollback.sql` |
| 12 | `docs/supabase-subscription-sprint4.sql` | Subscription plans | — |
| 13 | `docs/supabase-ai-assistant-sprint7.sql` | ai_suggestions (schema ready) | — |
| 14 | `docs/supabase-mobile-sprint9.sql` | push, qr_tokens, checkins | `supabase-mobile-sprint9-rollback.sql` |
| 15 | `docs/supabase-sprint10.sql` | API/marketplace tables | `supabase-sprint10-rollback.sql` |

#### Tier B — V5 commercial / platform (sau Tier A)

| # | File | Mục đích | Rollback |
|---|------|----------|----------|
| 16 | `docs/supabase-billing-phase9.sql` | plans, tenant_subscriptions, invoices, payments | `supabase-billing-phase9-rollback.sql` |
| 17 | `docs/supabase-billing-phase9-trial-rpc.sql` | RPC trial onboarding | `supabase-billing-phase9-trial-rpc-rollback.sql` |
| 18 | `docs/supabase-sprint10-phase11a-rls.sql` | Sprint 10 RLS + webhook_endpoints | `supabase-sprint10-phase11a-rollback.sql` |
| 19 | `docs/supabase-sprint10-phase11b-persistence.sql` | tenant_integration_settings, integration_audit_logs | `supabase-sprint10-phase11b-rollback.sql` |
| 20 | `docs/supabase-sprint10-phase11c-api-key-guard.sql` | API key guard schema | `supabase-sprint10-phase11c-rollback.sql` |
| 21 | `docs/supabase-sprint10-phase11e-integration-audit.sql` | Integration audit persistence | `docs/supabase-sprint10-phase11e-rollback.sql` |
| 22 | `docs/supabase-phase16-kn6-qr-checkins-rls.sql` | **KN-6** tenant-scoped QR/checkins RLS | `supabase-phase16-kn6-qr-checkins-rls-rollback.sql` |

**Không chạy trên Production:** `docs/supabase-staging-phase16-kn6-seed.sql` (seed verify only — staging).

**Optional alignment (nếu tenant mapping lệch):** `docs/supabase-billing-phase10e-staging-tenant-align.sql` — review trước khi apply prod.

### 2.2 Post-SQL — Realtime & Auth

- [ ] Replication: `tournament_match_live`
- [ ] SUPER_ADMIN bootstrap (nếu chưa có) — xem §2.4
- [ ] Production venue + owner profile gán `venue_id`

### 2.3 Verify schema (owner — sau apply)

Chạy queries trong `docs/SUPABASE-PRODUCTION-CHECKLIST.md` § Verify schema (A–E).

**V5 bổ sung:**

```sql
-- Billing tables (Phase 9)
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'plan_limits', 'tenant_subscriptions', 'invoices',
    'invoice_items', 'payments', 'billing_events', 'billing_audit_logs'
  )
order by table_name;

-- KN-6 policies (Phase 16) — không còn USING (true)
select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('qr_tokens', 'checkins')
order by tablename, policyname;
```

**Kỳ vọng KN-6:** policies dùng `tenant_id = user_venue_id()` hoặc `is_super_admin()` — **không** `USING (true)`.

**Staging verify scripts (chạy against Production chỉ khi owner có creds + approval):**

```bash
# Sau SQL + env — optional automated probes
node scripts/verify-billing-phase9-staging.mjs   # đổi URL/key → production
node scripts/verify-phase16-kn6-rls-staging.mjs
node scripts/verify-cross-tenant-rls-staging.mjs
```

### 2.4 Production SQL status matrix

| Migration | Staging | Production (xác nhận) | Blocker? |
|-----------|---------|-------------------------|----------|
| Tier A 1–15 | ✅ QA pass | ⏳ **UNKNOWN** — GA audit PENDING | **P0** nếu thiếu |
| billing-phase9 | ✅ Applied | ⏳ **NOT CONFIRMED** | **P0** |
| billing-trial-rpc | ✅ Applied | ⏳ **NOT CONFIRMED** | **P0** |
| phase11a-rls | ✅ Applied | ⏳ **NOT CONFIRMED** | P1 (API OFF) |
| phase11b-persistence | ✅ Applied | ⏳ **NOT CONFIRMED** | P1 |
| phase11c-api-key-guard | ✅ Applied | ⏳ **NOT CONFIRMED** | P1 |
| phase11e-integration-audit | ✅ Applied | ⏳ **NOT CONFIRMED** | P1 |
| phase16 KN-6 RLS | ✅ CLOSED | ⏳ **NOT CONFIRMED** | **P0** (mobile QR) |

**Không apply SQL tự động trong Phase 18.**

---

## 3. Backup and rollback plan

### 3.1 Pre-deploy backup requirement

| # | Action | Owner | Before deploy |
|---|--------|-------|---------------|
| B1 | Supabase Production **snapshot / PITR** confirm enabled | DevOps | ✅ Required |
| B2 | Note backup timestamp + project ref | DevOps | ✅ Required |
| B3 | Optional: export sample `profiles`, `venues`, `club_data_v3` | DevOps | Recommended |
| B4 | Vercel: note **current Production deployment ID** | DevOps | ✅ Required |
| B5 | Git: confirm deploy target **`v5.0.0-rc1`** (`b0942be`) | DevOps | ✅ Required |
| B6 | Maintenance window communicated (if live users) | Owner | If applicable |
| B7 | **Không** chạy seed destructive trên Production | All | ✅ Enforced |

### 3.2 Vercel production rollback

1. Vercel Dashboard → Project → **Deployments**
2. Chọn deployment **trước** V5 deploy → **⋯ → Promote to Production**
3. Hoặc redeploy prior git tag/commit từ branch stable
4. Verify `/login` + owner smoke (§4) trên rolled-back build
5. Ghi deployment ID rollback vào incident log

**Thời gian ước tính:** &lt; 5 phút (promote prior deployment).

### 3.3 Supabase SQL rollback

Chỉ rollback **theo phạm vi lỗi** — không drop toàn DB.

| Phạm vi | File rollback | Điều kiện |
|---------|---------------|-----------|
| KN-6 RLS (khẩn cấp mobile) | `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` | Chỉ dev/staging pattern — **cẩn thận prod** |
| Billing Phase 9 | `docs/supabase-billing-phase9-rollback.sql` | Chưa có billing data prod quan trọng |
| Sprint 10 API | `docs/supabase-sprint10-rollback.sql` | Tắt `VITE_API_ENABLED` trước |
| Phase 11E audit | `docs/supabase-sprint10-phase11e-rollback.sql` | |
| Phase 11C key guard | `docs/supabase-sprint10-phase11c-rollback.sql` | |
| Phase 11B persistence | `docs/supabase-sprint10-phase11b-rollback.sql` | |
| Phase 11A RLS | `docs/supabase-sprint10-phase11a-rollback.sql` | |
| Mobile Sprint 9 | `docs/supabase-mobile-sprint9-rollback.sql` | Mất QR/push tables |
| Identity / multi-tenant | `docs/supabase-identity-*-rollback.sql`, `supabase-multi-tenant-sprint2-rollback.sql` | Last resort |
| Club RLS anon-open | `docs/supabase-rls-rollback.sql` | **Emergency only** |

**Sau rollback nghiêm trọng:** tạm `VITE_RBAC_ENABLED=false` trên Vercel Production → redeploy → khắc phục → bật lại RBAC.

**PITR restore:** Supabase Dashboard → Database → Backups → restore to point-in-time (toàn project — dùng khi migration corrupt).

### 3.4 Feature flag rollback

Không cần redeploy code — đổi env Vercel Production + redeploy:

| Symptom | Flag change | Redeploy |
|---------|-------------|----------|
| API errors / unexpected public traffic | `VITE_API_ENABLED=false` | ✅ |
| Marketplace issues | `VITE_MARKETPLACE_ENABLED=false` | ✅ |
| Billing Supabase errors | `VITE_BILLING_SUPABASE=false` (fallback localStorage) | ✅ — **chỉ tạm** |
| RBAC lockout mass | `VITE_RBAC_ENABLED=false` | ✅ — **emergency** |
| AI tab issues | `VITE_ENABLE_AI_ENGINE=false` | ✅ |

### 3.5 Rollback files inventory

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

---

## 4. Production smoke test plan (post-deploy)

Chạy **ngay sau** Phase 19 deploy. Môi trường: Production URL + `VITE_RBAC_ENABLED=true` + SQL applied.

### 4.1 P0 smoke checklist

| # | Step | Role | Expected | Priority |
|---|------|------|----------|----------|
| S1 | Open `/login` | anon | Page renders; no Supabase config error | **P0** |
| S2 | Owner login | COURT_OWNER | Dashboard loads; no white screen | **P0** |
| S3 | Sidebar + topbar | COURT_OWNER | V5 menu groups visible; navigation works | **P0** |
| S4 | `/billing` | COURT_OWNER | Plan/trial visible; no `no_subscription` false error | **P0** |
| S5 | `/court-engine` | COURT_OWNER | Page loads; no white screen on direct URL | **P0** |
| S6 | Mobile viewport | COURT_OWNER | 375px width — layout usable; bottom nav if routed | **P0** |
| S7 | API health | anon | `GET /api/v1/health` → 503/feature_disabled **OK** when API OFF | **P0** |
| S8 | RLS sanity | PLAYER | `/court-engine` → 403; no cross-tenant data in UI | **P0** |
| S9 | Console | COURT_OWNER | No P0 console errors on login → dashboard flow | **P0** |
| S10 | Logout | COURT_OWNER | Redirect `/login`; protected routes blocked | P1 |

### 4.2 Extended smoke (Phase 19 — không chặn first 15 min)

| # | Step | Reference |
|---|------|-----------|
| S11 | 8-role matrix spot check | `docs/GA-PRODUCTION-QA.md` § B |
| S12 | Subscription gate expired | `docs/GA-PRODUCTION-QA.md` § I |
| S13 | PWA manifest 200 | `docs/GA-PRODUCTION-QA.md` § L |
| S14 | Referee RPC token flow | `docs/REFEREE-E2E.md` |
| S15 | Cross-tenant JWT probe | `scripts/verify-cross-tenant-rls-staging.mjs` (prod creds) |

### 4.3 Fail criteria (abort / rollback)

- White screen on `/login` or post-login dashboard → **rollback Vercel** + check env
- Owner sees other tenant data → **rollback** + disable RBAC emergency + SQL review
- Billing crash loop → `VITE_BILLING_SUPABASE=false` tạm + investigate
- P0 console error repeating on every navigation → capture HAR → rollback if user-facing

---

## 5. Risk register

| ID | Risk | Priority | Status | Mitigation |
|----|------|----------|--------|------------|
| R1 | Payment gateways live (VNPay/MoMo/Stripe) | **P2** | Accepted RC1 | `VITE_PAYMENT_MODE=dev`, providers OFF |
| R2 | Mobile device QA incomplete | **P1** | Open | Real device QR/PWA/drawer before heavy mobile traffic |
| R3 | SUPER_ADMIN credential gap | **P1** | Open | Bootstrap admin SQL; docs password mismatch (KN-3) |
| R4 | `IntegrationSettingsPage.jsx` in stash | **P2** | Accepted | Stash intact; pop only when owner requests |
| R5 | Lint 128 warnings (`react-hooks/exhaustive-deps`) | **P2** | Accepted | 0 errors; không block deploy |
| R6 | Production env mismatch (staging URL on prod) | **P0** | Open | §1.7 owner checklist |
| R7 | V5 SQL not applied on Production | **P0** | Open | §2 apply + verify before deploy |
| R8 | KN-6 RLS not on Production | **P0** | Open | Apply `phase16-kn6-qr-checkins-rls.sql` |
| R9 | `VITE_API_ENABLED=true` on Production | **P0** | Prevent | Keep false for RC1 |
| R10 | No production backup before migrate | **P0** | Open | §3.1 before Phase 19 |
| R11 | Billing without Phase 9 SQL | **P0** | Open | Apply billing SQL before `VITE_BILLING_SUPABASE=true` |
| R12 | Partial v4 Production QA (2026-07-01) | **P1** | Info | Re-run full V5 smoke; don't assume V5 parity |

---

## 6. Go / No-Go — Production deployment

### Phase 18 (this document)

| Criterion | Verdict |
|-----------|---------|
| Readiness report complete | ✅ |
| SQL/env checklist complete | ✅ |
| Backup/rollback documented | ✅ |
| Smoke test plan documented | ✅ |
| No Production deploy performed | ✅ |
| Stash intact | ✅ |

**Phase 18:** ✅ **GO** (preparation complete)

### Phase 19 — Production deploy

| Criterion | Required | Status |
|-----------|----------|--------|
| RC1 tag `v5.0.0-rc1` | ✅ | ✅ @ `b0942be` |
| Phase 15 P0 Preview QA | ✅ | ✅ PASS |
| Phase 16 KN-6 staging | ✅ | ✅ CLOSED |
| §1 Production env tick | ✅ | ⏳ Owner |
| §2 Tier A+B SQL on Production | ✅ | ⛔ Not confirmed |
| §3 Backup B1–B5 | ✅ | ⏳ Owner |
| §4 P0 smoke plan ready | ✅ | ✅ |
| §5 P0 risks closed | ✅ | ⛔ R6–R8, R10–R11 open |

**Production deployment:** ⛔ **NO-GO** — complete owner checklist §1 + §2 + §3, then Phase 19.

---

## 7. Next actions

1. **Owner:** Tick §1.7 env audit on Vercel Production
2. **Owner:** Backup Production Supabase (§3.1 B1–B2)
3. **Owner:** Apply Tier A + Tier B SQL in order (§2.1) — one maintenance window
4. **Owner:** Run verify queries §2.3
5. **Owner:** Set Production env per §1.2 → redeploy
6. **Phase 19:** Deploy `v5.0.0-rc1` → run §4 smoke → monitor 24h

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Env GA baseline |
| `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | SQL 15 bước + verify |
| `docs/GA-PRODUCTION-QA.md` | Full production QA matrix |
| `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` | Env diff + smoke baseline |
| `docs/v5/PHASE_16_KN6_RLS_QA.md` | KN-6 patch |
| `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md` | Phase 18–19 roadmap |
