# TT-5B — Implementation Summary

**Phase:** TT-5B Bridge Schema & Provision Contract  
**Branch:** `feature/tt5-referee-v5-integration`  
**Integration merge:** `2140c81782dfdd738bf42603b7bcf7f8df9ed356`  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Production impact:** NONE  
**Date:** 2026-07-13

---

## Scope delivered

TT-5B links Team Tournament sub-matches to Referee V5 matches via a bridge table, server-side provision/revoke RPCs, legacy score lock guards, and a thin client boundary. Out of scope: full result consumer, standings propagation, realtime UI, correction workflow, offline, DreamBreaker, Production.

---

## SQL artifacts (Staging only)

| File | Purpose |
|------|---------|
| `TT5-B_BRIDGE_SCHEMA.sql` | `team_sub_match_referee_links` table, helpers, RLS |
| `TT5-B_PROVISION_RPC.sql` | `team_tournament_provision_referee_match`, `team_tournament_revoke_referee_link`, eligibility |
| `TT5-B_LEGACY_LOCK_GUARD.sql` | Legacy draft/confirm block + `scoreOps` / `refereeLinkOps` builders |
| `TT5-B_GET_SETUP_PATCH.sql` | Exposes `scoreOps` + `refereeLinkOps` on sub-matches in `get_setup` |

Apply: `node scripts/apply-phase-tt5b-staging-sql.mjs` (requires `.env.staging-qa.local` from main worktree).

Verify: `node scripts/verify-phase-tt5b-staging.mjs`

---

## Bridge table

**Table:** `team_sub_match_referee_links`

Key columns: `tenant_id`, `tournament_id`, `matchup_id`, `sub_match_id`, `external_sub_match_id`, `referee_match_id`, `referee_assignment_id`, `status`, `provision_version`, `snapshot` (jsonb), `version`.

**Unique constraints:**

- `unique(sub_match_id)`
- `unique(referee_match_id)`
- `unique(tenant_id, external_sub_match_id)`

**Statuses:** `pending`, `provisioned`, `assigned`, `active`, `finalized`, `sync_error`, `revoked`, `reprovision_required`

Legacy lock applies when status ∈ {pending, provisioned, assigned, active, finalized, sync_error, reprovision_required}.

---

## Provision contract

**RPC:** `team_tournament_provision_referee_match`

**Inputs:** `tournament_id`, `matchup_id`, `sub_match_id`, `referee_assignment_id` (required), `expected_sub_match_version`, `idempotency_key`, `reason`, `source`

**Eligibility gates (server):**

- Caller: `team_tournament_can_manage()` (BTC/Director)
- Tenant scope validated from header, not client
- Matchup published; `requires_republish = false`
- Both lineups published
- Sub-match not finalized/forfeit
- No active bridge link on sub-match
- Valid `referee_assignment_id` for tournament/match scope
- Discipline supported; not DreamBreaker (TT-5B out of scope)
- Version check when `expected_sub_match_version` supplied

**Creates on success:**

- Bridge row (`status = provisioned`)
- Referee V5 `match_live_states` shell (`status = not_started`)
- Snapshot: published lineup versions, matchup/sub-match versions, discipline, court, participant labels

**Output:** `link_id`, `external_sub_match_id`, `referee_match_id`, `referee_assignment_id`, `status`, `version`, `provisioned_at`, `replayed`, `route` (`/referee/match/{external_sub_match_id}`)

**Idempotency:** Same key + same payload → replay prior result. Same key + different payload → `idempotency_payload_mismatch`. Concurrent provision → one link; second request replays or conflicts.

---

## Revoke contract

**RPC:** `team_tournament_revoke_referee_link`

Allowed before match active/finalized and without V5 event history. Blocked after active/finalized. Soft revoke only (`status = revoked`, `revoke_reason`, audit fields); no hard delete.

---

## Client layer

| Module | Role |
|--------|------|
| `teamRefereeV5BridgeEngine.js` | Identity, route, eligibility UI helpers, legacy lock |
| `teamTournamentRpcService.js` | `rpcTeamTournamentProvisionRefereeMatch`, `rpcTeamTournamentRevokeRefereeLink` |
| `cloudTeamTournamentRepository.js` | `provisionRefereeMatch`, `revokeRefereeLink` |
| `teamPermissionEngine.js` | `canProvisionRefereeLink` (BTC/Director) |
| `TeamRefereePortal.jsx` | Read-only legacy score + “Mở Referee V5” when linked |

Pages do not call Supabase directly. Full BTC provision UI deferred (minimal portal lock + link only).

---

## Legacy lock

After bridge reaches `provisioned` or later blocking status:

- UI: no draft save, no confirm; read-only summary + V5 link
- Server: `save_sub_match_draft` and `confirm_sub_match` return block codes

**Error codes:** `referee_v5_linked_legacy_write_blocked`, `referee_v5_match_active`, `referee_v5_result_finalized`

Before provision: legacy path unchanged.

---

## Stale lineup / reprovision

If lineup republish after provision (TT-3 override): link marked `reprovision_required`; legacy and V5 start blocked until resync (TT-5C). TT-5B implements status only.

---

## Tests & evidence

| Layer | Location | Result |
|-------|----------|--------|
| Unit | `tests/team-tournament-tt5b.test.js` | 9/9 PASS |
| Staging DB | `scripts/verify-phase-tt5b-staging.mjs` | PASS (6 reports) |
| Regression | See TT-5B final verdict section | See gate run |

Evidence: `docs/v5/qa-evidence/phase-tt5/TT5B_*.json`

---

## Not in TT-5B

- Full result consumer / standings propagation
- Realtime UI wiring
- Correction workflow
- DreamBreaker provision
- Production SQL deploy
- BTC “Tạo phiên trọng tài” full UI card (minimal portal only)
