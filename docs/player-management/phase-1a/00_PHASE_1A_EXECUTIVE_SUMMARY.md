# Player Management Phase 1A — Executive Summary

**Product:** Pickleball Scheduler Pro / PICK_VN  
**Phase:** 1A — Contract & Inventory Freeze  
**Status:** Documentation freeze (no runtime cutover)  
**Branch:** `feature/player-phase-1-profile-foundation`  
**Baseline:** Player Management Phase 1 Read-Only Audit (2026-07-18)  
**Date:** 2026-07-18  

---

## Purpose

Phase 1A establishes the **official Player Management architecture contract** before any module skeleton, database migration, or production cutover.

This phase freezes:

1. Module ownership boundaries  
2. Canonical player identity rules  
3. Player Profile field dictionary  
4. Lifecycle / status separation  
5. Privacy and public vs internal profile contracts  
6. Legacy ID and data-source inventory  
7. Non-goals and Phase 1B entry criteria  

---

## Current-state verdict (from approved audit)

Player identity today is a **hybrid multi-SSOT system**:

| Layer | Role today |
|-------|------------|
| `club_data_v3.data.players[]` | Operational roster / scheduling / most tournament UX |
| `profiles` (+ `profiles.player_id`) | Auth account + demographics bridge |
| `athletes` / `club_members` | Emerging cloud personhood + membership |
| Rating / Ranking tables | Separate ID spaces keyed differently |

There is **no** `src/features/player/` module yet. Phase 1 must introduce Player Management as the **facade and future write owner** for athlete personhood without rewriting Competition Engine, Club Management, or Venue & Court.

---

## Canonical decision (frozen)

| Decision | Value |
|----------|--------|
| Canonical person key | `player_id` (text) |
| Auth-linked preferred form | `player-auth-{authUserId}` |
| Non-auth form | `player-{uuid}` |
| Rule | **Do not create another independent player identity store** |
| Linking rule | Linking an account to an existing player **must not** create a second player profile |
| Alias rule | `profiles.player_id`, `athletes.id`, blob `players[].id`, rating/ranking keys are **aliases or legacy references**, not separate people |

Resolution outcomes (official): `MAPPED` | `DERIVED` | `UNMAPPED` | `INVALID` | `AMBIGUOUS`

---

## Ownership snapshot

| Module | Owns | Does not own |
|--------|------|--------------|
| Identity & Authentication | Login, session, RBAC, account status, security audit | Canonical player profile CRUD |
| **Player Management** | Canonical `player_id`, profile, demographics, privacy, directory, verification (identity) | Membership, bookings, Elo math, brackets |
| Club Management | Membership edges + roster relationships | Person SSOT |
| Venue & Court | Customers, bookings, debts, packages | Player identity |
| Competition Engine | `ParticipantReference` / `ParticipantSnapshot` | Full player profile CRUD |
| Player Rating | Rating records linked to `player_id` | Demographics |
| Ranking | Ranking records linked to `player_id` | Demographics |

---

## Phase 1A deliverables

| File | Content |
|------|---------|
| `01_MODULE_BOUNDARIES.md` | Ownership matrix |
| `02_CANONICAL_PLAYER_ID_CONTRACT.md` | ID rules + resolution |
| `03_PLAYER_PROFILE_FIELD_DICTIONARY.md` | Field dictionary |
| `04_STATUS_AND_LIFECYCLE_MODEL.md` | Account / profile / membership / rating verification |
| `05_PRIVACY_AND_PROFILE_VISIBILITY.md` | Public vs internal |
| `06_LEGACY_ID_AND_DATA_SOURCE_INVENTORY.md` | ID space classification |
| `07_PHASE_1A_NON_GOALS_AND_GUARDRAILS.md` | Hard stop list |
| `08_PHASE_1B_ENTRY_CRITERIA.md` | Gate for skeleton work |
| `09_PHASE_1A_VALIDATION_REPORT.md` | Validation evidence |

---

## Explicit non-goals (Phase 1A)

- No migrations / no production data writes  
- No `src/features/player/` creation yet  
- No Competition / Club / Venue / Rating / Ranking runtime behavior changes  
- No production route changes  
- No data migration or deployment  

---

## Verdict stance

Phase 1A succeeds when documentation is complete, Owner-approved, and repository validation shows **no Phase 1A-caused regressions**. Pre-existing failures must be reported transparently and excluded from Phase 1A regression assessment.

See `09_PHASE_1A_VALIDATION_REPORT.md` for the measured verdict.
