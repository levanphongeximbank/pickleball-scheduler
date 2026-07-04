# Release Notes — V5.0 SaaS Preview RC1

**Package:** `5.0.0-rc1`  
**UI label:** `V5.0 SaaS Preview RC1`  
**Ngày:** 2026-07-04  
**Phase:** 20 — Pilot Hardening

---

## Đã đạt (Phase 20)

- Billing access **single source of truth** — Phase 9 `tenant_subscriptions`
- `no_subscription` **không còn** full access mặc định
- `OperationalRouteGate` gắn `MainLayout` — khóa route vận hành
- `TenantOperationalGate` — thông báo tiếng Việt + link Thanh toán
- Court Engine — **tenant-scoped** localStorage + export/import backup
- Checklists pilot setup + mobile QA
- Tests regression Phase 20 (`billing-phase20-pilot-hardening`, `court-engine-storage`)

---

## Chưa đạt

- Production deploy
- Payment gateway live (VNPay/MoMo/Stripe)
- Court Engine cloud-native Supabase
- Club blob cloud mặc định (vẫn local-first)
- Mobile GA — QA thiết bị thật đầy đủ
- Sprint 4 `subscriptionGuard` plan limits vẫn song song (chỉ limits, không access SSOT)

---

## Known limitations

1. Court session data trên localStorage — mất khi clear cache (có export backup)
2. Payment chỉ manual/mock
3. SUPER_ADMIN bypass operational gate (cố ý)
4. Local dev không RBAC — gate tắt (`VITE_RBAC_ENABLED=false`)
5. `useBilling` auto-create trial chỉ trên local billing store

---

## Không phải production-ready

Bản RC1 **chưa** đủ điều kiện GA thương mại. Chỉ dùng:

- Staging / Vercel Preview
- Pilot có kiểm soát 1–2 venue
- Sau khi hoàn tất `PHASE_20_PILOT_SETUP_CHECKLIST.md`

---

## Điều kiện pilot

| Điều kiện | Bắt buộc |
|-----------|----------|
| `profiles.venue_id` khớp `venues.id` | ✅ |
| Trial subscription trên Supabase | ✅ |
| RBAC bật trên Preview | ✅ |
| Không `tenant-demo` runtime | ✅ |
| Owner test billing + court engine | ✅ |
| Ít nhất 1 thiết bị mobile QA | Khuyến nghị |

---

## Bước tiếp theo

- **Phase 21 — Production Preflight:** SQL apply production, env checklist, smoke
- **Phase 22:** Court Engine cloud persistence, payment staging gateway
