# Phase 43A — Offline Queue Target Schema

**Current file:** `src/features/mobile/services/offlineQueue.js`  
**Current storage:** localStorage `pickleball-offline-queue-v1` (L6)  
**Spec target:** Phase 42 principle #3 prefers IndexedDB for mutation queue — **migrate in 43A.2 optional**; schema first.

---

## Current record (actual)

```javascript
// offlineQueue.js L59-68
{
  id: "oq-{timestamp}-{random}",  // NOT request_id
  type,                             // checkin | match_score | referee_note
  payload,
  tenantId,                         // optional, may be null
  clubId,                           // optional
  status,                           // pending | synced | failed | conflict
  createdAt,
  attempts,                         // retry count
  lastError,
}
```

**Missing:** `request_id`, `user_id`, `entity_type`, `entity_id`, `mutation_type`, `conflict_version`

---

## Target record (43A mandatory)

| Field | Type | Source on enqueue | Required |
|-------|------|-------------------|----------|
| `id` | string | internal queue row id (uuid) | ✅ |
| `request_id` | uuid | `crypto.randomUUID()` | ✅ |
| `user_id` | uuid | `getCurrentUser().id` | ✅ |
| `tenant_id` | string | `TenantContext` / `user.venueId` | ✅ |
| `club_id` | string | param or active club | ⚠️ when club-scoped |
| `entity_scope_id` | string | club_id or tenant_id | ✅ |
| `entity_type` | enum | `checkin`, `referee_note`, … | ✅ |
| `entity_id` | string | from payload if known | ⚠️ |
| `mutation_type` | enum | `create`, `update`, `note` | ✅ |
| `payload` | object | action-specific | ✅ |
| `created_at` | ISO8601 | `new Date().toISOString()` | ✅ |
| `retry_count` | int | starts 0 | ✅ |
| `status` | enum | see below | ✅ |
| `last_error` | string? | last failure message | ✅ |
| `conflict_version` | int? | server version on conflict | ⚠️ |
| `synced_at` | ISO8601? | on success | optional |

### Status enum

| Status | Meaning |
|--------|---------|
| `pending` | Awaiting flush |
| `syncing` | In progress (optional lock) |
| `synced` | Success |
| `failed` | Max retries exceeded |
| `conflict` | Non-retryable conflict (23505, VERSION_CONFLICT) |
| `quarantined` | Legacy/unscoped — never auto-flush |

---

## Enqueue rules

1. Reject enqueue if `!user_id || !tenant_id` (except platform SA with explicit tenant picker).
2. `request_id` generated once — never changed on retry.
3. `canEnqueueOfflineAction(type)` continues to block `match_score` (L120–126).

---

## Flush rules

```text
FOR each entry WHERE status IN (pending, failed):
  IF entry.user_id != currentUser.id → SKIP
  IF entry.tenant_id != currentTenantId → SKIP
  IF entry.status == quarantined → SKIP
  IF entry.request_id already synced in meta.dedup → mark synced SKIP network
  ELSE processEntry(entry) with idempotency header/key
```

**File:** `flushOfflineQueue` L177–228 — add filter before L197.

---

## Auth lifecycle

| Event | Action |
|-------|--------|
| Logout | Move pending entries to `quarantined` or separate `quarantine-v1` store |
| User switch (login B after A) | Same as logout for session A entries |
| Tenant switch | Quarantine entries where `tenant_id != newTenant` |
| Club switch | Do not flush queue; optional tag `club_id` mismatch → hold |

---

## Legacy migration on read

On `loadQueue()`:

- Entries missing `user_id` or `tenant_id` → set `status: quarantined`, `last_error: LEGACY_UNSCOPED`.
- Never auto-flush quarantined without operator `clearQuarantinedQueue()` admin tool.

---

## Idempotency

- Client: track `syncedRequestIds` in `pickleball-offline-queue-meta-v1`.
- Server (future): RPC accept `p_request_id` for check-in; until then use unique constraint + treat 23505 as conflict (already L86–88).

---

## Test cases

See `PHASE_43A_SAFETY_PREP.md` T1–T5.
