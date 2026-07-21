# 04 — Pending Event Claiming Protocol (Phase 1G)

**Status:** RPCs authored — **not applied**. No delivery / no providers.

---

## `crm_claim_pending_events`

Inputs: `tenant_id`, `venue_id`, `worker_id`, `claim_limit`, `now_at`, `claim_ttl_seconds`

Behavior:

1. Fail closed if scope / worker / now missing
2. `crm_phase1g_scope_allows` + `crm.audit.view` (or super admin)
3. Validate `claim_limit` ∈ [1, 100], TTL ∈ [1, 3600] seconds
4. Select `PENDING` rows with `available_at <= now_at`
5. Order: `available_at ASC`, `created_at ASC`, `pending_event_id ASC`
6. `FOR UPDATE … SKIP LOCKED` + `LIMIT`
7. Atomically set `CLAIMED`, `claimed_by`, `claimed_at`, `claim_expires_at`, increment `attempt_count`
8. Return claimed rows
9. Does **not** deliver, call providers, or acknowledge

Security: `SECURITY DEFINER`, `search_path = public, pg_temp`, no PUBLIC/anon execute.

## `crm_release_expired_pending_event_claims`

Same scope + permission gates. Selects `CLAIMED` with `claim_expires_at <= now_at`. Returns status to `PENDING`, clears claim fields, **preserves** `attempt_count`. Does not acknowledge or fail.

## Acknowledge / fail (repository)

Conditional updates require current `status = CLAIMED`:

- Acknowledge → `ACKNOWLEDGED` + `acknowledged_at`; clears `claim_expires_at`
- Fail → `FAILED` + `failed_at` + non-empty `failure_reason`; clears `claim_expires_at`
- Stale transitions return `CRM_INVALID_TRANSITION` / zero-row update

Terminal states are not selectable by the claim RPC.
