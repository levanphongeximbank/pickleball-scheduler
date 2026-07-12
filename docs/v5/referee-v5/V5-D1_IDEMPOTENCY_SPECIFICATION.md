# V5-D.1 — Idempotency Specification

**Store:** `match_sync_mutations` (no new table)

---

## Required fields

```text
match_state_id / match_id
idempotency_key
client_mutation_id
mutation_type (command_type)
request_hash
status
resulting_event_sequence
resulting_state_version
response_payload
error_code
created_at
completed_at
expires_at (optional cleanup — must not allow re-apply of processed command)
```

## Unique constraint

```sql
UNIQUE (match_state_id, idempotency_key)
```

**No partial unique index** — full uniqueness for audit safety.

## Rules

### Same key + same request hash

Return cached `response_payload` with `duplicate: true`.

Do not: run engine, insert event, bump version, write audit again.

### Same key + different request hash

Return `IDEMPOTENCY_KEY_REUSE_MISMATCH`.

## Request hash composition

Canonical JSON (sorted keys) of:

```json
{
  "commandType": "TEAM_A_WON_RALLY",
  "payload": {},
  "clientMutationId": "..."
}
```

Optimistic lock values (`expectedVersion`) are **not** part of hash — they are checked separately at commit.

## Expiration policy (staging note)

If `expires_at` cleanup is added later, must archive `response_payload` or retain tombstone preventing re-processing.
