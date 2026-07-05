# Phase 19B — Production Smoke Test Checklist (Owner)

**Mục đích:** Kiểm tra nhanh trên **Vercel Production** sau deploy controlled test Phase 19B.  
**Không bán thương mại** · **Payment live OFF** · **API/Marketplace/AI OFF**

**Chuẩn bị:**

- Production URL: `https://pickleball-scheduler-eight.vercel.app`
- Tài khoản **COURT_OWNER** đã bootstrap (`PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md`)
- Tài khoản **PLAYER** (optional — RBAC S8)
- Smoke tester: **Phong**
- Ghi kết quả vào: `PHASE_19B_CONTROLLED_PRODUCTION_TEST_REPORT.md`

**Cách đánh dấu:** ☐ chưa làm · ✅ PASS · ❌ FAIL

**Fail P0 → rollback ngay:** Vercel → Promote deployment `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2`

---

## A. T+0 — P0 smoke (~15 phút, ngay sau deploy)

> Chạy **ngay** khi deploy xong. Mọi mục P0 phải PASS trước khi tiếp tục 24h window.

### A1. Supabase config / login page

| | |
|---|---|
| **Mục tiêu** | App kết nối đúng Production Supabase |
| **Cách kiểm tra** | Mở `/login` — không đăng nhập |
| **Kỳ vọng** | Trang render; **không** báo "Invalid Supabase URL" / config error |
| **Nếu fail** | Check `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → rollback |

☐ Kết quả: ___

### A2. Owner login

| | |
|---|---|
| **Mục tiêu** | Auth Production hoạt động |
| **Cách kiểm tra** | Đăng nhập COURT_OWNER |
| **Kỳ vọng** | Dashboard load; không white screen |
| **Nếu fail** | Supabase Auth, `AuthContext.jsx` → rollback nếu P0 |

☐ Kết quả: ___

### A3. Navigation / V5 menu

| | |
|---|---|
| **Mục tiêu** | Sidebar + topbar hoạt động |
| **Cách kiểm tra** | Click 3–4 menu chính (Tổng quan, Xếp sân, Billing) |
| **Kỳ vọng** | Chuyển trang OK; menu V5 hiển thị |
| **Nếu fail** | `navigationConfig`, route guards |

☐ Kết quả: ___

### A4. Billing / trial

| | |
|---|---|
| **Mục tiêu** | Billing Supabase mode hoạt động (`VITE_BILLING_SUPABASE=true`) |
| **Cách kiểm tra** | Mở `/billing` |
| **Kỳ vọng** | Plan TRIAL/trialing hiển thị; **không** false `no_subscription` lock |
| **Nếu fail** | Bootstrap §3 trial RPC; `tenant_subscriptions`; tạm rollback nếu crash loop |

☐ Kết quả: ___

### A5. Court Engine load

| | |
|---|---|
| **Mục tiêu** | Module xếp sân mở được khi subscription OK |
| **Cách kiểm tra** | Mở `/court-engine` trực tiếp |
| **Kỳ vọng** | Trang load; không bị khóa subscription sai |
| **Nếu fail** | `OperationalRouteGate`, bootstrap venue |

☐ Kết quả: ___

### A6. Mobile viewport

| | |
|---|---|
| **Mục tiêu** | Layout mobile usable |
| **Cách kiểm tra** | DevTools 375px width hoặc điện thoại |
| **Kỳ vọng** | Không overflow nghiêm trọng; bottom nav nếu route mobile |
| **Nếu fail** | P1 — ghi nhận, không rollback trừ khi unusable |

☐ Kết quả: ___

### A7. API health OFF

| | |
|---|---|
| **Mục tiêu** | API vẫn tắt trên Production |
| **Cách kiểm tra** | `GET /api/v1/health` (browser hoặc curl) |
| **Kỳ vọng** | 503 hoặc `feature_disabled` — **đúng** khi API OFF |
| **Nếu fail** | Nếu 200 → **FAIL env** — không tiếp tục commercial path |

☐ Kết quả: ___

### A8. RBAC — PLAYER blocked

| | |
|---|---|
| **Mục tiêu** | Role guard hoạt động |
| **Cách kiểm tra** | Login PLAYER → thử `/court-engine` hoặc admin route |
| **Kỳ vọng** | 403 hoặc redirect; không thấy data tenant khác |
| **Nếu fail** | **P0 security** → rollback + báo engineering |

☐ Kết quả: ___

### A9. Console P0 errors

| | |
|---|---|
| **Mục tiêu** | Không lỗi nghiêm trọng lặp lại |
| **Cách kiểm tra** | F12 Console — login → dashboard → billing flow |
| **Kỳ vọng** | Không error đỏ lặp mỗi navigation |
| **Nếu fail** | Capture HAR → rollback nếu user-facing |

☐ Kết quả: ___

### A10. Logout

| | |
|---|---|
| **Mục tiêu** | Session clear |
| **Cách kiểm tra** | Logout → thử protected route |
| **Kỳ vọng** | Redirect `/login`; route protected blocked |
| **Nếu fail** | `AuthContext`, route guard |

☐ Kết quả: ___

### A11. HTTPS + PWA (G3-E21 post-deploy)

| | |
|---|---|
| **Mục tiêu** | Production domain an toàn + PWA manifest |
| **Cách kiểm tra** | URL `https://`; mở `/manifest.webmanifest` |
| **Kỳ vọng** | HTTPS OK; manifest 200 JSON |
| **Nếu fail** | Vercel domain config |

☐ Kết quả: ___

---

## B. T+1h — Operational persistence

### B1. Court Engine session

| | |
|---|---|
| **Mục tiêu** | Tạo phiên xếp sân |
| **Cách kiểm tra** | Court Engine → tạo session mới |
| **Kỳ vọng** | Session hiện trên UI; refresh trang vẫn thấy (localStorage pilot) |
| **Nếu fail** | `courtSessionService`, storage layer |

☐ Kết quả: ___

---

## C. T+4h — Mobile shell

### C1. Mobile login + nav

| | |
|---|---|
| **Mục tiêu** | Mobile shell hoạt động |
| **Cách kiểm tra** | Điện thoại thật hoặc emulator — login owner |
| **Kỳ vọng** | Bottom nav / drawer usable |
| **Nếu fail** | `src/features/mobile/` — P1 ghi nhận |

☐ Kết quả: ___

---

## D. T+24h — Stability window

### D1. Auth stability

| | |
|---|---|
| **Mục tiêu** | Không spike lỗi auth/403 trong 24h |
| **Cách kiểm tra** | Login lại; duyệt 5–10 trang |
| **Kỳ vọng** | Không logout bất thường; không 403 sai role |
| **Nếu fail** | Ghi incident; cân nhắc rollback |

☐ Kết quả: ___

### D2. Subscription state

| | |
|---|---|
| **Mục tiêu** | Trial state không drift |
| **Cách kiểm tra** | `/billing` — status vẫn `trialing` |
| **Kỳ vọng** | Không tự chuyển expired/suspended |
| **Nếu fail** | `subscriptionService`, billing cron |

☐ Kết quả: ___

---

## E. Extended smoke (không chặn T+0 — chạy trong 24h nếu có thời gian)

| # | Mục | Reference |
|---|-----|-----------|
| E1 | Venue name đúng bootstrap | `PHASE_19B_PRODUCTION_BOOTSTRAP_HANDOFF.md` §2 V2 |
| E2 | QR token owner tạo OK (KN-6) | Bootstrap F5 |
| E3 | Referee RPC token flow | `docs/REFEREE-E2E.md` |
| E4 | 8-role matrix spot | `docs/GA-PRODUCTION-QA.md` § B |
| E5 | Cross-tenant JWT probe | `scripts/verify-cross-tenant-rls-staging.mjs` (prod creds local) |

---

## F. Fail criteria — rollback decision

| Symptom | Hành động |
|---------|-----------|
| White screen `/login` hoặc post-login | **Rollback** + check env |
| Owner thấy data tenant khác | **Rollback** + RBAC emergency review |
| Billing crash loop | Rollback hoặc tạm `VITE_BILLING_SUPABASE=false` |
| API health 200 khi phải OFF | **STOP** — env misconfig |
| P0 console error mọi navigation | Capture HAR → rollback nếu user-facing |

**Rollback:** Vercel → Deployments → `dpl_7EGj8HspjTfJDC5tQossBZ6JnjS2` → **Promote to Production**

---

## G. Smoke sign-off

| Field | Ghi nhận |
|-------|----------|
| Deploy date/time | __________ |
| Deployment ID mới | __________ |
| T+0 P0 (A1–A11) | PASS / FAIL |
| T+24h (D1–D2) | PASS / FAIL / PENDING |
| Rollback used? | Yes / No |
| Tester | Phong |
| Owner sign-off | __________ **Date:** __________ |

**Phase 19B smoke PASS** = T+0 P0 all ✅ + T+24h D1–D2 ✅ (không rollback).
