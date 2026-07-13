# TT-6A — Security & RLS Audit

**Date:** 2026-07-13  
**Production:** UNTOUCHED  
**Scope:** Design-time audit for TT-6 Realtime — builds on TT-5A + V5-E1

---

## 1. Security model summary

| Layer | Role |
|-------|------|
| **RLS on published tables** | Primary gate — Realtime respects JWT policies |
| **Scoped WAL filters** | Defense-in-depth — reduce noise, not sole security |
| **Snapshot RPC reload** | Authoritative read — same as current polling path |
| **Client envelope filter** | UX only — **NOT** security boundary |

**P0 rule:** Client filtering must never be described as the main security control.

---

## 2. P0 requirements checklist

| # | Requirement | Current state | TT-6 design |
|---|-------------|---------------|-------------|
| S1 | Captain A cannot receive lineup B pre-publish | **PASS** via `team_tournament_get_visible_lineups` RPC | RLS on lineup rows + no broad publication |
| S2 | Captain B cannot receive lineup A pre-publish | **PASS** (same) | Same |
| S3 | Cross-tenant blocked | **PASS** — `team_tournament_assert_tenant` | Realtime inherits tenant RLS |
| S4 | Regular player no referee payload | **PASS** — no assignment | No V5 channel without assignment |
| S5 | Expired/revoked referee blocked | **PASS** — TT-5D staging | RLS + access guard RPC |
| S6 | Outbox/inbox not client-visible | **PASS** — `match_integration_outbox_no_client` | **NEVER publish** these tables |
| S7 | Command log not public | **PASS** | **NEVER publish** |
| S8 | Client filter not primary security | **PARTIAL** — legacy match-live uses client tournament filter | TT-6 must not repeat pattern |

---

## 3. Supabase Realtime publication audit

### 3.1 Currently published (known)

| Table | Publication | Client path | Risk |
|-------|-------------|-------------|------|
| `match_live_states` | `supabase_realtime` (V5-E1 SQL) | Referee V5 authenticated | Low — assignment RLS |
| `tournament_match_live` | Legacy docs | Director club filter | **Medium** — club-wide filter |
| `court_engine_*` | AI v52 SQL | Court engine | Out of TT-6 scope |

### 3.2 Team Tournament tables — NOT published (correct for now)

- `team_tournament_sub_matches`
- `team_tournament_matchups`
- `team_tournament_lineups`
- `team_sub_match_referee_links`
- `team_tournament_standings_cache`
- `referee_assignments` (verify before any publish)

**TT-6A recommendation:** Add to publication **only after** RLS policies proven in staging (see SQL proposal).

---

## 4. RLS policies required before publication

### 4.1 `team_tournament_lineups`

Proposed policy pattern:

```sql
-- Conceptual — full SQL in TT6-A_SQL_PROPOSAL.md
-- SELECT allowed when:
--   team_tournament_assert_tenant(tenant_id)
--   AND (
--     team_tournament_can_manage()
--     OR (captain_of_team(team_id) AND ... own row ...)
--     OR (matchup published AND participant_can_see_matchup(...))
--   )
```

**Pre-publish:** captain sees **only** `team_id = own_team`.

### 4.2 `team_tournament_sub_matches`

- Tenant assert + tournament participation (manage, captain of either team, assigned referee for linked sub-match).
- Referee read scoped via `team_sub_match_referee_links` + active assignment.

### 4.3 `team_sub_match_referee_links`

- BTC manage: full CRUD via existing TT-5B patterns
- Referee: SELECT own linked match only when assignment active
- Captain: **no direct SELECT** — observe via setup reload only (optional)

### 4.4 `referee_assignments`

Already has user-scoped SELECT in V5 foundation. Realtime delivery must match `referee_v5_current_user_has_assignment()`.

---

## 5. Lineup visibility — server contract (existing)

**RPC:** `team_tournament_get_visible_lineups(p_tournament_id, p_matchup_id, p_viewer_team_id)`

- Server resolves viewer team from JWT/profile — cloud repo **rejects client `viewerTeamId` override** (`VIEWER_TEAM_ID_CLIENT_OVERRIDE_REJECTED`).
- Pre-publish: opponent lineup omitted.
- Realtime must **not** bypass this by pushing opponent selections.

**Realtime flow:** event hint → `getVisibleLineups` → render.

---

## 6. Referee assignment scope (TT-5D — frozen)

| Check | Mechanism |
|-------|-----------|
| Tenant/tournament/match scope | `team_tournament_referee_match_access_ops` |
| Expired | `referee_assignment_expired` |
| Revoked | revoke flag + reason |
| Wrong user | `REFEREE_NOT_ASSIGNED` |

Realtime subscription must use same JWT user; RLS denies row → no WAL delivery.

**UI must not show "live" badge when access guard fails** — show `unauthorized` state.

---

## 7. Payload shape audit

| Source | Sensitive fields | TT-6 handling |
|--------|------------------|---------------|
| `match_live_states` WAL | `state_payload` | Extract metadata only (V5 pattern) |
| Lineup row WAL | `selections` JSON | **Do not forward** in envelope pre-publish; post-publish reload via RPC |
| Sub-match WAL | scores | Minimal summary in envelope; full reload for standings |
| Bridge row | internal sync errors | BTC only via RLS |

---

## 8. Broadcast topics

**Not used today.** If TT-6C+ introduces `broadcast` RPC:

- Must be authenticated
- Topic includes tenant + tournament + scope id
- Payload = envelope metadata only
- Rejected for TT-6B MVP

---

## 9. Snapshot RPC fallback (security)

When Realtime fails or authorization uncertain:

- Fall back to same RPCs as polling (`get-setup`, `get_visible_lineups`, access guard)
- Never widen data on degraded mode
- Degraded banner — not elevated privileges

---

## 10. Findings

| ID | Severity | Finding | TT-6 action |
|----|----------|---------|-------------|
| SEC-1 | P0 | TT tables not in publication yet | Add only with RLS in SQL proposal |
| SEC-2 | P1 | Legacy match-live club filter | Do not reuse for TT; deprecate separately |
| SEC-3 | P1 | Full setup poll over-fetches | Realtime reduces frequency, not scope — RPC still authoritative |
| SEC-4 | P2 | No Realtime-specific audit metrics | Observability plan |

---

## 11. Security verdict (TT-6A design)

| Criterion | Verdict |
|-----------|---------|
| Lineup security design | **PASS** — server RPC + RLS-first publication plan |
| Referee assignment scope | **PASS** — reuse TT-5D guards |
| Cross-tenant | **PASS** — tenant assert pattern |
| Internal tables protected | **PASS** — no client publication |
| Client filter as security | **PASS** — explicitly rejected |

**Overall TT-6A security design: PASS** (implementation verification in TT-6B staging gates).
