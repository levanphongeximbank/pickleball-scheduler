INVALID PRE-AUDIT DRAFT

Tai lieu nay duoc tao truoc khi Referee V5 co source SHA tai tao duoc.
Khong duoc su dung lam TT-5A evidence hoac implementation authority.

---

# TT-5A â€” Data Mapping (Team Tournament â†” Referee V5)

**Status:** Audit complete â€” owner review required before TT-5B

---

## 1. Identity mapping decision

### Question: `sub_matches.id` (UUID) vs `external_sub_match_id` (text)?

| Identifier | Type | Used by |
|------------|------|---------|
| `team_tournament_sub_matches.id` | `uuid` PK | DB FKs, internal joins |
| `external_sub_match_id` | `text` | **All TT RPCs**, blob `subMatch.id`, UI keys, `get_setup` API |

Referee V5 `match_id` is opaque `text` (must not contain `::`).

### **Recommendation: use `external_sub_match_id` as V5 `match_id`**

```text
match_live_states.match_id           = sub_match.external_sub_match_id
referee_assignments.match_id         = sub_match.external_sub_match_id
match_live_states.id                 = {tenant_id}::{tournament_id}::{external_sub_match_id}
```

**Do not use UUID PK** as V5 `match_id` â€” would break TT RPC contracts and require translation at every boundary.

### Bridge table: required?

| Option | Pros | Cons |
|--------|------|------|
| **A. No bridge â€” direct ID** | Simple; 1:1 by convention | No place for integration status / revision FK without altering `sub_matches` |
| **B. Columns on `sub_matches`** | Single table lookup | Mixes TT summary with V5 integration metadata |
| **C. Thin bridge table** | Clean separation; audit trail | Extra join |

**Recommendation: Option C â€” thin bridge table** `team_sub_match_referee_links`:

```text
id                          uuid PK
tenant_id                   text NOT NULL
tournament_id               text NOT NULL
team_matchup_id             uuid NOT NULL  â†’ team_tournament_matchups.id
sub_match_uuid              uuid NOT NULL  â†’ team_tournament_sub_matches.id
external_sub_match_id       text NOT NULL  (= V5 match_id)
live_state_id               text NOT NULL  (= match_live_states.id)
official_result_revision_id uuid NULL      â†’ match_result_revisions.id
integration_status          text NOT NULL  -- pending|live|finalized|overridden|error
provisioned_at              timestamptz
finalized_at                timestamptz
created_at, updated_at
UNIQUE (sub_match_uuid)
UNIQUE (external_sub_match_id, tournament_id, tenant_id)
UNIQUE (live_state_id)
```

**Rationale:** TT-5D needs `official_result_revision_id` and `integration_status` without overloading `sub_matches` or guessing from V5 tables alone. Identity still uses `external_sub_match_id` for V5 APIs.

---

## 2. Primary mapping table

| Team Tournament | Referee V5 | Notes |
|-----------------|-------------|-------|
| `team_tournaments.tenant_id` | `match_live_states.tenant_id` | Same venue/tenant scope |
| `team_tournaments.id` | `match_live_states.tournament_id` | Same tournament string id |
| `team_tournament_matchups.id` | *(metadata only)* | Parent tie â€” not a V5 match |
| `sub_matches.external_sub_match_id` | `match_live_states.match_id` | **Primary key mapping** |
| `sub_matches.id` (uuid) | `team_sub_match_referee_links.sub_match_uuid` | Bridge only |
| `lineup_entries.player_id` | V5 `state.teams.*.players[].playerId` | Must match **published** lineup |
| `sub_matches.discipline_external_id` | V5 `matchType` / format config | TT-5B contract maps discipline â†’ doubles/singles/format |
| `sub_matches.court_id` | V5 meta / display | Optional pre-start |
| `sub_matches.status` | Derived from V5 + integration | See Â§4 |
| `sub_matches.score` | **Not live source** post-TT-5 | Summary mirror after finalize |
| `sub_matches.winner_team_id` | `match_result_revisions.winner` | Mirror after finalize only |
| `sub_matches.result_confirmed_at` | Finalize timestamp | Mirror after finalize |
| `team_tournament_audit_logs` | Reference to V5 event id / revision | Do not copy full event log |

---

## 3. Participant mapping (published lineup â†’ V5 init)

When lineup is **published** and sub-match is **revealed**:

```text
lineup_entries (team A, slot positions)
  â†’ V5 initializeMatchState config:
      teams.teamA.players[].playerId
      teams.teamA.players[].logicalServiceSide
      firstServingTeamId / firstServingPlayerId (from TT rules or coin toss UI)

lineup_entries (team B)
  â†’ teams.teamB.*
```

**Rules:**

- Only players in **published** lineup for that discipline/slot.  
- Hidden lineup must not appear in V5 init (TT-5E gate).  
- Player IDs must be stable strings shared between TT blob and cloud (`player_id` in lineup entries).

---

## 4. Status mapping

| `sub_matches.status` (TT) | Referee V5 / integration | When |
|---------------------------|--------------------------|------|
| `waiting` | No live state OR live state `not_started` | Before provision / before start |
| `playing` | `in_progress` | After START_MATCH; **not** from draft score entry |
| `completed` | `locked` / finalized + consumer applied | After finalize + TT-5D idempotent update |
| `forfeit` | Finalize with forfeit payload OR TT-4 forfeit path | Separate TT-4 flow â€” must not double-apply |

**Post-TT-5:** `playing` must **not** be set by manual score draft on `sub_matches.score`. Live score lives only in `match_live_states`.

Summary fields on `sub_matches` after finalize:

```text
status
official_result_revision_id   (via bridge)
winner_team_id
final_score                     (jsonb summary from revision)
completed_at
```

---

## 5. Official result flow

```text
Referee V5 finalize
  â†’ match_result_revisions (revision 1+)
  â†’ match_integration_outbox:
       TEAM_SUB_MATCH_FINALIZED   (new â€” TT-5D)
       STANDINGS_RECALC_REQUESTED (existing â€” route to TT recompute)
  â†’ TT-5D consumer (idempotent):
       UPDATE sub_matches summary
       UPDATE bridge.integration_status = finalized
       RECOMPUTE matchup result
       RECOMPUTE standings
       INSERT audit_log
```

Proposed new outbox types (TT-5D SQL):

```text
TEAM_SUB_MATCH_FINALIZED
TEAM_SUB_MATCH_OVERRIDDEN
TEAM_SUB_MATCH_CANCELLED
```

Existing V5 outbox types remain for bracket/rating until wired.

---

## 6. Referee assignment mapping

| Team Tournament | Referee V5 |
|-----------------|------------|
| TT permission `team.match.result.manage` | Gate for assignment creation |
| `refereeRoster` / BTC assign UI | `referee_assignments` rows |
| User UUID from `profiles` | `referee_assignments.referee_user_id` |
| Per sub-match | One assignment row per `(tenant, tournament, external_sub_match_id, user, role)` |

Roles: `REFEREE` (primary), optional `SCOREKEEPER`, `HEAD_REFEREE`.

---

## 7. Tenant / tournament ID alignment

Team Tournament cloud:

- `tenant_id` â†’ typically `venues.id` (e.g. staging venue slug/uuid)  
- `tournament_id` â†’ team tournament string id (same as blob)

Referee V5 staging QA uses isolated `REFEREE_V5_TEST_*` namespace â€” **TT-5 must use real TT ids**, not test fixtures.

---

## 8. Provisioning trigger (TT-5C)

Create `match_live_states` + `referee_assignments` + bridge row when **all** true:

1. Matchup lineups **published**  
2. Sub-match **visible** to referee (not hidden discipline)  
3. Sub-match has valid published participants  
4. Sub-match status `waiting`  
5. No existing bridge row for this sub-match  

**Must not** provision before lineup reveal (security).

Edge function today has **no create-match action** â€” TT-5C adds provisioning RPC or service-role script invoked from TT adapter.

---

## 9. Open questions for owner

1. Confirm **bridge table** vs columns-on-`sub_matches` â€” audit recommends bridge.  
2. Discipline â†’ V5 format matrix (doubles side-out default; rally only if engine-tested).  
3. Dreambreaker sub-matches â€” separate V5 match or excluded from TT-5 scope?  
4. Override path â€” HEAD_REFEREE revision in V5 vs TT BTC override RPC priority.

