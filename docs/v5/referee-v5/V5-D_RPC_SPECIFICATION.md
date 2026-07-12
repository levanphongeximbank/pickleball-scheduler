# V5-D — RPC Specification

**Status:** DRAFT  
**SQL:** `PHASE_V5D_REFEREE_PERSISTENCE.sql` — NOT APPLIED

---

## 1. Client service

Module: `src/features/referee-v5/services/refereeV5RpcService.js`

| Function | RPC |
|----------|-----|
| `refereeV5GetMatchState` | `referee_v5_get_match_state` |
| `refereeV5ApplyMatchCommand` | `referee_v5_apply_match_command` |
| `refereeV5FinalizeMatchResult` | `referee_v5_finalize_match_result` |

---

## 2. referee_v5_get_match_state

**Input**

| Param | Type | Required |
|-------|------|----------|
| `p_tenant_id` | text | yes |
| `p_tournament_id` | text | yes |
| `p_match_id` | text | yes |

**Success response**

```json
{
  "ok": true,
  "state": {},
  "stateVersion": 18,
  "lastEventSequence": 18,
  "status": "in_progress"
}
```

**Errors:** `TENANT_ACCESS_DENIED`, `REFEREE_NOT_ASSIGNED`, `MATCH_NOT_FOUND`

---

## 3. referee_v5_apply_match_command

**Input**

| Param | Type | Required |
|-------|------|----------|
| `p_tenant_id` | text | yes |
| `p_tournament_id` | text | yes |
| `p_match_id` | text | yes |
| `p_command_type` | text | yes |
| `p_payload` | jsonb | no (default `{}`) |
| `p_expected_version` | integer | yes |
| `p_expected_sequence` | bigint | yes |
| `p_client_mutation_id` | text | yes |
| `p_idempotency_key` | text | yes |

**Allowed command types**

```text
START_MATCH
TEAM_A_WON_RALLY
TEAM_B_WON_RALLY
SWITCH_ENDS
UNDO_LAST_EVENT
PAUSE_MATCH
RESUME_MATCH
START_TIMEOUT
END_TIMEOUT
DECLARE_FORFEIT
```

**Forbidden payload keys** (rejected server-side)

```text
team_a_score, team_b_score, serving_team_id, serving_player_id,
receiving_player_id, server_number, player_positions, serve_direction,
winner_id, official_result
```

**Success response**

```json
{
  "ok": true,
  "state": {},
  "stateVersion": 19,
  "lastEventSequence": 19,
  "generatedEvents": [],
  "serveDirection": "NEAR_TO_FAR"
}
```

**Idempotent retry**

```json
{
  "ok": true,
  "duplicate": true,
  "stateVersion": 19,
  "lastEventSequence": 19
}
```

**Conflict response**

```json
{
  "ok": false,
  "code": "MATCH_STATE_CONFLICT",
  "currentVersion": 15,
  "currentSequence": 15
}
```

---

## 4. referee_v5_finalize_match_result

**Input**

| Param | Type | Required |
|-------|------|----------|
| `p_tenant_id` | text | yes |
| `p_tournament_id` | text | yes |
| `p_match_id` | text | yes |
| `p_expected_version` | integer | yes |
| `p_idempotency_key` | text | yes |
| `p_override_reason` | text | if `p_is_override` |
| `p_is_override` | boolean | no |

**Success response**

```json
{
  "ok": true,
  "revision": {
    "status": "confirmed",
    "officialScore": { "teamA": 11, "teamB": 9 },
    "winnerId": "team-a"
  },
  "locked": true
}
```

**Errors:** `RESULT_NOT_READY`, `MATCH_LOCKED`, `OVERRIDE_REASON_REQUIRED`, `MATCH_STATE_CONFLICT`

---

## 5. Transaction boundaries

All steps 1–17 (apply) and 1–15 (finalize) from owner spec execute in **one database transaction** initiated by Edge Function / service role after JS engine computes next state.

SQL RPC stubs in V5-D validate auth + locking only until Edge Function wiring in staging.

---

## 6. Audit actions

Mapped in `persistence/auditLog.js`:

| Command | Audit action |
|---------|--------------|
| `START_MATCH` | `referee.match.started` |
| `TEAM_*_WON_RALLY` | `referee.rally.recorded` |
| Side-out rotation | `referee.server.changed` / `referee.side_out` |
| `SWITCH_ENDS` | `referee.ends_switched` |
| `UNDO_LAST_EVENT` | `referee.event.reverted` |
| `PAUSE_MATCH` / `RESUME_MATCH` | `referee.match.paused` / `resumed` |
| `DECLARE_FORFEIT` | `referee.forfeit.declared` |
| Finalize | `referee.result.confirmed` |
| Override | `referee.result.overridden` |

---

## 7. Adapter interface (UI)

```javascript
loadMatch()
dispatchCommand({ commandType, payload, clientMutationId, idempotencyKey, expectedVersion, expectedSequence })
reloadState()
finalizeResult({ expectedVersion, idempotencyKey, overrideReason, isOverride })
```

UI uses `LocalPrototypeAdapter` when flag off / dev prototype.  
`RemotePersistenceAdapter` when staging integration enabled.
