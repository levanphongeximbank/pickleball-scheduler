# TT-5A — Route Integration Audit

**Date:** 2026-07-13

---

## Current routes (post-merge)

| Route | Component | Module | Purpose |
|-------|-----------|--------|---------|
| `/team-referee/:tournamentId` | `TeamRefereePortal` | Team Tournament | Matchup list, legacy score entry, forfeit (TT-4) |
| `/referee/match/:matchId` | `RefereeSessionScoreboard` | Legacy session | Non-V5 session scoreboard |
| `/referee/:token` | `RefereeScoreboard` | Classic token | Anonymous/token referee |
| `/dev/referee-v5` | `RefereeV5PreviewPage` | Referee V5 | Staging QA workspace |
| `/referee` | `RefereeHub` | Hub | Entry navigation |

**File:** `src/router.jsx`

---

## Q10 — Official shared route recommendation

### **Primary (target): `/referee/match/:matchId`**

Where `matchId` = **`external_sub_match_id`**.

**Rationale:**

- Already exists in router (minimal churn)
- Match-scoped URL aligns with V5 `match_id` parameter
- Distinct from tournament-scoped `/team-referee/:tournamentId` (operations/list view)
- Handoff doc (`REFEREE_V5_INTEGRATION_HANDOFF.md`) targets this route for unified workspace

### Secondary routes (retain)

| Route | Role post-TT-5 |
|-------|----------------|
| `/team-referee/:tournamentId` | BTC/referee **matchup navigator** — deep link to sub-match, standings, dreambreaker; **no score entry when V5-linked** |
| `/dev/referee-v5` | Staging/super-admin only |
| `/referee/:token` | Classic open tournaments — **unchanged**, out of TT-5 scope |

### Not recommended as primary

- `/team-referee/:id` for V5 live scoring — wrong scope (tournament vs match), harder assignment model

---

## Navigation flow (proposed)

```
/team-referee/:tournamentId?matchup=X
  → sub-match row "Open V5 referee" → /referee/match/{external_sub_match_id}
  → RefereeV5Workspace (remote adapter)
```

Assignment gate: user must have active `referee_assignments` row for `(tenant, tournament, match_id)`.

---

## Feature flags

| Flag | File | Effect |
|------|------|--------|
| `VITE_REFEREE_V5_ENABLED` | `src/features/referee-v5/flags.js` | Master V5 module |
| `VITE_REFEREE_V5_REALTIME_ENABLED` | same | Realtime subscription |
| Team data mode | `VITE_TEAM_TOURNAMENT_DATA_MODE` | cloud vs blob |

TT-5E must add integration flag e.g. `VITE_TT5_REFEREE_V5_LINK_ENABLED` (design only — **not created in TT-5A**).

---

## Deep links & query params

| Param | Consumer |
|-------|----------|
| `?matchup=` | `TeamRefereePortal` expands panel |
| Future: `?tenant=` | V5 edge auth context (if multi-tenant URL needed) |

---

## Mobile / PWA

Team referee portal is mobile-polished. V5 workspace (`RefereeV5Workspace.jsx`) has responsive CSS (`refereeV5.css`). Route integration should reuse same layout shell as `/dev/referee-v5` preview.

---

## Q4 — Lineup leak via routes

Route audit alone does not prevent leak — **data gate** in `getVisibleLineup` + server `team_tournament_get_visible_lineups` hides opponent until publish. V5 provisioning must **refuse** create if lineups not published (server-side check in TT-5C RPC).
