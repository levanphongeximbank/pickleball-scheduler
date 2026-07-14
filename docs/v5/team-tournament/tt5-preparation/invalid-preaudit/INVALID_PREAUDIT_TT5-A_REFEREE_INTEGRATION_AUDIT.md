INVALID PRE-AUDIT DRAFT

Tai lieu nay duoc tao truoc khi Referee V5 co source SHA tai tao duoc.
Khong duoc su dung lam TT-5A evidence hoac implementation authority.

---

# TT-5A â€” Referee Integration Audit

**Phase:** TT-5A (read-only audit â€” no code changes)  
**Date:** 2026-07-13  
**Staging:** `qyewbxjsiiyufanzcjcq`  
**Production:** `expuvcohlcjzvrrauvud` (untouched)

---

## 1. Repository state (owner request)

| Item | Value |
|------|--------|
| **Current branch** | `feature/competition-core-standardization` |
| **HEAD SHA** | `92142dbe374f71dc8033cfaf3bcdbdfdd90950f4` |
| **Working tree** | Dirty â€” many untracked V5 QA/docs/scripts; modified TT2/TT4 evidence JSON, `package.json`, router/auth/nav |
| **Recommended integration branch** | `feature/tt5-referee-v5-integration` (from latest base â€” **not created in TT-5A**) |
| **Open Draft PR** | PR #2 `qa/team-tournament-pilot-preparation` â€” per owner: **keep Draft**, do not use for TT-5 dev |
| **`gh` CLI** | Not available in current shell â€” PR status from owner spec |

### Referee V5 footprint

- **Module:** `src/features/referee-v5/` (~77 files)
- **Edge:** `supabase/functions/referee-v5-match/`
- **SQL phases:** `docs/v5/referee-v5/PHASE_V5A_*` through `PHASE_V5E1_*`
- **QA evidence:** `docs/v5/qa-evidence/phase-v5d41/`, `phase-v5e1/`
- **UI entry:** `/dev/referee-v5` (SuperAdmin, feature-flagged)
- **Staging verdict:** GO (V5-D.4.1, V5-E1)

### Team Tournament footprint

- **Module:** `src/features/team-tournament/` (~69 JS files)
- **Legacy referee UI:** `src/pages/tournament/TeamRefereePortal.jsx`
- **Route:** `/team-referee/:tournamentId`
- **Engine:** `teamRefereeEngine.js`, `rallyScoringEngine.js`, `teamResultEngine.js`, `teamStandingsEngine.js`
- **SQL phases:** `docs/v5/PHASE_23*.sql`, `PHASE_TT1B_*` through `PHASE_TT4_*`
- **QA evidence:** `docs/v5/qa-evidence/phase-tt1c/`, `phase-tt4/`, etc.

### Staging migrations (Referee V5 â€” applied per QA evidence)

| Phase | SQL | Staging status |
|-------|-----|----------------|
| V5-A foundation | `PHASE_V5A_REFEREE_FOUNDATION.sql` | Applied |
| V5-D persistence | `PHASE_V5D_REFEREE_PERSISTENCE.sql` | Applied |
| V5-D1 hardening | `PHASE_V5D1_REFEREE_HARDENING.sql` | Applied |
| V5-D3.2 idempotency/undo | `PHASE_V5D32_IDEMPOTENCY_UNDO.sql` | Applied |
| V5-D4 atomic rollback | `PHASE_V5D4_ATOMIC_ROLLBACK.sql` | Applied |
| V5-E1 realtime | `PHASE_V5E1_REALTIME_SYNC.sql` | Applied (`match_live_states` in `supabase_realtime`) |

Team Tournament SQL applied incrementally via phase scripts (TT-1B, TT-2*, TT-4, etc.) â€” see `docs/v5/TEAM_TOURNAMENT_TT1B_IMPLEMENTATION.md`.

**Production:** Referee V5 **not** enabled. Team Tournament cloud flag production posture per Phase 23E docs.

### Feature flags (relevant)

| Flag | Typical | Track |
|------|---------|-------|
| `VITE_REFEREE_V5_ENABLED` | `false` prod / `true` staging QA | Referee V5 UI |
| `VITE_REFEREE_V5_DATA_MODE` | `remote` on staging preview | Edge persistence |
| `VITE_REFEREE_V5_REALTIME_ENABLED` | `true` when remote | V5-E1 |
| `VITE_TEAM_TOURNAMENT_SUPABASE` | staging/preview `true` | TT cloud RPC |
| `VITE_TEAM_TOURNAMENT_DATA_MODE` | `legacy` / `shadow` / `cloud_primary` | TT-1C repository |
| `VITE_TEAM_TOURNAMENT_STORE_MODE` | blob/memory | TT local store |

---

## 2. Current architecture â€” three parallel referee tracks

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Classic referee                                                  â”‚
â”‚ Route: /referee/:token, /referee/match/:matchId                 â”‚
â”‚ State: tournament_match_live (blob + legacy RPC)                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Team Tournament referee (legacy)                                 â”‚
â”‚ Route: /team-referee/:tournamentId                               â”‚
â”‚ State: team_tournament_sub_matches.score (draft/confirm)         â”‚
â”‚ Engine: teamRefereeEngine + rallyScoringEngine                   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Referee V5 (staging-ready, isolated)                             â”‚
â”‚ Route: /dev/referee-v5                                           â”‚
â”‚ State: match_live_states + match_events                          â”‚
â”‚ Engine: event-driven match state engine                          â”‚
â”‚ Realtime: V5-E1 on match_live_states                             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**No application wiring** between Team Tournament and Referee V5 exists today.

---

## 3. Integration readiness assessment

| Capability | Team Tournament | Referee V5 | Gap for TT-5 |
|------------|-----------------|------------|--------------|
| Live score during rally | Draft on `sub_matches.score` | `match_live_states` + events | Replace draft path |
| Server/receiver/positions | Not implemented | Full engine + UI | TT-5E UI route |
| Event history | Audit logs only | Append-only `match_events` | TT-5D consumer |
| Atomic commit | TT-1B on confirm | V5-D on every command | Different lifecycle |
| Idempotency | `team_tournament_command_log` | `match_sync_mutations` | Align at finalize boundary |
| Realtime multi-device | Polling in `useTeamTournamentPage` | V5-E1 Realtime | TT inherits via V5 |
| Finalize â†’ standings | `confirm_sub_match` RPC | Outbox (no consumer) | **TT-5D critical** |
| Match provisioning | Sub-match row on publish | Seed-only; no create API | **TT-5C critical** |
| Referee assignment | TT permissions + blob roster | `referee_assignments` | **TT-5C** |

---

## 4. Proposed integration model (TT-5 target)

```text
Team Tournament                    Referee V5
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€                  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
team_tournament                    tenant_id (venue)
  â””â”€â”€ matchup                        â””â”€â”€ tournament_id
        â””â”€â”€ sub_match (1:1)              â””â”€â”€ match_id = external_sub_match_id
              â”‚                                â””â”€â”€ match_live_states
              â”‚                                â””â”€â”€ match_events
              â””â”€â”€ summary fields â—„â”€â”€ finalize â”€â”€ match_result_revisions
                    (after only)         â””â”€â”€ match_integration_outbox
                                              â””â”€â”€ TEAM_SUB_MATCH_FINALIZED (new)
                                                    â””â”€â”€ TT consumer (TT-5D)
```

**Principle (locked):** Referee V5 is the **on-court authority** for a sub-match. Team Tournament receives **official finalized results only** for team score and standings.

---

## 5. Route migration plan

| Route | Today | TT-5 target |
|-------|-------|-------------|
| `/team-referee/:tournamentId` | Full legacy scoring UI | List sub-matches â†’ link to V5 workspace |
| `/referee/match/:matchId` | Legacy session scoreboard | **Unified** Referee V5 workspace (TT-5E) |
| `/dev/referee-v5` | Dev/staging prototype | Staging QA only; production uses `/referee/match/:id` |

Legacy `/team-referee` **kept temporarily** (owner decision 3) until TT-5F PASS.

---

## 6. Gaps requiring TT-5Bâ€“TT-5F (not TT-5A)

1. **Shared match contract** (`CompetitionMatch`, participants, format) â€” TT-5B  
2. **`TeamTournamentRefereeAdapter`** â€” create live state, map participants, open workspace â€” TT-5C  
3. **Outbox consumer** + `TEAM_SUB_MATCH_FINALIZED` event â€” TT-5D  
4. **UI integration** from sub-match list â€” TT-5E  
5. **Staging QA** (4 disciplines, finalize, standings, override) â€” TT-5F  

---

## 7. SQL for TT-5 (future â€” DRAFT NOT APPLIED)

Per owner spec: `PHASE_TT5_REFEREE_INTEGRATION.sql` should add only:

- Link fields or thin bridge table  
- Outbox consumer support / propagation RPCs  
- RLS for integration paths  
- Idempotency for result propagation  

Must **not** recreate V5 core tables.

---

## 8. Owner decisions â€” audit alignment

| # | Decision | Audit recommendation |
|---|----------|------------------------|
| 1 | One shared referee workspace | **APPROVE** â€” `/referee/match/:id` â†’ Referee V5 |
| 2 | Sub-match = one V5 match | **APPROVE** â€” map via `external_sub_match_id` |
| 3 | Keep legacy temporarily | **APPROVE** â€” deprecate after TT-5F |
| 4 | Offline (V5-E2) | **Do not block TT-5**; block production if offline required |
| 5 | MLP rally | **NOT INCLUDED** |
| 6 | Standings from finalize only | **APPROVE** â€” align with outbox consumer |

---

## 9. Related documents

- `TT5-A_DATA_MAPPING.md` â€” field-level mapping  
- `TT5-A_DUPLICATE_LOGIC_REPORT.md` â€” dual-engine risks  
- `TT5-A_FINAL_VERDICT.md` â€” GO/NO-GO for TT-5B  

