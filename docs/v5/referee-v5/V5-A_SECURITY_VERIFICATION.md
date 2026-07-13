# Referee V5-A — Security Verification

**Status:** Design verification (V5-A)  
**Scope:** Current system gaps + V5 target controls

---

## 1. Verification matrix (current → V5 target)

| Requirement | Current | Evidence | V5 target |
|-------------|---------|----------|-----------|
| Referee sees assigned matches only | ⚠️ PARTIAL | Name fuzzy match `refereeSessionService.js` | `referee_assignments.referee_user_id` |
| Referee updates assigned match only | ⚠️ PARTIAL | Token scoped RPC | Assignment + match_state_id check |
| Cross-tenant isolation | ⚠️ PARTIAL | RLS staff policies | tenant_id on all V5 tables + RLS |
| PLAYER cannot send rally event | ✅ UI/RBAC | `MATCH_UPDATE` required | RPC rejects PLAYER |
| Token expiry | ❌ FAIL | No `expires_at` on referee token | `token_expires_at` |
| Token revoke | ❌ FAIL | Re-assign only | `status=revoked` |
| Token plain text | ❌ FAIL | `referee_token` column plain | `token_hash` only |
| Token list scope | ✅ PASS | RPC single match by token | Same |
| Locked result not editable | ⚠️ PARTIAL | RPC status check | `status=locked` + RLS |
| Override requires elevated role + reason | ⚠️ PARTIAL | Director only | `referee_v5.override` + reason NOT NULL |
| Client cannot set server-owned fields | ❌ FAIL | Client sends scoreA/B on finalize | Payload guard + strip serve/receive fields |
| Client spoof receiving_player_id | ❌ FAIL | N/A today | Reject if ≠ engine (`CLIENT_RECEIVER_REJECTED`) |

**Overall current security for V5 goals:** **FAIL** (position layer absent; token lifecycle weak)

---

## 2. Client payload guard (V5 design)

File (proposed): `src/features/referee-v5/guards/refereeV5PayloadGuard.js`

### Allowed client fields

```text
eventType, winningTeamId, reason, note, clientMutationId,
expectedVersion, idempotencyKey, timeoutTeamId, incidentType
```

### Blocked server-owned fields

```text
winner_id, official_score, official_status, locked_at, confirmed_by,
serving_player_id, receiving_player_id, serving_court_side, receiving_court_side,
serving_court_end, receiving_court_end, serve_direction,
rating_applied, standings_applied, bracket_advanced
```

If client sends `receiving_player_id` and it **≠** engine result → **reject** (`CLIENT_RECEIVER_REJECTED`).

Pattern mirrors Rating V5 payload guard (`ratingPayloadGuard` concept in `V5-A_ARCHITECTURE.md` rating docs).

---

## 3. RLS design (DRAFT — NOT APPLIED)

| Table | SELECT | INSERT/UPDATE |
|-------|--------|---------------|
| `referee_assignments` | Assigned referee + tournament staff | Staff assign |
| `match_live_states` | Assigned referee read; staff all | RPC only (no direct client UPDATE) |
| `match_events` | Same as state | RPC only |
| `match_result_revisions` | Staff + assigned read | Finalize RPC only |
| `match_disputes` | Parties + staff | Filer + resolver roles |

**Principle:** Anon **no direct** table access; token access via SECURITY DEFINER RPC with hashed token lookup.

---

## 4. Token security (V5)

```text
Generation: crypto.randomUUID() → store SHA-256 hash in referee_assignments
Expiry: default 24h after match scheduled_end + grace
Revoke: on reassignment, match complete, manual BTC revoke
Post-match: token read-only or revoked (owner decision)
Rate limit: NOT VERIFIED on current RPC — add in V5-E
```

---

## 5. Role matrix (V5 proposed)

| Action | REFEREE | SCOREKEEPER | HEAD_REFEREE | TM | PLAYER |
|--------|:-------:|:-----------:|:------------:|:--:|:------:|
| View assigned | ✅ | ✅ | ✅ all | ✅ | ❌ |
| Apply rally event | ✅ | ⚠️ config | ✅ | ❌ | ❌ |
| Undo | ✅ | ⚠️ | ✅ | ❌ | ❌ |
| ENDS_SWITCHED manual | ✅ | ❌ | ✅ | ❌ | ❌ |
| Finalize | ✅ | ❌ | ✅ | ⚠️ | ❌ |
| Override | ❌ | ❌ | ✅ | ✅ | ❌ |
| Resolve dispute | ❌ | ❌ | ✅ | ✅ | ❌ |

SCOREKEEPER / HEAD_REFEREE roles **NOT IMPLEMENTED** today.

---

## 6. Security tests (see V5-F_TEST_PLAN.md)

8 security tests defined — status: **NOT RUN** (no V5 code).

---

## 7. Verdict (security section)

| Criterion | Result |
|-----------|--------|
| Current system meets V5 security bar | **FAIL** |
| V5 security design documented | **PASS** |

---

*No RLS applied — design only.*
