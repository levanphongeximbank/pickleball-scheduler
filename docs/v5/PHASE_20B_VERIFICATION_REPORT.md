# Phase 20B — Verification Report

**Ngày:** 2026-07-04  
**Phase:** 20B — Staging Pilot Acceptance  
**Version:** `5.0.0-rc1` / `V5.0 SaaS Preview RC1`

---

## 1. Verdict

| Phạm vi | Verdict |
|---------|---------|
| Automated (test/build/lint/code review) | ✅ **PASS** |
| Staging Supabase script | ⚠️ **BLOCKED** — credentials local invalid (`Unregistered API key`) |
| Owner manual smoke (17 mục) | ⏳ **PENDING** |
| Mobile device QA | ⏳ **PENDING** |

**Verdict tổng thể Phase 20B:** **PARTIAL PASS / CONDITIONAL GO**

Có thể **bắt đầu pilot staging 1 sân** sau khi owner hoàn tất checklist manual + script staging PASS.

**Không** deploy production. **Không** chuyển Phase 21 Production Preflight cho đến khi owner smoke + mobile QA PASS.

---

## 2. Branch

`v5-platform-edition`

---

## 3. Commit

`9f63fce` — `docs(v5): add Phase 19A production SQL apply pack`

*(Phase 20B docs/tests/script cập nhật trong working tree — chưa commit)*

---

## 4. Files changed (Phase 20B)

### Mới

| File | Mục đích |
|------|----------|
| `docs/v5/PHASE_20B_STAGING_PILOT_ACCEPTANCE.md` | Acceptance log Step 1–7 |
| `docs/v5/PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` | 17 mục smoke tiếng Việt |
| `docs/v5/PHASE_20B_VERIFICATION_REPORT.md` | Báo cáo này |

### Cập nhật

| File | Thay đổi |
|------|----------|
| `scripts/verify-billing-tenant-mapping-staging.mjs` | Phase 20B operational readiness + pilot env |
| `package.json` | `test:verify-billing-tenant-mapping` script |
| `tests/billing-phase20-pilot-hardening.test.js` | +3 tests operational route smoke |
| `docs/v5/PHASE_20_MOBILE_PILOT_QA.md` | Bảng tick owner Phase 20B |
| `docs/v5/PHASE_20_COURT_ENGINE_PERSISTENCE.md` | Rủi ro dev-demo IDs + backup bắt buộc |

### Kế thừa Phase 20 (working tree)

Code billing gate, court engine tenant keys, tests 766→769 — xem `PHASE_20_VERIFICATION_REPORT.md`.

---

## 5. Commands run

```bash
git branch --show-current
git log -1 --oneline
git status --short
npm test
npm run build
npm run lint
node --test tests/billing-phase20-pilot-hardening.test.js
npm run test:verify-billing-tenant-mapping   # ⚠️ Unregistered API key
```

---

## 6. Test result

| Gate | Kết quả |
|------|---------|
| `npm test` | ✅ **769/769 PASS** |
| `npm run build` | ✅ PASS |
| `npm run lint` | ✅ 0 errors, 128 warnings legacy |
| Phase 20B route tests | ✅ 10/10 trong `billing-phase20-pilot-hardening.test.js` |
| Court engine storage | ✅ 5/5 (Phase 20) |

---

## 7. Staging checks completed

| Check | Automated | Manual |
|-------|-----------|--------|
| venues + tenant_subscriptions mapping | Script (blocked credentials) | Owner SQL/script |
| profiles.venue_id alignment | Script cần service role | Owner mục 4 checklist |
| trialing/active operational | Script + unit tests | Owner mục 5 |
| no_subscription blocked | Unit tests ✅ | Owner xác nhận không thấy bypass |
| expired/suspended blocked | Unit tests ✅ | Optional staging tenant test |
| Operational routes | Unit tests ✅ | Owner mục 6–7, 14 |
| QR valid/invalid | — | Owner mục 11–12 |
| Court Engine persistence | Unit tests ✅ | Owner mục 8–9, 14 |

---

## 8. Owner manual checklist status

**File:** `docs/v5/PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md`

| Trạng thái | Ghi chú |
|------------|---------|
| ⏳ **0/17 hoàn tất** | Owner cần chạy trên Preview staging |

**Owner chạy script staging (máy có `.env.local` đúng):**

```bash
# .env.local — KHÔNG commit file này
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role>   # khuyến nghị
STAGING_PILOT_VENUE_ID=<uuid-venue-pilot>  # tùy chọn
STAGING_PILOT_OWNER_EMAIL=owner@sancuaban.vn # tùy chọn

npm run test:verify-billing-tenant-mapping
```

---

## 9. Mobile QA status

**File:** `docs/v5/PHASE_20_MOBILE_PILOT_QA.md`

| Hạng mục | Trạng thái |
|----------|------------|
| Android Chrome | ⏳ Owner |
| iPhone Safari | ⏳ Owner |
| PWA install | ⏳ Owner |
| QR permission | ⏳ Owner |
| Route gate mobile | Automated logic ✅; device ⏳ |
| Push disabled | ⏳ Owner |
| Offline không mất data | ⏳ Owner |

---

## 10. Remaining risks

1. **Staging credentials** chưa verify trên Supabase thật trong session này
2. **Court Engine localStorage** — mất data nếu clear cache; cần export backup
3. **Mobile QA thiết bị thật** chưa có kết quả
4. **Payment** mock/manual only — không live
5. **Dev demo IDs** (`venue-demo`) — an toàn khi RBAC + Supabase auth staging; không dùng dev login
6. **Lint warnings** 128 — legacy, không chặn pilot

---

## 11. Go/No-Go pilot 1 sân (staging)

| Tiêu chí | Trạng thái |
|----------|------------|
| Automated gates | ✅ GO |
| Billing operational lock | ✅ GO |
| Court engine tenant isolation | ✅ GO |
| Staging tenant + trial RPC | ⏳ Owner script |
| Owner smoke 17 mục | ⏳ Owner |
| Mobile Android hoặc iPhone | ⏳ Owner |

**Go/No-Go:** **CONDITIONAL GO** — handoff owner QA; bắt đầu vận hành thử **sau** mục 1,3,5,7,8 PASS + ít nhất 1 mobile.

---

## 12. Phase 21 Production Preflight

| Câu hỏi | Trả lời |
|---------|---------|
| Có chuyển Phase 21 ngay? | **Chưa** |
| Điều kiện chuyển | Owner smoke PASS + staging script PASS + mobile PASS (ít nhất 1 OS) |
| Phase 21 scope (dự kiến) | Production Preflight SQL (19A tiếp), court engine cloud design, payment staging mock |

---

## Tóm tắt cho stakeholder

Phase 20B hoàn tất **phần kỹ thuật tự động**: tests, build, operational route policy, script staging mở rộng, checklist owner tiếng Việt. **Phần xác nhận trên staging thật** (Supabase + Preview + mobile) cần owner thực hiện theo checklist trước khi coi pilot là PASS đầy đủ.
