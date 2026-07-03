# V5.0 SaaS Completion Roadmap

**Ngày cập nhật:** 2026-07-03  
**Phiên bản mục tiêu:** Pickleball Scheduler Pro **v5.0** — Platform / SaaS Edition  
**Branch:** `v5-platform-edition`  
**Commit navigation (latest):** `5a455e4` — fix(shell): prevent V5 app shell preview white screen
**Commit menu + docs:** `150da3a` — menu V5 + docs Phase 14  
**Môi trường:** Staging Supabase + Vercel Preview — **không** Production  
**Ràng buộc:** Không tag `v5.0.0-rc1`; không deploy Production; không pop stash `IntegrationSettingsPage.jsx`; không ghi secret hoặc env value vào tài liệu/log.

---

## Executive summary

Navigation V5.0 đã triển khai kỹ thuật (config tập trung, sidebar, topbar, mobile nav theo role), **automated gates PASS**, **Phase 14A + 14B browser QA PASS**, và **Phase 15 P0 Preview QA PASS** (2026-07-03). RC1 tag và Production deploy **vẫn NO-GO** — chờ owner approve Phase 17 + Production readiness.

| Hạng mục | Verdict |
|----------|---------|
| Platform Core (code) | ✅ **PASS** |
| API key guard / runtime / audit | ✅ **PASS** |
| RC1 automated technical | ✅ **PASS** |
| Cross-tenant RLS | ✅ **PASS** (KN-6 partial) |
| Menu V5 code | ✅ **PASS** |
| Phase 14A Preview Environment | ✅ **PASS** |
| Phase 14B Menu browser QA | ✅ **PASS** |
| P0 white screen (Preview) | ✅ **RESOLVED** — `5a455e4` |
| Manual P0 QA (Phase 15) | ✅ **PASS** — 38/38 P0, 0 FAIL (2026-07-03) |
| RC1 tag | ⛔ **Not allowed yet** |
| Production | ⛔ **NO-GO** |

---

## Current state

| Layer | Status | Ghi chú |
|-------|--------|---------|
| **Platform Core** | ✅ PASS | Kiến trúc SaaS multi-tenant, billing, court engine, API 11C–11E, mobile/PWA shell |
| **API key guard / runtime / audit** | ✅ PASS | Phase 11C–11E staging QA đóng |
| **RC1 automated technical** | ✅ PASS | `npm test` / `build` / `lint` + `verify-v5-rc1-staging.mjs` (documented 2026-07-03) |
| **Cross-tenant RLS** | ✅ PASS with KN-6 partial | 31 PASS / 4 PARTIAL — `qr_tokens`, `checkins` policy `USING (true)` |
| **Menu V5 code** | ✅ PASS | `navigationConfig.js`; sidebar + mobile drawer + topbar |
| **Phase 14A Preview Environment** | ✅ PASS | `/login` OK, V5.0 SaaS Preview — 2026-07-03 |
| **Phase 14B Menu browser QA** | ✅ PASS | Owner sidebar/topbar/context bar/dashboard — commit `5a455e4` |
| **P0 white screen** | ✅ RESOLVED | `5a455e4` — `GlobalSearch` guard + `main.jsx` error boundary |
| **Manual P0 QA (Phase 15)** | ✅ PASS | 38/38 P0 — `PHASE_15_V5_PREVIEW_P0_QA.md` (2026-07-03) |
| **RC1 tag** | ⛔ Not allowed yet | Chờ owner approve + tất cả gate trước Phase 17 |
| **Production** | ⛔ NO-GO | Chưa Production readiness, chưa GA deploy |

### Navigation V5.0 — triển khai kỹ thuật (đã xong)

| Thành phần | Trạng thái |
|------------|------------|
| `src/config/navigationConfig.js` — single source of truth | ✅ |
| Sidebar + mobile drawer dùng `navigationConfig.js` | ✅ |
| Topbar: tenant switcher, venue switcher, search, notification, profile, logout | ✅ |
| Mobile nav tách manager / referee / player | ✅ |
| Commit `5a455e4` — P0 white screen fix + app shell tests | ✅ |
| `npm test` | ✅ PASS |
| `npm run build` | ✅ PASS |

Chi tiết QA navigation: `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` — Phase 14A ✅ · Phase 14B ✅

---

## Go / No-Go

### RC1 (`v5.0.0-rc1`)

| Gate | Verdict |
|------|---------|
| **RC1 hiện tại** | ⛔ **NO-GO** |

**Lý do:**

1. ~~Manual P0 QA chưa PASS~~ ✅ Phase 15 PASS (2026-07-03)
2. KN-6 chưa closed for Production — `qr_tokens` / `checkins` RLS `USING (true)`
3. Owner chưa explicit approve RC1 tag

### Production GA

| Gate | Verdict |
|------|---------|
| **Production hiện tại** | ⛔ **NO-GO** |

**Lý do:** RC1 chưa GO; Production SQL/env/backup/smoke chưa tick; KN-6 chưa harden; Phase 18–19 chưa thực hiện.

---

## Phase roadmap

```
Phase 14A (Preview env) ──► ✅ PASS
Phase 14B (Menu manual) ──► ✅ PASS
         │
         ▼
Phase 15 (Manual P0 QA) ──► ✅ PASS
         │
         ▼
Phase 17 (RC1 tag)
         │
         ▼
Phase 16 (KN-6 RLS) ──► Phase 18 (Prod readiness) ──► Phase 19 (GA deploy)
```

---

### Phase 14A — Preview Environment Gate

**Mục tiêu:** Preview Vercel chạy đúng commit mới nhất và `/login` không còn lỗi thiếu Supabase config.

**Trạng thái:** ✅ **PASS** — 2026-07-03

| # | Task | Owner | Status |
|---|------|-------|--------|
| 14A-1 | Kiểm tra Vercel Preview env **names** (không in values) | DevOps | ✅ |
| 14A-2 | Đảm bảo có `VITE_SUPABASE_URL` | DevOps | ✅ |
| 14A-3 | Đảm bảo có `VITE_SUPABASE_ANON_KEY` | DevOps | ✅ |
| 14A-4 | Đảm bảo có `VITE_API_ENABLED` (theo staging policy) | DevOps | ✅ |
| 14A-5 | Redeploy Preview sau khi env đủ | DevOps | ✅ |
| 14A-6 | Verify `/login` không còn lỗi thiếu Supabase config | QA | ✅ |
| 14A-7 | Verify Preview chạy đúng commit (`5a455e4`) | QA | ✅ |

**Kết quả:** ✅ **Preview Environment PASS**

---

### Phase 14B — V5 SaaS Navigation Manual QA

**Mục tiêu:** Xác nhận menu V5.0 SaaS đúng nghiệp vụ trên browser Preview.

**Trạng thái:** ✅ **PASS** — 2026-07-03, commit `5a455e4`

**Tiền đề:** Phase 14A PASS ✅

| # | Test case | Role | Kết quả |
|---|-----------|------|---------|
| 14B-1 | Owner thấy đủ menu nghiệp vụ V5 | COURT_OWNER | ✅ |
| 14B-2 | Sidebar emerald, topbar gọn, context bar mint | COURT_OWNER | ✅ |
| 14B-3 | Dashboard Tổng quan + KPI hôm nay | COURT_OWNER | ✅ |
| 14B-4 | Không label legacy (`USERS`, v3.5.3, `AI Director Platform`) | COURT_OWNER | ✅ |
| 14B-5 | Click menu không 403 sai role | COURT_OWNER | ✅ |
| 14B-6 | P0 white screen | All | ✅ RESOLVED `5a455e4` |
| 14B-7 | Player không thấy menu staff/admin | PLAYER | ⏳ follow-up |
| 14B-8 | Referee mobile nav đúng role | REFEREE | ⏳ follow-up |
| 14B-9 | `Của tôi (Mobile)` → `/mobile/player` | COURT_OWNER | ⏳ follow-up |

**Kết quả:** ✅ **Menu V5.0 SaaS Manual PASS** (owner scope)

**Tài liệu chi tiết:** `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` § Phase 14B

---

### Phase 15 — Manual P0 QA

**Mục tiêu:** Tick manual P0 master checklist (38 P0) trên Preview staging.

**Trạng thái:** ✅ **PASS** (2026-07-03).

**Tài liệu:** `docs/v5/PHASE_15_V5_PREVIEW_P0_QA.md`  
**Script:** `node scripts/verify-phase15-preview-p0-qa.mjs` — PASS 54 · FAIL 0

**Kết quả:** ✅ **38/38 P0 PASS** — 5 P1 partial downgraded (B3, D3, D4, F3, mobile drawer)

---

### Phase 16 — Mobile QR / Check-ins RLS Hardening

**Mục tiêu:** Đóng KN-6 — harden RLS `qr_tokens` và `checkins` trước Production mobile traffic.

**Trạng thái:** ⏳ **Pending** — có thể song song Phase 15 nhưng **bắt buộc** trước Production.

| # | Task | Kỳ vọng |
|---|------|---------|
| 16-1 | SQL patch RLS `qr_tokens` — không còn `USING (true)` | Policy `tenant_id = user_venue_id()` hoặc tương đương |
| 16-2 | SQL patch RLS `checkins` — không còn `USING (true)` | Policy tenant-scoped |
| 16-3 | Cross-tenant verify — Owner A không đọc/ghi QR/checkins Owner B | `verify-cross-tenant-rls-staging.mjs` → 0 PARTIAL cho 2 bảng |
| 16-4 | Mobile QR flow vẫn hoạt động đúng tenant | Manual F3 + staging smoke |

**Known issue:** KN-6 — `qr_tokens` / `checkins` policy open, 0 rows staging, chưa leak thực tế nhưng **không chấp nhận cho Production**.

**Kết quả mong muốn:** ✅ **KN-6 CLOSED** — RLS hardened + cross-tenant verify PASS

---

### Phase 17 — RC1 Tag

**Mục tiêu:** Tag `v5.0.0-rc1` khi owner approve và tất cả gate đạt.

**Trạng thái:** ⛔ **NOT ALLOWED YET**

| Điều kiện | Required |
|-----------|----------|
| Preview Environment PASS (Phase 14A) | ✅ Bắt buộc |
| Menu Manual QA PASS (Phase 14B) | ✅ Bắt buộc |
| Manual P0 QA PASS (Phase 15) | ✅ Bắt buộc |
| Owner explicit approve | ✅ Bắt buộc |
| KN-6 closed (Phase 16) | ⚠️ Bắt buộc cho Production; khuyến nghị trước RC1 tag |

**Không tag nếu:**

- Manual P0 chưa PASS
- Preview Environment chưa PASS
- Menu Manual QA chưa PASS
- Owner chưa approve

**Lệnh (chỉ khi GO):**

```bash
git tag -a v5.0.0-rc1 -m "V5.0 RC1 — Platform SaaS Edition"
git push origin v5.0.0-rc1
```

⛔ **Không tự tag trong session QA/docs.**

---

### Phase 18 — Production Readiness

**Mục tiêu:** Chuẩn bị Production trước deploy — backup, SQL, env, smoke, rollback plan.

**Trạng thái:** ⏳ **Not started** — chờ Phase 17 GO.

| # | Task | Tài liệu |
|---|------|----------|
| 18-1 | Supabase Production backup / snapshot | `docs/SUPABASE-PRODUCTION-CHECKLIST.md` |
| 18-2 | Apply Production SQL (15+ steps) | `docs/supabase-*.sql` theo checklist |
| 18-3 | Production env checklist tick | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` |
| 18-4 | Smoke test plan sẵn sàng | `docs/GA-PRODUCTION-QA.md` |
| 18-5 | Rollback plan documented | Deployment ID + DB snapshot reference |

**Kết quả mong muốn:** ✅ **Production Readiness GO**

---

### Phase 19 — GA Deploy

**Mục tiêu:** Deploy Production và xác nhận GA.

**Trạng thái:** ⛔ **NO-GO** — chỉ sau Phase 18 GO.

| # | Task |
|---|------|
| 19-1 | Deploy Vercel Production (owner trigger) |
| 19-2 | Production smoke test — auth, billing, court-engine, mobile |
| 19-3 | Monitor 24h — error rate, RLS, API audit |
| 19-4 | Publish `RELEASE_NOTES_v5.0.md` |
| 19-5 | Update `AGENTS.md` — GA status |

**Kết quả mong muốn:** ✅ **V5.0 GA LIVE**

---

## Completed phases (reference)

| Phase | Mô tả | Status | Tài liệu |
|-------|-------|--------|----------|
| 8 | Mobile GA checklist | ✅ | `PHASE_8_MOBILE_GA_CHECKLIST.md` |
| 9 | Commercial closeout | ✅ | `PHASE_9_COMMERCIAL_CLOSEOUT.md` |
| 10 | Release audit + cross-tenant RLS | ✅ | `PHASE_10_*` |
| 11A–11E | Marketplace API + key guard + audit | ✅ | `PHASE_11*` |
| 12 | RC1 full QA checklist (automated PASS) | ✅ partial | `PHASE_12_V5_RC1_FULL_QA.md` |
| 13 | Full software audit | ✅ | `PHASE_13_V5_FULL_SOFTWARE_AUDIT.md` |
| 14 (code) | Navigation V5 technical | ✅ | `PHASE_14_V5_SAAS_NAVIGATION_QA.md` |
| 14A | Preview Environment Gate | ✅ | `PHASE_14_V5_SAAS_NAVIGATION_QA.md` § 10 |
| 14B | V5 SaaS Navigation Browser QA | ✅ | `PHASE_14_V5_SAAS_NAVIGATION_QA.md` § 11 |

---

## Next action (immediate)

1. **Phase 15** — Manual P0 QA trên Preview: tick 38 P0 cases trong `PHASE_12_V5_RC1_FULL_QA.md` (Auth, RBAC, Billing, Court Engine, Mobile, UX).
2. **Phase 14B follow-up** (không chặn Phase 15): PLAYER / REFEREE mobile nav, Global search, Venue switcher.
3. **Phase 16** (song song được): KN-6 RLS harden `qr_tokens` / `checkins`.
4. Sau Phase 15 PASS + owner approve → cân nhắc **Phase 17** RC1 tag.

---

## Constraints (unchanged)

| Ràng buộc | Status |
|-----------|--------|
| Không tag `v5.0.0-rc1` | ⛔ Enforced |
| Không deploy Production | ⛔ Enforced |
| Không pop stash `IntegrationSettingsPage.jsx` | ✅ Stash intact |
| Không ghi secret / env value vào docs hoặc log | ⛔ Enforced |

---

## Tham chiếu

| Tài liệu | Mục đích |
|----------|----------|
| `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` | Master checklist 94 cases |
| `docs/v5/PHASE_13_V5_FULL_SOFTWARE_AUDIT.md` | Full audit + KN-6 |
| `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` | Navigation technical + manual QA |
| `docs/v5/PHASE_10D_CROSS_TENANT_RLS_QA.md` | RLS baseline |
| `docs/v5/V5_ARCHITECTURE_BLUEPRINT.md` | Kiến trúc V5 |
| `scripts/verify-v5-rc1-staging.mjs` | RC1 technical gate |
| `scripts/verify-cross-tenant-rls-staging.mjs` | RLS JWT probe |
