# Pickleball Scheduler Pro

**Version hiện tại:** v4.0.0 GA  
**Release Date:** 2026-07-01  
**Trạng thái:** General Availability — Sprint 1–12 hoàn tất

---

## v4.0.0 GA — General Availability (Sprint 12)

Sprint phát hành cuối Version 4. Không thêm tính năng mới.

- Production env checklist: `docs/GA-PRODUCTION-ENV-CHECKLIST.md`
- SQL production (15 bước, chạy thủ công): `docs/SUPABASE-PRODUCTION-CHECKLIST.md`
- QA production 8 roles: `docs/GA-PRODUCTION-QA.md`
- Final audit: `docs/GA-FINAL-AUDIT.md`
- Release notes: `RELEASE_NOTES_v4.0.md`
- Deploy: `DEPLOYMENT_GUIDE.md`

**RBAC production:** `VITE_RBAC_ENABLED=true` (bắt buộc trên Vercel Production)

---

## v4.0.0-rc.1 — Release Candidate (Sprint 11)

- Lint 0 errors, 551+ unit tests pass
- RBAC default true trên production build
- `docs/RELEASE-4.0-RC.md`, `docs/RBAC-RC-QA.md`

---

## v4.0.0-beta — Sprints 1–10

| Sprint | Module |
|--------|--------|
| 1 | Identity Phase A |
| 2 | Multi-tenant |
| 3 | Club Management |
| 4 | Subscription |
| 5 | Tournament Engine |
| 6 | Court Engine |
| 7 | AI Assistant |
| 8 | Dashboard Analytics |
| 9 | Mobile / PWA / QR |
| 10 | API / Marketplace preview |

---

## v3.5.x (legacy)

v3.5.3–v3.5.8: Auth, RBAC, RLS staging, security hardening, referee RPC.  
Xem lịch sử chi tiết trong `CHANGELOG.md`.

---

## Roadmap sau GA

Xem `ROADMAP.md` — v4.1 stabilization, v4.2 preview→prod, v5.0 platform.
