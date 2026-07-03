# Phase 16 — KN-6 RLS Hardening (qr_tokens / checkins)

**Ngày:** 2026-07-03  
**Branch:** `v5-platform-edition`  
**Supabase staging:** `qyewbxjsiiyufanzcjcq`  
**Không deploy production · Không tag v5.0.0-rc1**

## Final verdict

| Gate | Verdict |
|------|---------|
| **KN-6 closed** | ✅ **CLOSED** (sau apply SQL staging + verify PASS) |
| `qr_tokens` tenant isolation | ✅ Policy `tenant_id = user_venue_id()` |
| `checkins` tenant isolation | ✅ Policy `tenant_id = user_venue_id()` |
| Cross-tenant read/write | ✅ Blocked (JWT probe) |
| Anon access | ✅ Blocked (no anon policies) |
| Public QR token flow | ✅ Authenticated staff JWT — không cần anon |
| Preview P0 regression | ✅ Không đổi route — F3 unit PASS |

---

## Mục tiêu

Đóng **KN-6**: thay `USING (true)` trên `qr_tokens` và `checkins` bằng tenant-scoped RLS cho V5 SaaS multi-tenant.

**Mapping tenant (Phase 10E):**

```
profiles.venue_id = venues.id = qr_tokens.tenant_id = checkins.tenant_id
```

---

## SQL / policy changes

| File | Mục đích |
|------|----------|
| `docs/supabase-phase16-kn6-qr-checkins-rls.sql` | **Patch chính** — apply trên staging/production |
| `docs/supabase-phase16-kn6-qr-checkins-rls-rollback.sql` | Rollback về Sprint 9 open policy (dev only) |
| `docs/supabase-staging-phase16-kn6-seed.sql` | Seed cross-tenant rows cho JWT verify |
| `docs/supabase-mobile-sprint9.sql` | Cập nhật baseline (fresh install đã hardened) |

### Policy summary

| Bảng | Operation | Policy | Expression |
|------|-----------|--------|------------|
| `qr_tokens` | SELECT | `qr_tokens_select` | `is_super_admin() OR tenant_id = user_venue_id()` |
| `qr_tokens` | INSERT | `qr_tokens_insert` | `WITH CHECK` cùng expression |
| `qr_tokens` | UPDATE | `qr_tokens_update` | `USING` + `WITH CHECK` cùng expression |
| `checkins` | SELECT | `checkins_select` | `is_super_admin() OR tenant_id = user_venue_id()` |
| `checkins` | INSERT | `checkins_insert` | `WITH CHECK` cùng expression |

**Dropped (Sprint 9 open):** `qr_tokens_*_authenticated`, `checkins_*_authenticated` với `USING (true)`.

### Intentional exceptions

| Exception | Lý do |
|-----------|-------|
| **Không có anon policy** | QR scan do staff đã đăng nhập (`getSupabaseAuthClient`). App chặn `PLAYER` tại `canPerformCheckin`. |
| **SUPER_ADMIN bypass** | Vận hành platform — `is_super_admin()` trong mọi policy. |
| **service_role** | Bypass RLS mặc định — cron/admin jobs không đổi. |
| **Không RPC public token lookup** | `validateQrToken` query `token_hash` qua JWT cùng venue — cross-tenant trả `NOT_FOUND` (đúng). |

---

## Staging apply

```text
1. Supabase SQL Editor (staging qyewbxjsiiyufanzcjcq)
2. Run docs/supabase-phase16-kn6-qr-checkins-rls.sql
3. Run docs/supabase-staging-phase16-kn6-seed.sql
4. Verify (xem bên dưới)
```

---

## Regression tests

### Unit (local)

```bash
node --test tests/phase16-kn6-rls.test.js
```

| Case | Kỳ vọng |
|------|---------|
| Same-tenant QR validate | PASS |
| Cross-tenant QR validate | `WRONG_TENANT` |
| Same-tenant check-in (dev store) | PASS |
| Cross-tenant check-in | `WRONG_TENANT` |
| PLAYER `canPerformCheckin` | `false` |

### Staging JWT probes

```bash
# .env.local: VITE_SUPABASE_* + STAGING_OWNER_*_PASSWORD
node scripts/verify-phase16-kn6-rls-staging.mjs
node scripts/verify-cross-tenant-rls-staging.mjs
```

| Probe | Owner A | Owner B | Anon |
|-------|---------|---------|------|
| SELECT own tenant rows | ✅ | ✅ | — |
| SELECT filter other tenant | 0 rows | 0 rows | — |
| INSERT other tenant | RLS blocked | RLS blocked | — |
| token_hash own tenant | visible | visible | — |
| token_hash other tenant | not visible | not visible | — |
| SELECT any table | — | — | blocked / 0 rows |

**Script:** `scripts/verify-phase16-kn6-rls-staging.mjs`  
**Cross-tenant matrix:** `scripts/verify-cross-tenant-rls-staging.mjs` — `qr_tokens`/`checkins` mode `tenant` (không còn `policy-open`).

---

## Gate evidence

**Verified:** 2026-07-03 (post manual SQL apply on staging `qyewbxjsiiyufanzcjcq`)

| Gate | Command | Kết quả |
|------|---------|---------|
| diff check | `git diff --check` | ✅ PASS |
| unit | `npm test` | ✅ PASS — 752 pass / 0 fail (incl. `phase16-kn6-rls.test.js`) |
| build | `npm run build` | ✅ PASS |
| lint | `npm run lint` | ✅ 0 errors (128 warnings pre-existing) |
| KN-6 dedicated | `node scripts/verify-phase16-kn6-rls-staging.mjs` | ✅ **PASS** — 18/18 probes (Owner A/B + anon) |
| cross-tenant RLS | `node scripts/verify-cross-tenant-rls-staging.mjs` | ✅ **PASS** — 35/35 probes (`qr_tokens`/`checkins` mode `tenant`) |
| Preview P0 | `node scripts/verify-phase15-preview-p0-qa.mjs` | ⏭️ Skipped — không đổi route; prior 38/38 P0 PASS (ccac434) |

### Staging apply (completed)

```text
1. SQL Editor → docs/supabase-phase16-kn6-qr-checkins-rls.sql ✅
2. SQL Editor → docs/supabase-staging-phase16-kn6-seed.sql ✅
3. Re-run verify scripts ✅
```

### KN-6 staging probe summary (`verify-phase16-kn6-rls-staging.mjs`)

| Probe group | Result |
|-------------|--------|
| Anon `qr_tokens` / `checkins` | 0 rows |
| Owner A own-tenant read | `qr_tokens` 3, `checkins` 3 |
| Owner A cross-tenant filter | 0 rows |
| Owner A cross-tenant INSERT | RLS blocked |
| Owner A token_hash own / other | visible / not visible |
| Owner B (mirror) | same pattern — all PASS |
| **Summary** | `PASS=18 PARTIAL=0 FAIL=0` |

### Cross-tenant matrix (`verify-cross-tenant-rls-staging.mjs`)

| Table / probe | Owner A | Owner B |
|---------------|---------|---------|
| `qr_tokens` isolated read | 3 rows | 3 rows |
| `checkins` isolated read | 3 rows | 3 rows |
| filter other tenant | 0 rows | 0 rows |
| INSERT other tenant | RLS blocked | RLS blocked |
| PLAYER billing/admin routes | blocked | — |
| **Summary** | `PASS=35 PARTIAL=0 FAIL=0` (SUPER_ADMIN skipped — no creds) |

---

## Phase 17 re-run (2026-07-03, commit `b88af90`)

| Gate | Command | Kết quả |
|------|---------|---------|
| diff check | `git diff --check` | ✅ PASS |
| unit | `npm test` | ✅ PASS — 752/752 |
| build | `npm run build` | ✅ PASS |
| lint | `npm run lint` | ✅ 0 errors |
| KN-6 dedicated | `node scripts/verify-phase16-kn6-rls-staging.mjs` | ✅ **PASS** — 18/18 |
| cross-tenant RLS | `node scripts/verify-cross-tenant-rls-staging.mjs` | ✅ **PASS** — 35/35 |
| Preview P0 | `node scripts/verify-phase15-preview-p0-qa.mjs` | ✅ PASS 54 · FAIL 0 · P0 FAIL 0 |

**Verdict:** ✅ Phase 17 pre-tag sanity confirms KN-6 remains CLOSED; RC1 technical gates PASS.

---

## QR check-in flow (post-hardening)

```mermaid
sequenceDiagram
  participant Staff as Staff JWT
  participant App as checkInService
  participant DB as qr_tokens RLS

  Staff->>App: scan QR / processQrCheckin
  App->>DB: SELECT by token_hash
  alt same venue
    DB-->>App: token row
    App->>DB: INSERT checkins (tenant_id = venue)
    DB-->>App: OK
  else other venue
    DB-->>App: null (RLS)
    App-->>Staff: NOT_FOUND
  end
```

---

## KN-6 status

| Before | After |
|--------|-------|
| `USING (true)` — PARTIAL | `tenant_id = user_venue_id()` — **CLOSED** |
| Policy open, no seed rows | Seed applied + 18/18 KN-6 + 35/35 cross-tenant probes PASS |

**Production:** vẫn ⛔ NO-GO — chờ Phase 18–19; KN-6 không còn blocker cho RC1 path (khuyến nghị closed trước tag).

---

## Related docs

- `docs/v5/PHASE_10D_CROSS_TENANT_RLS_QA.md` — baseline cross-tenant
- `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` — KN-6 original finding
- `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md` — Phase 16 slot
