# S1 — Individual Tournament: Final Scope

**Sprint:** Tournament V5 Sprint 1  
**Date:** 2026-07-14  
**Authority:** Owner GO — Tournament V5 Master Plan complete

---

## Sprint goal

Hoàn thiện **Giải cá nhân** (`internal_tournament`, `official_tournament`) từ **~78% functional baseline** lên **100% Sprint 1 Definition of Done**, sẵn sàng **staging pilot** (không production deploy).

---

## In scope

### Tournament modes
- ✅ Internal tournament (CLB giải cá nhân/đôi)
- ✅ Official tournament (multi-event, open registration, AI balance)

### Event types (all six)
- ✅ Đơn nam (`men_single`)
- ✅ Đơn nữ (`women_single`)
- ✅ Đôi nam (`men_double`)
- ✅ Đôi nữ (`women_double`)
- ✅ Đôi nam nữ (`mixed_double`)
- ✅ Đôi tự do (`open_double`)

### Functional areas (10)
1. Khởi tạo giải — create, config, statuses, registration window
2. Đăng ký — self-service, BTC ops, partner flow, fees
3. Seeding & draw — V5 seed, manual, random, balanced, publish/lock
4. Thể thức — RR, group→KO, final; third place (P1)
5. Lịch & sân — generate, courts, conflicts, min rest, publish/lock
6. Trọng tài & kết quả — assign, score, finalize, walkover, correction
7. Xếp hạng — CC-08 canonical, H2H, mini-table, forfeit/withdrawn
8. Rating V5 — eligibility, seed, post-match (doubles mandatory; singles waiver allowed)
9. UX/UI — BTC desktop/mobile, player mobile portal, core states
10. Security — RLS, RBAC, idempotency, version conflict

### Technical deliverables
- Implementation batches S1-A through S1-H
- New/extended automated tests per test plan
- Staging SQL migrations (referee/propagation) in sprint docs folder
- QA evidence JSON on staging pilot

### AI (limited)
- ✅ Seeding assistance (existing AI balance for official)
- ✅ Time estimate (`/tournament?ai=time`) — retain, no expansion
- ❌ Advanced AI beyond seed/draw/scheduling necessary for individual

---

## Out of scope (explicit)

| Item | Rationale |
|------|-----------|
| **Giải đồng đội** (`team_tournament`) | Separate track TT-9/10/11; no S1 changes except shared engine adapters |
| **Tournament Operations** beyond individual needs | MLP, dreambreaker, team lineup, etc. |
| **TV / Livestream** | `tournament-broadcast` — not S1 |
| **Public API** | Phase 11 API — not S1 |
| **V6 features** | Future roadmap |
| **Production deploy** | Owner constraint; staging pilot only |
| **Swiss system** | Contract placeholder — `runtimeSupported: false` |
| **Double elimination** | Contract placeholder — `runtimeSupported: false` |
| **Daily play** | Separate mode |
| **Rating V5 file changes** | Read-only consumption; Rating team owns V5 module |
| **Private pairing rules PR5** | Parallel track; not blocking S1 unless owner merges |

---

## Scope boundaries vs team tournament

| Capability | Team (existing) | Individual S1 target |
|------------|-----------------|------------------------|
| Cloud SQL + RPC | ✅ Phase 23 | Optional S1-GAP-001; blob-first acceptable for pilot |
| Registration portal | ✅ TeamPortal | Build individual equivalent |
| Eligibility/fees engines | ✅ Phase 25 | Generalize to individual |
| Draw/schedule publish | ✅ TT2E | Port to individual |
| Referee V5 + TT5 | ✅ Complete | Port match-level patterns |
| Realtime TT6 | ✅ Complete | Polling acceptable for pilot; realtime P1 |
| Standings TT-7 | ✅ Complete | Use CC-08 for individual |

**Rule:** Do not regress team tournament tests or RPC behavior.

---

## Singles / Rating V5 exception

Rating V5 **singles assessment** is not implemented (`SINGLES_NOT_IMPLEMENTED` in V5-B2 architecture).

| Event type | S1 Rating V5 requirement |
|------------|--------------------------|
| Doubles (all four types) | **Mandatory** — seed + post-match |
| Singles (đơn nam/nữ) | **Waiver allowed** — legacy Elo until V5-B singles; must document in owner sign-off |

Pilot recommendation: **doubles-only official open** for first staging dry-run.

---

## Format scope

| Format | S1 |
|--------|-----|
| Round Robin (group stage) | ✅ In scope |
| Group → Knockout | ✅ In scope |
| Knockout direct (no group) | P1 — implement if time in S1-G |
| Third place match | P1 |
| Final | ✅ In scope |
| Swiss | ❌ Out of scope V5 |
| Double elimination | ❌ Out of scope V5 |

---

## UX scope

| Surface | In scope | Notes |
|---------|----------|-------|
| BTC desktop | ✅ | Primary operator surface |
| BTC mobile | ✅ | Director + bracket; not full parity with TT9 |
| Player mobile | ✅ | Registration + my entries |
| Public spectator page | P1 | Read-only post-publish; defer if timeboxed |
| Referee token page | ✅ | Classic and/or V5 |
| Mock demo pages | ❌ | Must wire or hide from menu |

---

## Security scope

| Item | In scope |
|------|----------|
| RLS on new S1 tables/RPC | ✅ |
| Cross-tenant isolation verify | ✅ |
| RBAC organizer/referee/player | ✅ |
| Result correction permission | ✅ |
| Idempotency on finalize | ✅ |
| Optimistic version conflict | ✅ P1 |
| Offline score queue | P2 — document degraded behavior |

---

## Success metrics

| Metric | Target |
|--------|--------|
| DoD mandatory items | 62/62 (or 62 − singles waiver count) |
| P0 open gaps | 0 |
| `npm test` | PASS |
| Staging manual smoke | M1–M23 PASS |
| Production deploy | **None** |

---

## Document index (Sprint 1 Phase 1)

| File | Purpose |
|------|---------|
| `S1_INDIVIDUAL_CURRENT_STATE.md` | Architecture + ~78% baseline |
| `S1_INDIVIDUAL_GAP_MATRIX.md` | 57 gaps with P0–P3 |
| `S1_INDIVIDUAL_DEFINITION_OF_DONE.md` | 100% exit checklist |
| `S1_INDIVIDUAL_IMPLEMENTATION_PLAN.md` | Batches S1-A … S1-H |
| `S1_INDIVIDUAL_TEST_PLAN.md` | Automated + manual QA |
| `S1_INDIVIDUAL_FINAL_SCOPE.md` | This file |

---

## Change control

Scope changes require **owner written approval**. Additions to in-scope (e.g., Swiss, public API, production deploy) trigger sprint replan.

**Phase 1 status:** Discovery complete — **awaiting owner review before S1-A implementation.**
