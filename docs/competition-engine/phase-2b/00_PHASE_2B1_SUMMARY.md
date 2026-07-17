# Phase 2B.1 — Participant Model Inventory and Contract Design

**Phase:** 2B.1  
**Date:** 2026-07-17  
**Revalidated:** 2026-07-17 against latest `origin/main`  
**Mode:** Design / audit only — **no Production runtime change**  
**Prerequisite:** Phase 2A CLOSED (PR #37, merge `fd044362`, Architecture lock PASS, Competition Core flags OFF)

**Branch:** `docs/competition-engine-phase-2b1-participant-design`  
**Parent:** `45442d54c0f374b21baf3dc485700c98527d9f43` (= latest `origin/main` at revalidation)

---

## Verdict

```text
PHASE 2B.1 REVALIDATED — READY TO COMMIT
```

Inventory, semantic boundaries, canonical contracts, Core vs Format ownership, lifecycle/locking, and Phase 2B.2 plan are complete. OD-01…OD-10 are **OWNER APPROVED**. Phase 2B.2 remains **NOT STARTED** pending explicit Owner GO.

---

## What Phase 2B.1 answers

| # | Question | Answer (summary) |
|---|----------|------------------|
| 1 | Người tham gia được định danh như thế nào? | Nhiều lớp ID không đồng nhất: `players.id` (blob), `athletes.id` (Phase 42B), `profiles.id` (auth), `entry.id`, `team.id`, roster/lineup slots. Không có canonical `CompetitionParticipant` runtime. Canonical: `ParticipantReference` + `CompetitionParticipant`. |
| 2 | Một người có thể tham gia nhiều nội dung? | **Có** (OD-02 APPROVED). Unique active: `(competition, division, category, entryRole)`. |
| 3 | Entry khác Participant? | `Participant` = người/tổ chức có quyền tham gia. `Entry` = đăng ký cụ thể vào competition (+ optional division/category). Không được gộp. |
| 4 | Team / Roster / Lineup? | `Team` = đơn vị thi đấu. `Roster` = danh sách hợp lệ. `Lineup` = chọn người cho match/tie/round — **versioned** (OD-06). |
| 5 | Daily / Team / Individual dùng model nào? | Daily: `player.id` trực tiếp, không Entry. Team V6: `team` + `playerIds` + lineup. Individual/Internal/Official: `entry` + `playerIds[]`. |
| 6 | Format-specific không vào Core? | MLP gender, captain, hidden lineup, Dreambreaker, Daily rotation/queue, singles/doubles partner policy, Official open rules. |
| 7 | Immutable sau khi giải bắt đầu? | Entry identity; roster after `ROSTER_LOCKED` (OD-04); seed after `SEED_LOCKED` (OD-09); substitution default NOT ALLOWED (OD-05). |
| 8 | Cần versioning? | Lineup full revision chain (OD-06). Participant/Entry snapshots at registration/lock (OD-08). |
| 9 | Core sở hữu contract nào? | Identity refs, Entry/Registration status, Eligibility result shape, Division/Category refs, Team/Roster/Lineup structure, validation result, audit metadata. |
| 10 | Format sở hữu policy nào? | TT MLP/captain/hidden/DB/tie/forfeit; Daily rotation/walk-in; Individual partner/open registration; when to emit lock events. |

---

## Deliverables index

| File | Purpose |
|------|---------|
| `01_PARTICIPANT_IMPLEMENTATION_INVENTORY.md` | Inventory mọi model/DTO/table liên quan |
| `02_IDENTITY_AND_REFERENCE_MODEL.md` | Identity layers + reference strategy |
| `03_CANONICAL_PARTICIPANT_CONTRACTS.md` | Contract proposal |
| `04_ENTRY_REGISTRATION_ELIGIBILITY.md` | Entry / Registration / Eligibility |
| `05_TEAM_ROSTER_LINEUP_MODEL.md` | Team / Roster / Lineup |
| `06_DIVISION_CATEGORY_MODEL.md` | Division vs Category |
| `07_CORE_VS_FORMAT_OWNERSHIP.md` | Ownership matrix |
| `08_LEGACY_TO_CANONICAL_MAPPING.md` | Format mapping + adapters |
| `09_LIFECYCLE_AND_LOCKING.md` | Status + lock rules |
| `10_PHASE_2B2_IMPLEMENTATION_PLAN.md` | Next phase plan (not started) |
| `11_RISKS_AND_OPEN_DECISIONS.md` | Risks + OD-01…OD-10 **OWNER APPROVED** |

---

## Scope compliance

| Constraint | Status |
|------------|--------|
| No big-bang rewrite | ✅ |
| No new format | ✅ |
| No TT V6 behavior change | ✅ |
| Competition Core flags OFF | ✅ (untouched) |
| No Production DB migration | ✅ |
| No Production execution path change | ✅ |
| No legacy model deletion | ✅ |
| No Phase 2B.2 start | ✅ |
| Core must not import format modules | ✅ (design only) |
| Contracts independent of React/Supabase/pages | ✅ |

---

## Phase 2A revalidation

| Document | Status |
|----------|--------|
| `docs/competition-engine/00`–`13` | Available (local untracked audit copies may exist; Phase 2A tracked docs on main) |
| `14_OWNER_DECISION_MATRIX.md` | **READ** on latest main |
| `15_PHASE_2A_ARCHITECTURE_BOUNDARIES.md` | **READ** on latest main |
| `docs/audit/PICK_VN_*` | Context only |

Earlier Phase 2B.1 claim that docs 14/15 were **MISSING** was invalid: survey ran on stale `main` @ `13db3a3` before Phase 2A merge `fd044362` and tip `45442d54`.

### Boundary checks (no full re-audit)

| Topic | Result |
|-------|--------|
| Public Core API | Participant work must enter via `competition-core/index.js` |
| Dependency ownership | Core → format/pages/React/Supabase forbidden |
| Grandfathered violations | 13 baseline; 2B.1 docs add none |
| Participant ownership | Matrix: **APPROVE** start 2B; teams/roster/lineup KEEP IN FORMAT |
| Persistence ports | **APPROVE** start 2B — interfaces only in 2B.2 |
| Phase 2B entry criteria | Design gate satisfied for participant contracts; runtime cutover still blocked |

### Changes after revalidation

1. Closed risk R4 (14/15 missing).
2. Bound OD-01…OD-10 to **OWNER APPROVED** text (see `11_`).
3. Corrected OD-10: waitlist owned by **Registration** (not Entry provisional).
4. Named lifecycle markers `ROSTER_LOCKED` / `SEED_LOCKED`.
5. Updated 2B.2 plan: contracts/validators/ports only; provisional defaults retired.
6. Aligned contract notes in `02`–`06`, `09` with approved ODs.

**No Owner decision contradicted Phase 2A or forced a blocker.**

---

## Production / DB / Flag impact

| Area | Impact |
|------|--------|
| Production runtime | **None** |
| Database schema | **None** |
| Feature flags | **None** |
| Dependency violations | **None new** (grandfathered 13 unchanged) |
| Code commits | **Not created in this turn** (report-only; Owner may commit next) |

---

## Phase 2B.2 readiness

Contracts and Owner policies are ready for a **shadow/contract-only** Phase 2B.2 **after** explicit Owner GO.

**Do not auto-start Phase 2B.2.**
