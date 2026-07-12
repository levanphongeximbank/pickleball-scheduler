# TT-5B — Identity Contract

**Phase:** TT-5B  
**Status:** Implemented on Staging  
**Production impact:** NONE

---

## Canonical identity rule

```
team_tournament_sub_matches.external_sub_match_id
  = Referee V5 match_id
  = team_sub_match_referee_links.referee_match_id
  = team_sub_match_referee_links.external_sub_match_id
```

**Do not** use `team_tournament_sub_matches.id` (UUID PK) as the Referee V5 `match_id`. All TT RPCs and probe scripts resolve sub-matches by `external_sub_match_id`.

---

## V5 composite state key

Referee V5 live state primary key:

```
{tenant_id}::{tournament_id}::{match_id}
```

Example (staging probe):

```
venue-staging-a::phase23d-probe-tournament::phase23d-sub-1
```

Stored in bridge snapshot and `match_live_states.id`.

---

## Uniqueness & immutability

| Rule | Enforcement |
|------|-------------|
| `external_sub_match_id` unique per tenant | `unique(tenant_id, external_sub_match_id)` |
| One bridge per sub-match | `unique(sub_match_id)` |
| One V5 match per bridge | `unique(referee_match_id)` |
| No duplicate V5 match for same sub-match | Provision RPC checks existing link; idempotency replay |
| No link one V5 match to two sub-matches | `referee_match_id` unique |
| Identity immutable after successful provision | RPC rejects re-provision on active link; revoke is soft status change only |
| Cross-tenant / cross-tournament | `team_tournament_assert_tenant` + relation validation in RPC |

---

## Route contract

Provision RPC returns:

```
/referee/match/{external_sub_match_id}
```

Client helper: `buildRefereeWorkspaceRoute(externalSubMatchId)` in `teamRefereeV5BridgeEngine.js`.

`matchId` in URL = `external_sub_match_id` (not bridge UUID, not sub-match row UUID).

---

## Snapshot identity references

Provision stores in `team_sub_match_referee_links.snapshot`:

- `lineupVersionA`, `lineupVersionB` (published only)
- `matchupVersion`, `subMatchVersion`
- `disciplineExternalId`, scoring rule reference
- `courtAssignment` if present
- Participant display names / player IDs from published lineups

If published lineup versions change post-provision → link status `reprovision_required` (design for TT-5C resync).

---

## Idempotency identity

Idempotency key scoped via `team_tournament_begin_command` with payload hash:

- Same key + same payload → replay stored provision result (same `link_id`, `replayed: true`)
- Same key + different payload → `idempotency_payload_mismatch`
- Different keys, same sub-match, concurrent → one wins; other gets replay or conflict (no duplicate V5 shell)

---

## Legacy vs V5 write identity

When bridge status blocks legacy:

- Legacy RPCs keyed by same `external_sub_match_id`
- Block codes reference link status, not internal UUID
- `scoreOps.refereeMatchId` and `scoreOps.refereeRoute` expose V5 identity to UI

---

## Out of scope (TT-5B)

- DreamBreaker sub-match identity (provision denied)
- Result revision / outbox event identity propagation (TT-5C)
- Production identity migration
