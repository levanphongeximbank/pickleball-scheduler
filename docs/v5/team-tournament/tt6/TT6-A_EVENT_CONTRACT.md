# TT-6A — Event Envelope Contract

**Date:** 2026-07-13  
**Status:** Design specification — implementation in TT-6B

---

## 1. Purpose

Normalize all Realtime hints (Supabase WAL, future broadcast RPC, polling diff) into one envelope so:

- Dedupe is consistent across sources
- Stale events are dropped uniformly
- Pages never parse raw postgres payloads
- Standings are never incrementally mutated on client

---

## 2. Envelope schema

```typescript
interface TeamTournamentRealtimeEvent {
  // Identity — dedupe key (required)
  eventId: string;

  // Classification
  eventType: TeamTournamentEventType;
  entityType: 'tournament' | 'matchup' | 'lineup' | 'sub_match' | 'standing' | 'bridge' | 'assignment' | 'referee_match';
  entityId: string;
  entityVersion: number;

  // Scope (all required for authorization audit)
  tenantId: string;
  tournamentId: string;
  matchupId?: string;
  subMatchId?: string;
  externalSubMatchId?: string;

  // Traceability
  occurredAt: string;          // ISO-8601 from server clock — NOT dedupe identity
  correlationId?: string;      // command idempotency key or outbox id
  source: 'postgres_changes' | 'referee_v5' | 'polling' | 'manual_refresh' | 'broadcast_rpc';

  // Integrity
  payloadHash: string;         // sha256 of canonical payload JSON
  payload: Record<string, unknown>;  // minimal metadata ONLY — never full lineup arrays
}
```

---

## 3. Event types (initial set)

| eventType | Trigger | payload hints | Reload target |
|-----------|---------|---------------|---------------|
| `tournament.updated` | Header/version bump | `{ version }` | `get-setup` |
| `matchup.status_changed` | Matchup row UPDATE | `{ status, version }` | `get-setup` or matchup slice |
| `lineup.draft_saved` | Own team only | `{ teamId, lineupVersion }` | visible lineups + setup |
| `lineup.submitted` | Own team only | `{ teamId, lineupVersion }` | visible lineups + setup |
| `lineup.published` | Both teams visible post-publish | `{ matchupId, lineupAVersion, lineupBVersion }` | visible lineups + setup |
| `sub_match.result_updated` | Consumer applied V5 result | `{ subMatchId, status, revisionNo }` | setup + standings |
| `standings.recalculated` | Cache version bump | `{ standingsVersion }` | standings slice only |
| `bridge.provisioned` | Link row INSERT/UPDATE | `{ linkId, integrationStatus }` | setup + referee access |
| `bridge.revoked` | Link revoked | `{ linkId }` | setup |
| `bridge.reprovision_required` | Stale snapshot flag | `{ reason }` | setup |
| `assignment.created` | Referee assignment | `{ assignmentId, expiresAt }` | access guard |
| `assignment.revoked` | Revoke | `{ assignmentId, reason }` | access guard |
| `referee_match.version_bumped` | `match_live_states` UPDATE | `{ stateVersion, lastEventSequence }` | Edge get-state |

---

## 4. Identity rules

### 4.1 `eventId` (dedupe primary key)

**Format:** `{source}:{table_or_domain}:{primary_key}:{entityVersion}:{payloadHashPrefix}`

Examples:

- `pg:team_tournament_sub_matches:sub-uuid:42:a1b2c3d4`
- `pg:team_sub_match_referee_links:link-uuid:3:f9e8d7c6`
- `v5:match_live_states:state-uuid:17:01234567`
- `poll:get-setup:tournament-uuid:128:deadbeef` (polling emits synthetic eventId per snapshot version)

**Rules:**

- Same `eventId` → process **once** per tab session (see dedupe doc).
- `eventId` must be stable for replay (reconnect must not generate new id for same WAL event).

### 4.2 `entityVersion` (staleness gate)

- Monotonic per entity (matchup version, lineup version, sub-match version, `state_version`, standings cache version).
- If `event.entityVersion <= localEntityVersion` → **discard** (stale or duplicate).
- If `event.entityVersion > localEntityVersion + 1` → **full snapshot reload** (gap).
- If `event.entityVersion === localEntityVersion + 1` → targeted reload or merge per event type.

### 4.3 `occurredAt`

- Display and observability only.
- **Never** used as sole dedupe key (clock skew, out-of-order WAL).
- Server-generated timestamps preferred.

### 4.4 `payloadHash`

- SHA-256 of canonical JSON (`JSON.stringify` with sorted keys).
- Same version + different hash → **conflict** → force snapshot reload + log metric.
- Aligns with TT-5C inbox `payload_hash` for propagation events.

---

## 5. Payload minimization (security)

**Allowed in payload:**

- IDs, enums, version numbers, status strings, score summary `{ teamA, teamB }`, winner team id.

**Forbidden in payload:**

- Full lineup player lists for opponent pre-publish
- JWT, tokens, service-role markers
- Raw `state_payload` from Referee V5
- Full standings arrays (use reload)
- Command log rows / outbox bodies

---

## 6. Client processing pipeline

```text
1. Receive raw Supabase payload OR polling diff OR adapter callback
2. eventNormalizer → TeamTournamentRealtimeEvent
3. dedupeStore.has(eventId)? → discard (metric: duplicate_discarded)
4. entityVersion gate → discard or gap-reload
5. payloadHash conflict check at same version → conflict reload
6. Map eventType → refreshSnapshot(scope, reason)
7. Update local entityVersion from snapshot response
8. Emit handler callbacks with envelope (not snapshot — pages read from existing state)
```

---

## 7. Standings rule (hard)

**Client must NOT:**

- Apply `+1 win` / point deltas from Realtime payload
- Recompute tie-break locally from partial events

**Client must:**

- On `standings.recalculated` or `sub_match.result_updated` → call `getStandings` or full setup reload
- Trust TT-4 / competition-core standings engine output from server snapshot only

---

## 8. Mapping from TT-5 outbox (server → client hint)

Server consumer already writes sub-match rows. Client Realtime (TT-6B) observes **row UPDATE** on `team_tournament_sub_matches` and emits:

```json
{
  "eventType": "sub_match.result_updated",
  "correlationId": "<outbox_event_id from inbox if exposed via join view, else row updated_at>",
  "entityVersion": "<sub_match version column>",
  "payload": { "status": "confirmed", "revisionNo": 3 }
}
```

**Do not** subscribe to `match_integration_outbox` or inbox tables from client.

---

## 9. Versioning

Envelope schema version field deferred to TT-6B if needed (`schemaVersion: 1`). TT-6A freezes v1 fields above.

---

## 10. Acceptance

| Rule | Documented |
|------|------------|
| eventId dedupe | YES |
| entityVersion staleness | YES |
| occurredAt not identity | YES |
| No client standings incremental | YES |
| Minimal payload | YES |
