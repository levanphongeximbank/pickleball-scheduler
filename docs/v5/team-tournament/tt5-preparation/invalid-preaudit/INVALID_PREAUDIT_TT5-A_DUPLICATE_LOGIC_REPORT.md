INVALID PRE-AUDIT DRAFT

Tai lieu nay duoc tao truoc khi Referee V5 co source SHA tai tao duoc.
Khong duoc su dung lam TT-5A evidence hoac implementation authority.

---

# TT-5A â€” Duplicate Logic Report

**Risk:** Two authoritative scoring/result engines running in parallel for the same sub-match.

---

## 1. Engines at risk of duplication

| Concern | Team Tournament (legacy) | Referee V5 | Severity if both active |
|---------|--------------------------|------------|-------------------------|
| **Live score** | `saveSubMatchDraft` â†’ `sub_matches.score` | `apply-command` â†’ `match_live_states` | **P0** â€” two live scores |
| **Winner** | `confirmSubMatchResult` â†’ `winner_team_id` | Finalize â†’ `match_result_revisions` | **P0** â€” conflicting winners |
| **Game/rally rules** | `rallyScoringEngine` (21, win-by-2) | Side-out / singles / basic rally engines | **P0** â€” different outcomes |
| **Server/receiver** | Not implemented | Full rotation + diagonal | N/A today; don't reimplement in TT |
| **Undo** | None on legacy TT referee | `UNDO_LAST_EVENT` + replay | **P1** â€” TT unaware of undo |
| **Match status** | `waiting/playing/completed/forfeit` | `not_started/in_progress/locked/completed` | **P1** â€” desync |
| **Standings** | `teamStandingsEngine` (client) | Outbox `STANDINGS_RECALC_REQUESTED` (no consumer) | **P0** if both compute |
| **Matchup aggregate** | `teamResultEngine.computeMatchupResult` | Not implemented (TT-5D) | **P1** â€” SQL vs client divergence |
| **Idempotency** | `team_tournament_command_log` | `match_sync_mutations` | **P1** â€” duplicate applies at boundary |
| **Realtime** | Poll in `useTeamTournamentPage` | V5-E1 Realtime | **P2** â€” redundant refresh |

---

## 2. Duplicate paths today (within Team Tournament alone)

Even before V5 integration, Team Tournament has **internal duplication**:

### 2.1 Draft vs confirm routing asymmetry

| Action | Path (`cloud_primary`) |
|--------|------------------------|
| Save draft | Always **legacy** `refereeSaveSubMatchDraft` |
| Confirm | **Cloud repository** â†’ RPC |

Risk: draft never hits cloud SSOT in primary mode; confirm does.

### 2.2 Standings â€” three mechanisms

1. **Client:** `computeTeamStandings` in `teamStandingsEngine.js` after local confirm  
2. **Client push:** `cloudSyncStandingsAfterMutation` â†’ `team_tournament_upsert_standings`  
3. **Server (TT-4):** `team_tournament_recompute_standings_cache` on forfeit/withdraw only  

`team_tournament_confirm_sub_match` (TT-1B) updates matchup `result` jsonb but **does not** always recompute standings cache or set matchup `completed`.

**TT-5 must pick one authoritative standings path** â€” recommend server recompute triggered by finalize consumer (align TT-4 pattern).

### 2.3 Matchup aggregation â€” client vs SQL

| Logic | Location | Includes dreambreaker / early win? |
|-------|----------|-----------------------------------|
| Client | `teamResultEngine.js` | Yes (MLP/dreambreaker rules) |
| Server | TT-1B `confirm_sub_match` SQL | Partial â€” winner count only |

Risk: cloud `matchups.result` differs from blob after same inputs.

---

## 3. Failure scenarios if TT-5 merges without cutover

| Scenario | Symptom |
|----------|---------|
| Referee uses V5; BTC uses legacy portal | Two scores, one sub-match |
| V5 finalize; TT never consumes outbox | V5 locked; `sub_matches` still `playing` |
| TT confirm runs after V5 finalize | Standings double-count |
| V5 undo; TT summary unchanged | UI/standings wrong |
| Admin edits `sub_matches.score` directly | Event history diverges |
| Rating reads V5 revision; standings read TT summary | Different match outcomes |

---

## 4. Required cutover rules (TT-5Bâ€“D)

### During match (live)

```text
ONLY Referee V5 may mutate live state.
Team Tournament sub_matches.score is READ-ONLY or deprecated for live.
Legacy saveSubMatchDraft MUST be disabled when V5 link exists.
```

### At finalize

```text
ONLY Referee V5 finalize creates official result revision.
Team Tournament confirm_sub_match for scoring MUST NOT run in parallel.
TT-5D consumer is the sole writer to sub_matches summary + standings.
```

### Legacy portal

```text
/team-referee/:id â†’ list + deep link to /referee/match/:externalSubMatchId
Remove score entry UI for V5-linked sub-matches.
Keep forfeit/withdraw via TT-4 paths until unified in TT-5F.
```

---

## 5. Logic to **retire** (not port to V5)

| Component | Action |
|-----------|--------|
| `rallyScoringEngine` for on-court rally | Replace with V5 command dispatch |
| `saveSubMatchDraft` live score mutation | Remove for V5-linked matches |
| Manual confirm score UI in `TeamRefereePortal` | Replace with finalize in V5 workspace |
| Client-only standings after confirm | Replace with server consumer |

---

## 6. Logic to **keep** in Team Tournament

| Component | Reason |
|-----------|--------|
| `teamResultEngine` (tie aggregation) | Team-level â€” not per-rally |
| `teamStandingsEngine` (tiebreak rules) | Config-driven; run server-side after finalize |
| Lineup / publish / forfeit / withdrawal | TT domain |
| `team_tournament_get_setup` | Read model for portals |
| Audit logs | TT operational audit |

---

## 7. Logic to **not duplicate** in adapter (TT-5C)

`TeamTournamentRefereeAdapter` must **not** contain:

- Rally scoring  
- Server rotation  
- Side-out rules  
- Undo/replay  
- Finalize business rules  

Adapter only: provision, participant map, open route, consume official result metadata.

---

## 8. Priority matrix for TT-5 sub-phases

| Priority | Item |
|----------|------|
| **P0** | Single live score source (V5) |
| **P0** | Single finalize â†’ standings path (outbox consumer) |
| **P0** | Disable legacy confirm for V5-linked sub-matches |
| **P1** | Unify draft/confirm routing in TT orchestrator |
| **P1** | Server-side standings on finalize |
| **P2** | Remove TT polling when V5 Realtime active on referee view |

---

## 9. Regression surfaces

Tests that must pass after cutover:

- `tests/team-tournament-referee.test.js` â€” adapt or split legacy vs V5  
- `tests/referee-v5/*.test.js` â€” no regression  
- HTTP 18/18, browser E2E 25/25, V5-E1 8/8  
- TT-4 forfeit/withdraw â€” must not double-apply with V5 finalize  

