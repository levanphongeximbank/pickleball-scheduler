# V5-D — Current Database Mapping

**Status:** DRAFT — NOT APPLIED  
**Date:** 2026-07-12

---

## 1. Existing production/staging objects (legacy)

| Object | Role | V5-D impact |
|--------|------|-------------|
| `tournament_match_live` | Legacy live score row | **Unchanged** — legacy referee continues |
| `referee_get_match_by_token` | Token-scoped read | **Unchanged** — not used by V5-D |
| `referee_update_match_score` | Token-scoped score write | **Unchanged** — not used by V5-D |

Legacy token routes remain independent. V5-D does **not** extend token access without owner security design.

---

## 2. V5-A foundation (draft, not applied)

Defined in `PHASE_V5A_REFEREE_FOUNDATION.sql`:

| Table | Purpose |
|-------|---------|
| `referee_assignments` | Match-scoped referee/scorekeeper roles |
| `match_live_states` | Materialized snapshot (normalized + JSON) |
| `match_events` | Append-only event history |
| `match_result_revisions` | Official locked outcomes |
| `match_sync_mutations` | Idempotency ledger |
| `match_incidents` / `match_disputes` | Future ops (read policies only in V5-D) |
| `match_game_states` | Per-game scores |
| `match_participant_positions` | Optional normalized positions |
| `referee_device_sessions` | Multi-device (V5-F) |

---

## 3. V5-D mapping to spec fields

### referee_assignments

| Spec field | V5-A column | Notes |
|------------|-------------|-------|
| `user_id` | `referee_user_id` | FK to `profiles` |
| `assignment_role` | `role` | `REFEREE`, `SCOREKEEPER`, `HEAD_REFEREE` |
| `expires_at` | `token_expires_at` | Assignment expiry; separate from token hash |
| `status` | `status` | `active`, `revoked`, `completed` |

### match_live_states

| Spec field | V5-D column | Notes |
|------------|-------------|-------|
| `state_version` | `state_version` (+ legacy `version`) | Optimistic lock |
| `state_payload` | `state_payload` jsonb | Canonical V5-B state |
| `scoring_format` | `scoring_format` jsonb | From V5-A |
| `updated_by` | `updated_by` | Added in V5-D patch |
| `locked_at` / `locked_by` | existing | Set on finalize |

### match_events

| Spec field | V5-D column | Notes |
|------------|-------------|-------|
| `command_type` | `command_type` | Client intent |
| `command_payload` | `command_payload` | No official score fields |
| `state_before_hash` / `state_after_hash` | added | Divergence detection |
| `generated_events` | added | Domain events from engine |
| Idempotency | `idempotency_key` + partial unique index | Duplicate `(match_state_id, key)` rejected |

### Idempotency strategy

**Decision:** Reuse `match_sync_mutations` (V5-A) instead of new `match_command_idempotency` table.

- Unique `(match_state_id, idempotency_key)`
- Stores `response_payload`, `resulting_event_sequence`, `resulting_state_version`
- Aligns with team-tournament command log pattern

### match_result_revisions

Status values expanded to: `draft`, `confirmed`, `disputed`, `overridden`, `locked`, `cancelled`, `void`.

Added: `supersedes_revision`, `confirmed_by`, `confirmed_at`, `created_by`.

---

## 4. New RPC functions (draft)

| RPC | Purpose |
|-----|---------|
| `referee_v5_get_match_state` | Read snapshot + metadata |
| `referee_v5_apply_match_command` | Transaction shell + auth; engine in JS |
| `referee_v5_finalize_match_result` | Transaction shell + auth; full flow in JS |

`match_state_id` format: `{tenant_id}::{tournament_id}::{match_id}`

---

## 5. Objects intentionally not duplicated

| Spec mention | Decision |
|--------------|----------|
| `match_command_idempotency` | Use `match_sync_mutations` |
| Second scoring engine in SQL | **Rejected** — Approach C |
| Token table for V5 | Deferred — use authenticated assignment only in V5-D |

---

## 6. Staging verification (after owner GO)

1. `list_tables` — confirm V5-A + V5-D patches applied  
2. RLS advisor — no anon write on `match_events`  
3. Integration tests against staging Supabase  
4. Snapshot vs replay hash check  

**Current:** NOT RUN
