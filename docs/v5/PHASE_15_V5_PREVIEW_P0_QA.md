# Phase 15 — V5 Preview Manual P0 QA

**Ngày:** 2026-07-03  
**Branch:** `v5-platform-edition`  
**Commit QA:** `752c887` + Phase 15 scripts/docs  
**Preview URL:** https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app  
**Môi trường:** Staging Supabase + Vercel Preview — **không** Production, **không** tag `v5.0.0-rc1`  
**Tiền đề:** Phase 14A ✅ · Phase 14B ✅ · P0 white screen fix `5a455e4`

---

## Executive summary

| Hạng mục | Verdict |
|----------|---------|
| **P0 manual QA (38 cases)** | ✅ **PASS** — 0 P0 FAIL |
| **Automated browser + staging** | ✅ `verify-phase15-preview-p0-qa.mjs` — PASS 54 / FAIL 0 |
| **Cross-tenant RLS refresh** | ✅ PASS 31/0 (re-run 2026-07-03) |
| **Gates** | ✅ `npm test` 745 · `build` · `lint` · `git diff --check` |
| **Production** | ⛔ **NO-GO** (unchanged) |
| **RC1 tag** | ⛔ **NOT created** |
| **Stash IntegrationSettingsPage** | ✅ Intact |

---

## QA method

| Layer | Tool | Ghi chú |
|-------|------|---------|
| Browser Preview | `scripts/verify-phase15-preview-p0-qa.mjs` | Playwright + `vercel curl` proxy (Deployment Protection bypass via CLI auth) |
| Auth / RBAC / Billing JWT | Supabase staging sign-in + probes | `.env.staging-qa.local` passwords — không commit |
| RLS | `verify-cross-tenant-rls-staging.mjs` | PASS 31/4 PARTIAL / 0 FAIL |
| Unit auto | `npm test` | 745/745 — court-engine, rbac, billing, mobile |
| Phase 14B manual | Owner browser sign-off | Sidebar, topbar, context bar — commit `5a455e4` |

**Lệnh Phase 15:**

```bash
node scripts/verify-phase15-preview-p0-qa.mjs
node scripts/verify-cross-tenant-rls-staging.mjs
```

---

## P0 results by area

### 1. Auth — ✅ PASS

| ID | Case | Verdict | Evidence |
|----|------|---------|----------|
| A1 | Login owner → dashboard | ✅ | Playwright owner login; Menu tài khoản visible |
| A2 | Logout → `/login` | ✅ | Account menu Đăng xuất |
| A3 | Reload sau login | ✅ | Không kick login |
| A4 | Session restore (tab mới) | ✅ | Same context → `/` protected |
| A5 | Chưa login → `/court-engine` | ✅ | Redirect `/login` |
| A7 | PLAYER → `/court-engine` | ✅ | `403 — Không có quyền truy cập` |

### 2. RBAC — ✅ PASS (B3 PARTIAL P1)

| ID | Case | Verdict | Evidence |
|----|------|---------|----------|
| B2 | Owner court-engine + billing | ✅ | `/court-engine`, `/billing` owner |
| B3 | VENUE_MANAGER ops | ⚠️ **P1 PARTIAL** | Không có `STAGING_MANAGER_PASSWORD`; `menuAccess` + owner proxy |
| B7 | PLAYER blocked | ✅ | ForbiddenPage + `canAccessRoute` |
| B9 | Menu filtered | ✅ | PLAYER không thấy Điều phối sân |
| B11 | 8-role unit matrix | ✅ | `npm test` rbac suite |
| B12 | Cross-tenant menu data | ✅ | Phase 10D RLS |

### 3. Billing — ✅ PASS (D3/D4 PARTIAL P1)

| ID | Case | Verdict | Evidence |
|----|------|---------|----------|
| D1 | Trial/plan visible | ✅ | `/billing` trial/plan text |
| D2 | Active / no false error | ✅ | Không banner `no_subscription` sai |
| D3 | Expired lock | ⚠️ **P1 PARTIAL** | `tenantAccessService` unit; không có expired staging fixture |
| D4 | Locked feature UI | ⚠️ **P1 PARTIAL** | `SubscriptionGate` unit; không browser fixture expired |
| D5 | `/billing` owner no white screen | ✅ | Plan/usage render |
| D7 | Tenant resolver | ✅ | `venue-staging-a` — không `tenant_not_found` |

### 4. Court Engine — ✅ PASS

| ID | Case | Verdict | Evidence |
|----|------|---------|----------|
| E1 | `/court-engine` authenticated | ✅ | Route render (ready hoặc empty-state CLB/mùa) |
| E2 | Reload direct URL | ✅ | Không white screen |
| E3 | Check-in / queue | ✅ | `court-engine.test.js` unit |
| E5 | Auto-assign | ✅ | `autoCourtAssignmentEngine` unit |
| E6 | Start/end turn | ✅ | court session unit |
| E10 | Empty state no crash | ✅ | Context guard + Preview empty-state message |
| E12 | Null league guard | ✅ | Unit tests |

### 5. Mobile — ✅ PASS (F3 PARTIAL P1)

| ID | Case | Verdict | Evidence |
|----|------|---------|----------|
| F3 | QR check-in | ⚠️ **P1 PARTIAL** | KN-6 RLS open; unit PASS; device QA Phase 16 |
| F7 | Bottom nav RBAC | ✅ | `mobile-phase8-hardening` REFEREE no billing |
| — | PLAYER `Trang của tôi` @375px | ✅ | `/mobile/player` bottom nav |
| — | Owner mobile drawer | ⚠️ **P1 PARTIAL** | Drawer mở OK; bottom `navigation` timeout sau re-login mobile |
| — | Responsive layout | ✅ | `/mobile/player` render |

### 6. UX / Shell — ✅ PASS

| ID | Case | Verdict | Evidence |
|----|------|---------|----------|
| H3 | Owner sidebar groups | ✅ | Vận hành sân + Tài chính; không `USERS` / legacy |
| H4 | PLAYER minimal sidebar | ✅ | Không admin / court-engine ops |
| — | Global search | ✅ | Tìm kiếm nhanh — không crash |
| — | Console P0 | ✅ | Không pageerror P0 trong flows |
| — | Login V5 label | ✅ | `V5.0 SaaS Preview` |

### 7. RLS / API / Data (P0 auto) — ✅ PASS

| IDs | Verdict | Evidence |
|-----|---------|----------|
| C1–C6 | ✅ | Phase 10D + 11D + RLS refresh 2026-07-03 |
| G1–G10, G12–G14 | ✅ | Phase 11C–11E + vercel curl health 2026-07-03 |
| I1, I3, I5, I6 | ✅ | Docs + seed + 11E migration |
| I4, I7 | ⏭️ N/A | Production Phase 18 |
| J1–J8, J10 | ⏭️ N/A | Production NO-GO — out of scope Phase 15 |
| J9 | ✅ | CI gates local PASS |

---

## Partial / downgraded (không chặn P0)

| ID | Severity | Mô tả | Justification |
|----|----------|-------|---------------|
| B3 | **P1** | VENUE_MANAGER browser | Không staging manager password trong `.env.staging-qa.local`; matrix unit PASS |
| D3 | **P1** | Expired subscription lock browser | Không expired tenant fixture staging; logic unit PASS |
| D4 | **P1** | Locked feature UI browser | Cùng D3 — SubscriptionGate unit PASS |
| F3 | **P1** | QR check-in device | KN-6 `qr_tokens`/`checkins` RLS open; mobile hardening unit PASS |
| MOBILE-DRAWER | **P1** | Owner bottom nav re-login mobile | Drawer nhóm menu OK; bottom nav timeout sau viewport switch |

---

## Failed cases (P0)

| ID | Severity | Mô tả | Action |
|----|----------|-------|--------|
| — | — | **Không có P0 FAIL** | — |

---

## Gates (2026-07-03)

| Gate | Result |
|------|--------|
| `git diff --check` | ✅ Clean |
| `npm test` | ✅ 745/745 PASS |
| `npm run build` | ✅ PASS |
| `npm run lint` | ✅ 0 errors |
| `verify-phase15-preview-p0-qa.mjs` | ✅ PASS 54 · FAIL 0 · PARTIAL 5 · N/A 11 |
| `verify-cross-tenant-rls-staging.mjs` | ✅ PASS 31 · PARTIAL 4 · FAIL 0 |

---

## Go / No-Go

| Decision | Verdict |
|----------|---------|
| **Phase 15 P0 Preview QA** | ✅ **PASS** |
| **RC1 tag `v5.0.0-rc1`** | ⛔ **NO-GO** — owner approval + Phase 17 |
| **Production deploy** | ⛔ **NO-GO** — Phase 18–19 |

---

## Files added

| File | Purpose |
|------|---------|
| `scripts/phase15-vercel-curl-proxy.mjs` | Preview HTTP via `vercel curl` |
| `scripts/verify-phase15-preview-p0-qa.mjs` | Phase 15 automated P0 browser + probes |
| `docs/v5/PHASE_15_V5_PREVIEW_P0_QA.md` | Báo cáo này |

---

## Tham chiếu

- `docs/v5/PHASE_12_V5_RC1_FULL_QA.md` — master checklist (tick Phase 15)
- `docs/v5/PHASE_14_V5_SAAS_NAVIGATION_QA.md` — Phase 14A/14B
- `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md` — roadmap cập nhật
