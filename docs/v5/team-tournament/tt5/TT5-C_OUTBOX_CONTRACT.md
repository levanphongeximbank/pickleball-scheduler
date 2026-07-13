# TT-5C — Outbox Contract

**Production impact:** NONE

---

## V5 emitted events (actual)

Referee V5 finalize writes to `match_integration_outbox`:

- `STANDINGS_RECALC_REQUESTED` ← **TT consumer trigger**
- `BRACKET_ADVANCE_REQUESTED`
- `NOTIFICATION_REQUESTED`
- `RATING_EVIDENCE_REQUESTED`

TT-5C consumer processes **`STANDINGS_RECALC_REQUESTED`** only.

---

## TT contract labels (normalized)

| Normalized type | When |
|-----------------|------|
| `REFEREE_MATCH_FINALIZED` | `STANDINGS_RECALC` + revision confirmed |
| `REFEREE_RESULT_REVISED` | `STANDINGS_RECALC` + revision overridden |
| `REFEREE_MATCH_REOPENED` | revision status cancelled/void |
| `STANDINGS_RECALC_REQUESTED` | raw V5 type (stored in outbox) |

Function: `team_tournament_referee_normalize_event_type`

---

## Inbox row (`team_tournament_referee_event_inbox`)

| Field | Source |
|-------|--------|
| `outbox_event_id` | `match_integration_outbox.id` (unique) |
| `event_type` | Normalized TT label |
| `tenant_id`, `tournament_id` | Outbox row |
| `matchup_id`, `sub_match_id` | Bridge resolution |
| `external_sub_match_id` | Bridge |
| `referee_match_id` | Bridge (= V5 `match_id`) |
| `result_revision_id` | Latest applied revision |
| `result_version` | Revision number |
| `payload_hash` | md5(outbox.payload) |
| `payload` | Outbox payload copy |
| `source` | `referee_v5` |
| `correlation_id` | Consumer call param |

No secrets in payload.

---

## Idempotency

- Same `outbox_event_id` + same `payload_hash` → replay (no double standings)
- Same `outbox_event_id` + different hash → `payload_mismatch`
- Stale revision number → `stale_revision` (skip/ reject)
- Already applied revision id → `revision_already_applied`

---

## RPCs

| RPC | Role |
|-----|------|
| `team_tournament_consume_referee_v5_outbox(p_outbox_id)` | service_role |
| `team_tournament_drain_referee_v5_outbox(p_limit)` | service_role batch |

Clients must not call consumer RPCs.
