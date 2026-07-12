# Team Tournament — TT-1C UI Wiring & Staging Rollout

**Phase:** TT-1C  
**Verdict:** **READY FOR TT-2** (owner review — do not start TT-2 yet)  
**Production impact:** NONE  
**Evidence commit:** `b243da77250d81034b92fcbb49c6a7dab3cfd6f0`

---

## Executive summary

| Gate | Status |
|------|--------|
| Staging Supabase automated (shadow compare, RPC, regression) | **PASS** |
| Shadow blob ↔ cloud (pilot `phase23d-probe-tournament`) | **PASS** — 0 mismatches |
| Preview deployed — **cloud_primary** | **PASS** |
| Preview UI smoke — cloud_primary (Captain A/B + mutations) | **PASS** |
| Multi-device — RPC | **PASS** |
| Multi-device — UI captain mutations | **PASS** |
| Lineup security (pre-publish hide opponent) | **PASS** |
| BTC lock/publish | **PASS** |
| Referee portal | **PASS** |
| DreamBreaker (pilot) | **N/A** — `dreambreakerEnabled=false` |

**Do not start TT-2. Do not deploy Production. Stop for owner review.**

---

## Root cause (Captain A/B blocker — fixed)

1. **Preview bundle has `VITE_CLUB_STORAGE_V2=true`** (AuthContext + club modules).  
   `stripLegacyProfileClubFields()` was clearing **`playerId`** from the auth session even though Supabase profile returns `player_id`.  
   Captain portal resolves team via `findTeamForCaptain(teamData, playerId)` → access denied / blank portal.

2. **Fix:** V2 strip now removes only **`clubId`** (membership SoT stays `club_members`).  
   **`playerId`** is athlete/tournament identity and is preserved in session.  
   Additional fallback: `TeamPortal` fetches profile `player_id` when session link is missing.

3. **Deep-link routing** (prior fix, same deploy): `/team-portal/:id` resolves club from tournament blob / URL, not stale header CLB; forbidden portal paths → `/403` not `/discover-clubs`.

---

## Preview deployment (cloud_primary)

| Field | Value |
|-------|--------|
| Deployment ID | `dpl_D5LFYJHCQm6kHraCrrC9ADhHy7fV` |
| Preview URL | https://pickleball-scheduler-g8tpl706z-pickleball-scheduler.vercel.app |
| Bundle commit | `b243da77250d81034b92fcbb49c6a7dab3cfd6f0` |
| `VITE_TEAM_TOURNAMENT_DATA_MODE` | `cloud_primary` |
| `VITE_CLUB_STORAGE_V2` | `true` (in AuthContext + club chunks) |

---

## Staging QA prep (automated)

Script: `scripts/prep-tt1c-staging-captain-profiles.mjs`

- `profiles.player_id` → `player-staging-a-1` / `player-staging-b-1`
- `club_members` active in `club-staging-demo` (V2 SoT)
- Team captain assignment on cloud (`team_tournament_teams` + `team_tournament_team_members`)
- Report: `docs/v5/qa-evidence/phase-tt1c/PREP_CAPTAIN_PROFILES_REPORT.json`

Matchup reset: `scripts/prep-tt1c-staging-matchup-open.mjs`

---

## UI smoke (cloud_primary)

Script:

```powershell
$env:STAGING_PREVIEW_URL="https://pickleball-scheduler-g8tpl706z-pickleball-scheduler.vercel.app"
node scripts/verify-phase-tt1c-preview-smoke.mjs --data-mode-expected=cloud_primary --with-mutations
```

Report: `docs/v5/qa-evidence/phase-tt1c/PREVIEW_UI_SMOKE_REPORT.json` — **PASS**

Highlights:

- Captain A/B `/team-portal/phase23d-probe-tournament` — render OK, no redirect
- Captain A save draft — clicked OK
- Captain B submit — clicked OK; opponent hidden pre-publish OK
- BTC lock + publish — OK
- Post-publish captain reload — content OK
- Referee portal — render OK

---

## Code touchpoints

| Area | Path |
|------|------|
| V2 session strip (playerId preserved) | `src/features/club/services/clubActiveMembershipService.js` |
| User normalize (`player_id` snake_case) | `src/models/user.js` |
| Portal deep-link scope | `src/features/team-tournament/routing/teamPortalRouteScope.js` |
| RBAC / route gate | `src/features/tenant/services/profileVenueService.js`, `RouteAccessGate.jsx` |
| Captain portal page | `src/pages/tournament/TeamPortal.jsx` |
| Captain player resolver | `src/features/team-tournament/engines/teamPermissionEngine.js` |

---

## Owner review checklist

- [ ] Confirm staging captain accounts (`player@staging.local`, `club@staging.local`) on Preview URL above
- [ ] Spot-check `/team-portal/phase23d-probe-tournament` without selecting CLB in header
- [ ] Approve TT-2 kickoff separately (not in scope of this phase)
