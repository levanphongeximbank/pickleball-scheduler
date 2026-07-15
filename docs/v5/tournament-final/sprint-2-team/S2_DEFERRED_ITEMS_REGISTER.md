# Sprint 2 — Deferred Items Register

**Sprint:** Tournament V5 Sprint 2 · Team Tournament  
**Date:** 2026-07-14  
**Status:** Register only — items **not** closed inside S2 staging pilot

| ID | Item | Severity | Disposition | Notes |
|----|------|----------|-------------|-------|
| S2-GAP-070 | TT9-LIM-01 referee orientation remount freeze @900px | Medium UX | **DEFERRED** | Documented in S2-H; landscape cold-load OK |
| S2-GAP-051 | Legacy referee route fallback deprecation | Soft | **DEFERRED** | TT5 P1-4 — after Production go-live |
| S2-GAP-052 | Correction UX polish | Soft | **DEFERRED** | TT5 P1-5 — RPC đủ; polish post-pilot |
| S2-PROD-TTPARITY | **Prerequisite lớn nhất:** backend team-tournament Production ~TT-2, staging = TT-5 | P0 prod | **HOLD** | Verify 2026-07-15: Production 21 hàm `team_tournament_*` vs Staging ~90. Thiếu command framework, recompute, ops descriptors, forfeit/withdraw, lineup override/validate, dreambreaker. Phải nâng TT-2→TT-4 TRƯỚC Referee V5. Kế hoạch: `S2_REFEREE_V5_PRODUCTION_PLAN.md` |
| S2-PROD-REFV5 | **Prerequisite:** Referee V5 backend absent in Production | P0 prod | **HOLD** | Pre-check 2026-07-15: Production thiếu `match_live_states`, `match_result_revisions`, `referee_assignments`, `match_events`. Áp nền Referee V5 (`PHASE_V5A/V5D*/V5E1`) sau Tầng A, trước TT-5 |
| S2-PROD-TT5 | Production TT-5 SQL apply + E2E | P0 prod | **HOLD** | Owner 2026-07-15 chọn HOLD. Chặn cứng bởi S2-PROD-REFV5 (không thể áp TT-5 khi thiếu nền Referee V5) |
| S2-PROD-TT6 | Production `VITE_TT_REALTIME_ENABLED=true` | P0 prod | **DEFERRED** | Default OFF; S2-G gate blocks without override |
| OUT-MID-SUB | Mid-match official substitution | Out of S2 | **OUT OF SCOPE** | Owner locked pre-lock only |
| OUT-KO-DIRECT | Knockout-direct (no groups) | Out of S2 | **OUT OF SCOPE** | Owner locked group→KO only |

**Production readiness (pre-check 2026-07-15, read-only):**

| Nền | Production | Staging |
|-----|-----------|---------|
| Team Tournament (TT-1…TT-4) | ✅ có | ✅ có |
| Rating V5 | ✅ có | ✅ có |
| **Referee V5 backend** | ❌ **thiếu** | ✅ có |
| TT-5 bridge/outbox | ❌ chưa | ✅ có |

**Quyết định Owner 2026-07-15:** HOLD Production TT-5. Production **giữ nguyên trạng** (không áp SQL). Điều kiện mở lại: có kế hoạch riêng đưa nền Referee V5 lên Production, kèm rollback + E2E.
