# V5.0 — Commercial GA Blocker Register

**Ngày:** 2026-07-04  
**Version:** `5.0.0-rc1`  
**Audit baseline:** 68/100 — V5.0 SaaS MVP / Preview RC1  
**Cập nhật:** Phase 21 Commercial Readiness Program

---

## Severity legend

| Level | Ý nghĩa |
|-------|---------|
| **P0** | Chặn Production deploy hoặc Commercial GA |
| **P1** | Chặn Commercial GA rộng; có thể pilot có giới hạn |
| **P2** | Tech debt — không chặn pilot staging 1 sân |

---

## Blocker register

| ID | Blocker | Severity | Owner | Evidence hiện tại | Điều kiện close | Phase đề xuất |
| -- | ------- | -------- | ----- | ----------------- | --------------- | ------------- |
| B01 | Production SQL #21/#22 chưa reconcile/apply PASS | **P0** | DevOps / Owner | Production DB trống; #21 NEEDS APPLY; #22 BLOCKED — `PHASE_21_PRODUCTION_SQL_RECONCILIATION.md` | Owner tick V21-1→V21-8 + C0→C7 trên Production | Phase 21 → 19B |
| B02 | Staging Supabase key/script còn blocked | **P0** | Owner | Phase 20B: `Unregistered API key` — script BLOCKED | `npm run test:verify-staging-env` PASS + billing mapping PASS | Phase 21 Workstream A |
| B03 | Owner staging smoke chưa PASS | **P0** | Owner | `PHASE_20B_OWNER_STAGING_SMOKE_CHECKLIST.md` — 0/17 | 17 mục tick + ghi ngày | Phase 20B closure |
| B04 | Mobile device QA chưa PASS | **P1** | Owner | `PHASE_20_MOBILE_PILOT_QA.md` — Android/iPhone PENDING | ≥1 OS PASS pilot; GA cần cả hai | Phase 20B / 21 |
| B05 | Court Engine còn localStorage | **P1** | Engineering | `courtEngineStorage.js` — tenant-scoped keys nhưng local only | Cloud persistence hoặc owner chấp nhận pilot limitation | Phase 22 |
| B06 | Club/persistence chưa cloud-native | **P1** | Engineering | `club_data_v3` + `syncClubToCloud()` có nhưng không default path | Tenant-scoped cloud repo + migration path | Phase 22 |
| B07 | Payment gateway còn mock/dev | **P0** | Engineering / Owner | `VITE_PAYMENT_MODE=dev`; providers stub | Payment staging PASS + webhook verify | Phase 23 |
| B08 | Billing production env chưa verify | **P0** | DevOps | Production chưa deploy; SQL #16–17 chưa apply prod | Prod billing RPC + tenant mapping script on prod creds | Phase 19B + 21 |
| B09 | API marketplace chưa production smoke | **P1** | Engineering | Staging 11E PASS; `VITE_API_ENABLED=false` prod | Prod test tenant API smoke sau #21 | Phase 21 preflight |
| B10 | Monitoring/error tracking chưa có | **P1** | DevOps | No Sentry/integration documented | Tool chọn + alert rules + 24h baseline | Phase 21 preflight |
| B11 | Backup/PITR chưa có hoặc chưa nâng plan | **P0** | DevOps | Supabase Free/Nano — no backup UI | Nâng plan hoặc documented export cadence + owner sign-off | Phase 21 preflight |
| B12 | Legal/ToS/privacy chưa sẵn sàng | **P0** | Legal / Owner | Không có published ToS/Privacy trong repo | Legal review + publish URLs trước GA | Phase 21+ |
| B13 | Support/runbook chưa hoàn chỉnh | **P1** | Owner | Partial — staging checklist only | Billing lock + QR + backup runbook | Phase 21 preflight |
| B14 | Lint warnings legacy 128 | **P2** | Engineering | `npm run lint` — 0 errors, 128 warnings | Optional cleanup sprint — không blocker pilot | Backlog |
| B15 | Dev/demo fallback cần audit production path | **P1** | Engineering | `VITE_SEED_DEMO`, dev login paths | Prod env audit: demo OFF + no bypass | Phase 21 preflight |

---

## Summary by gate

| Gate | Open P0 | Open P1 |
|------|---------|---------|
| Gate 1 — Staging Pilot | B02, B03 | B04 |
| Gate 2 — Production SQL | B01 | — |
| Gate 3 — Production Runtime | B08, B11 | B09, B10, B13, B15 |
| Gate 4 — Commercial Beta | B07 | B05, B06, B04 |
| Gate 5 — Commercial GA | B07, B11, B12 | B05, B06, B10, B13 |

---

## Không phải blocker (đã PASS Phase 20)

- Automated tests 769/769  
- `no_subscription` operational lock  
- `OperationalRouteGate` wired  
- Court Engine tenant-scoped localStorage keys  
- Version `5.0.0-rc1` aligned  
- KN-6 / 11E staging QA PASS  

---

## Tham chiếu

| File | Mục đích |
|------|----------|
| `docs/v5/V5_COMMERCIAL_GA_MASTER_PLAN.md` | Gates + decision tree |
| `docs/v5/PHASE_21_COMMERCIAL_READINESS_REPORT.md` | Phase 21 verdict |
| `docs/v5/PHASE_13_V5_FULL_SOFTWARE_AUDIT.md` | 68/100 baseline |
