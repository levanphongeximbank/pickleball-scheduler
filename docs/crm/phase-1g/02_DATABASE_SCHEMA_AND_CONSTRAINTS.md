# 02 — Database Schema and Constraints (Phase 1G)

**Status:** SQL authored under `docs/crm/phase-1g/` — **not applied**

---

## Tables

### `public.crm_tags`

Primary key `tag_id`. Mandatory `tenant_id`, `venue_id`. Unique `(tenant_id, venue_id, normalized_code)`. Non-empty `normalized_name` / `normalized_code`. Explicit `active`. `updated_at >= created_at`. Tag definition **delete not supported**.

### `public.crm_tag_assignments`

PK `assignment_id`. FK to `crm_tags(tag_id)` with `ON DELETE RESTRICT` (no silent history loss). `target_type` ∈ `CONTACT_REFERENCE|LEAD|OPPORTUNITY`. Unique `(tenant_id, venue_id, tag_id, target_type, target_id)`. Removing an assignment deletes **only** the assignment row.

### `public.crm_consent_records`

PK `consent_id`. Append-only business semantics. Channel / purpose / status checks. Non-empty `policy_version`. `expires_at` absent or `> effective_at`. `revoked_at` required iff status `REVOKED`.

### `public.crm_pending_events`

PK `pending_event_id`. Unique `(tenant_id, venue_id, event_id)`. Status ∈ `PENDING|CLAIMED|ACKNOWLEDGED|FAILED`. Non-negative `attempt_count`. `payload_json` must be JSON object. Claimed / acknowledged / failed field checks. Terminal states cannot be re-claimed via claim RPC (selects `PENDING` only).

## Indexes

See `20_CRM_PHASE_1G_INDEXES.sql` for the required index set covering scoped code/name lookups, assignment targets, consent history ordering, and claim queue ordering.

## Consent immutability

Optional trigger `60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql` blocks `UPDATE`/`DELETE` on consent rows. Repository contract also refuses update/delete.
