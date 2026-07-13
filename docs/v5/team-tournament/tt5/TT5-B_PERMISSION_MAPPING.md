# TT-5B — Permission Mapping

**Phase:** TT-5B  
**Production impact:** NONE

---

## Design principle

Server validates all permissions. Clients must not create or impersonate referee assignments. Assignment ID is passed to provision RPC only after server-side eligibility confirms it belongs to the tournament/match scope.

---

## Action matrix

| Action | Team Tournament permission | Referee V5 gate | Who |
|--------|---------------------------|-----------------|-----|
| **Provision bridge** | `team_tournament_can_manage()` (BTC/Director) | Valid `referee_assignment_id` required | Tournament director / BTC |
| **Assign referee** | Existing TT assignment flow (pre-provision) | `referee_assignments` row active, not expired/revoked | BTC / assignment admin |
| **Open V5 workspace** | Referee with active assignment | Assignment scoped to match/tournament | Assigned referee |
| **Finalize result** | Blocked on legacy when linked | V5 command path (TT-5C consumer) | Assigned referee / director per V5 policy |
| **Revoke link** | `team_tournament_can_manage()` | Only before active/finalized; no event history | BTC / Director |
| **Read bridge (technical)** | BTC/Director via `get_setup` ops fields | — | Staff |
| **Read bridge (referee)** | RLS: assignment-scoped SELECT | Match in assignment scope | Referee |
| **Read bridge (captain/player)** | Minimal: route link only via portal when linked | No technical bridge columns | Captain sees lock message + V5 link in referee portal context |
| **Legacy draft/confirm** | `team.match.result.manage` when **not** linked | N/A | Referee legacy portal |
| **Legacy draft/confirm when linked** | **Denied** server + UI | V5 owns live/final state | — |

---

## Client permission helpers

| Function | Module | Rule |
|----------|--------|------|
| `canProvisionRefereeLink({ permissions })` | `teamPermissionEngine.js` | `canManageTeam()` → director/BTC |
| `canProvisionRefereeLink(refereeLinkOps)` | `teamRefereeV5BridgeEngine.js` | Server `refereeLinkOps.canProvision` |
| `canRevokeRefereeLink(refereeLinkOps)` | `teamRefereeV5BridgeEngine.js` | Server `refereeLinkOps.canRevoke` |
| `canSaveLegacyDraft(scoreOps)` | `teamRefereeV5BridgeEngine.js` | Server flag + no block code |
| `canConfirmLegacyResult(scoreOps)` | `teamRefereeV5BridgeEngine.js` | Server flag + no block code |

---

## Server RPC gates

### `team_tournament_provision_referee_match`

- `auth.uid()` required
- `team_tournament_can_manage()` → FORBIDDEN if false
- `team_tournament_assert_tenant(header.tenant_id)` → cross-tenant denied
- Eligibility helper validates matchup/sub-match/assignment relation
- Idempotency via command table

### `team_tournament_revoke_referee_link`

- Same manage + tenant gates
- Blocked if V5 match active, finalized, or has event history

### Legacy guards (`save_sub_match_draft`, `confirm_sub_match`)

- Check active bridge via `team_tournament_sub_match_score_ops`
- Return structured block codes (not silent fallback)

---

## RLS (bridge table)

| Role | Access |
|------|--------|
| **anon** | REVOKED |
| **authenticated referee** | SELECT where assignment matches `referee_assignment_id` |
| **authenticated BTC/Director** | SELECT/INSERT/UPDATE per tournament tenant scope |
| **service_role** | Server-side only (not exposed to browser) |

RLS policies in `TT5-B_BRIDGE_SCHEMA.sql`. SECURITY DEFINER RPCs set `search_path = public` and derive tenant from tournament header.

---

## What clients must NOT do

- Create `referee_assignments` rows directly for provision
- Bypass provision RPC to insert bridge rows
- Use sub-match UUID as V5 `match_id`
- Fall back to legacy scoring when V5 link is active

---

## TT-5C follow-ups

- Permission for result consumer / standings write-back
- Correction workflow roles
- DreamBreaker-specific assignment policy
