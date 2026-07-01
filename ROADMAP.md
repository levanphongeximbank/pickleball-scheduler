# Roadmap — Pickleball Scheduler Pro

**Version hiện tại:** v4.0.0 GA (2026-07-01)  
**Trạng thái:** Production release — Sprint 1–12 hoàn tất

---

## v4.0.0 GA — Đã hoàn thành ✅

| Sprint | Deliverable |
|--------|-------------|
| 1–2 | Identity + Multi-tenant |
| 3–4 | Club Management + Subscription |
| 5–6 | Tournament Engine + Court Engine |
| 7–8 | AI Assistant + Dashboard Analytics |
| 9–10 | Mobile/PWA + API/Marketplace preview |
| 11 | Release Candidate hardening |
| 12 | GA production env, SQL/QA, release docs |

---

## v4.1 — Post-GA Stabilization (đề xuất)

**Mục tiêu:** Ổn định production, giảm known limitations.

- [ ] Payment production — Stripe Payment Links hoặc VNPay/MoMo live
- [ ] Push notifications — Supabase Edge Function gửi thật
- [ ] Season close / Export mùa giải (UI hoàn thiện)
- [ ] ESLint hooks warnings cleanup (111 warnings)
- [ ] Performance audit — bundle Dashboard, lazy routes

---

## v4.2 — Preview → Production

**Mục tiêu:** Đưa module preview lên production-ready.

- [ ] API layer — rate limit, API key rotation, server policies
- [ ] Marketplace — order fulfillment, admin monitoring
- [ ] AI Assistant — GA default hoặc tenant opt-in policy
- [ ] Integrations — Zalo OA, Email, SMS production paths

---

## v4.3 — Director & Operations

**Mục tiêu:** Vận hành giải đấu một người trọn gói.

- [ ] Director Mode refactor — shared architecture với Court Engine
- [ ] Multi-tournament dashboard cải tiến
- [ ] Referee dispatch tự động từ Court Engine
- [ ] Backup / restore tenant (export/import blob)

---

## v5.0 — Platform (tương lai)

**Mục tiêu:** Nền tảng SaaS đa venue quy mô lớn.

- Billing tự động (webhook Stripe/VNPay)
- White-label / custom domain per tenant
- Native mobile app (Capacitor/React Native)
- Module Xếp sân ↔ điểm mùa/Elo (nếu product quyết định)
- Public API + developer portal

---

## Nguyên tắc phát triển sau GA

1. Module mới → `src/features/<module>/`
2. Feature preview → feature flag + SQL riêng + checklist QA
3. Không deploy production SQL mà chưa pass staging
4. RBAC luôn bật trên Preview/Production
5. Breaking change → CHANGELOG + migration note

---

## Liên kết

- `RELEASE_NOTES_v4.0.md` — chi tiết v4.0.0
- `docs/ARCHITECTURE.md` — kiến trúc hiện tại
- `AGENTS.md` — context sprint cho agent
