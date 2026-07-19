# Club Phase 2B — API Freeze

**Status:** FROZEN / **LOCKED** (documentation only)  
**Date:** 2026-07-19  
**Authority:** Phase 2B Domain & API Freeze  
**Phase status:** Phase 2A CLOSED · Phase 2B LOCKED · Next: Phase 2C (not started)  
**Implements:** [CLUB_PHASE2_DOMAIN_FREEZE.md](./CLUB_PHASE2_DOMAIN_FREEZE.md)  
**As-built inventory (non-normative):** [CLUB_API_AUDIT.md](./CLUB_API_AUDIT.md)  
**Cardinality:** Captain **0..N** + optional primary · Coach **0..N** · Committee excluded

---

## 1. Visibility

| Tag | Meaning |
|-----|---------|
| **public** | Peer modules may call via Club public barrel / published ports |
| **internal** | Club UI / Club services only |
| **deprecated** | Must not be used on V2 Production path; removal in 2G |

---

## 2. Shared command contract

Every **mutating** Club command (Phase 2 target):

| Concern | Rule |
|---------|------|
| Idempotency | Required `idempotency_key` (UUID/string); replay returns prior result |
| Expected version | Required when mutating versioned aggregate/row; conflict → error |
| Actor | Authenticated user; server re-checks authz (client gates non-authoritative) |
| Tenant | Derived from club; reject cross-tenant |
| Audit | Emit named audit event on success |
| Transport | SECURITY DEFINER RPC (Production V2) |
| Response | `{ ok, data?, version?, error? }` shape (compatible with Phase 42 style) |

### Standard error codes (freeze)

| Code | When |
|------|------|
| `UNAUTHORIZED` | Not authenticated |
| `FORBIDDEN` | Authenticated but actor policy fails |
| `NOT_FOUND` | Club / member / request / invitation missing |
| `VERSION_CONFLICT` | `expected_version` mismatch |
| `IDEMPOTENCY_CONFLICT` | Same key, different payload |
| `VALIDATION_ERROR` | Invalid args / cardinality (e.g. VP > 2) |
| `INVALID_STATE` | Illegal lifecycle transition |
| `TENANT_MISMATCH` | Cross-tenant attempt |
| `FEATURE_DISABLED` | V2-OFF / legacy path blocked |
| `ALREADY_EXISTS` | Duplicate pending invite/request/membership |
| `EXPIRED` | Invitation past `expires_at` |
| `PRECONDITION_FAILED` | e.g. assign Captain without active membership |

---

## 3. Club entity APIs

| API | Kind | Actor policy | expected_version | Idempotency | Audit | SoT | Visibility |
|-----|------|--------------|------------------|-------------|-------|-----|------------|
| `club.get` | Query | Member / tenant staff per visibility rules / SA | No | No | — | `clubs` | **public** |
| `club.list` | Query | Registry scope (tenant/platform) + visibility | No | No | — | `clubs` | **public** |
| `club.create` | Command | Self-register / tenant create policy + plan limit | No (new row) | **Yes** | `club.created` | `clubs` | **internal** (UI/Club); peers generally must not create |
| `club.update` | Command | `phase42_can_update_club` / Owner·President·assigner | **Yes** (club) | **Yes** | `club.updated` | `clubs` | **internal** |
| `club.deactivate` | Command | Owner / assigner / SA | **Yes** | **Yes** | `club.deactivated` | `clubs` | **internal** |

**Deprecated:** `persistClubToCloud`, `club_upsert_registry`, domain `saveClubs` as cloud authority.

---

## 4. Membership APIs

| API | Kind | Actor policy | expected_version | Idempotency | Audit | SoT | Visibility |
|-----|------|--------------|------------------|-------------|-------|-----|------------|
| `membership.list` | Query | Full list: Owner/President/VP; summary: venue staff; member self rules per matrix | No | No | — | `club_members` | **public** (Competition roster read uses scoped variant) |
| `membership.listActiveRoster` | Query | Competition / Club; active only; minimal PII | No | No | — | `club_members` | **public** |
| `membership.add` | Command | Owner / President (not VP delete rights; add per existing gates) | **Yes** | **Yes** | `membership.added` | `club_members` | **internal** |
| `membership.leave` | Command | Self; block if protected governance without transfer | **Yes** | **Yes** | `membership.left` | `club_members` | **internal** |
| `membership.remove` | Command | Owner / President; **not** VP; not protected titles without rules | **Yes** | **Yes** | `membership.removed` | `club_members` | **internal** |
| `membership.restore` | Command | Owner / President | **Yes** | **Yes** | `membership.restored` | `club_members` | **internal** |

**Public read for peers:** `membership.listActiveRoster` + `club.get` governance refs.  
**Forbidden to peers:** add/leave/remove/restore commands.

**Deprecated:** extension `members[]` writers; Phase 31 membership RPC client under V2 ON.

---

## 5. Join Request APIs

| API | Kind | Actor policy | expected_version | Idempotency | Audit | SoT | Visibility |
|-----|------|--------------|------------------|-------------|-------|-----|------------|
| `joinRequest.create` | Command | Authenticated player; discoverable club rules | No / request | **Yes** | `join_request.created` | requests_v42 | **internal** |
| `joinRequest.approve` | Command | Owner / President / VP (`canReviewMembership`) | **Yes** | **Yes** | `join_request.approved` (+ membership.added) | requests_v42 + members | **internal** |
| `joinRequest.reject` | Command | Owner / President / VP | **Yes** | **Yes** | `join_request.rejected` | requests_v42 | **internal** |
| `joinRequest.cancel` | Command | Requester (own pending) | **Yes** | **Yes** | `join_request.cancelled` | requests_v42 | **internal** |
| `joinRequest.listPending` | Query | Reviewers for club | No | No | — | requests_v42 | **internal** |
| `joinRequest.listMine` | Query | Self | No | No | — | requests_v42 | **internal** |

---

## 6. Invitation APIs (Phase 2 — GO; implement 2E)

| API | Kind | Actor policy | expected_version | Idempotency | Audit | SoT | Visibility |
|-----|------|--------------|------------------|-------------|-------|-----|------------|
| `invitation.create` | Command | **Working default:** Owner / President / VP (review class). **Final actor policy deferred to Phase 2E** | **Yes** (club) | **Yes** | `invitation.created` | `club_invitations` | **internal** |
| `invitation.list` | Query | Governance for club; invitee sees own | No | No | — | `club_invitations` | **internal** |
| `invitation.accept` | Command | Invitee only; not expired/revoked | **Yes** (invitation) | **Yes** | `invitation.accepted` (+ membership.added) | invitations + members | **internal** |
| `invitation.reject` | Command | Invitee only | **Yes** | **Yes** | `invitation.rejected` | `club_invitations` | **internal** |
| `invitation.revoke` | Command | Inviter or Owner/President | **Yes** | **Yes** | `invitation.revoked` | `club_invitations` | **internal** |
| `invitation.expire` | Command | System job / lazy on read | No / yes if mutating | **Yes** | `invitation.expired` | `club_invitations` | **internal** |

**Not an Invitation API:** `getClubMembersForTournamentInvite` (Competition UX exception; remains query helper, **deprecated** as “invite” naming).

**Peer visibility:** Notification may consume **events**, not call create/accept.

**Deferred to Phase 2E:** invitee identity (`user_id` vs email/token) and final create-actor lock — must not block 2C/2D.

---

## 7. Governance APIs

| API | Kind | Actor policy | expected_version | Idempotency | Audit | SoT | Visibility |
|-----|------|--------------|------------------|-------------|-------|-----|------------|
| `governance.assignOwner` | Command | SA / tenant_owner (`phase42_can_assign_club_owner`); transfer rules for current owner | **Yes** | **Yes** | `governance.owner_assigned` | assignments | **internal** |
| `governance.clearOwner` | Command | Same as assign | **Yes** | **Yes** | `governance.owner_cleared` | assignments | **internal** |
| `governance.assignPresident` | Command | Owner / assigner / SA (transfer path) | **Yes** | **Yes** | `governance.president_assigned` | assignments | **internal** |
| `governance.clearPresident` | Command | Only via transfer to successor in Phase 2 (no empty president on `active`) | **Yes** | **Yes** | `governance.president_cleared` | assignments | **internal** |
| `governance.assignVp` | Command | `phase42_can_manage_vice_presidents` | **Yes** | **Yes** | `governance.vp_assigned` | assignments | **internal** |
| `governance.clearVp` | Command | Same | **Yes** | **Yes** | `governance.vp_cleared` | assignments | **internal** |
| `governance.get` | Query | Per club visibility | No | No | — | assignments | **public** (refs) |

**Deprecated:** local `updateClubMeta` as Production governance writer.

---

## 8. Captain / Coach APIs (Phase 2 — GO; implement 2E)

**Cardinality (Owner locked):** Captain **0..N** (optional primary) · Coach **0..N**. Do **not** reject assign solely because another captain/coach already exists.

| API | Kind | Actor policy | expected_version | Idempotency | Audit | SoT | Visibility |
|-----|------|--------------|------------------|-------------|-------|-----|------------|
| `roster.assignCaptain` | Command | Owner / President (VP: **no**) | **Yes** | **Yes** | `roster.captain_assigned` | `club_roster_assignments` | **internal** |
| `roster.clearCaptain` | Command | Owner / President | **Yes** | **Yes** | `roster.captain_cleared` | roster assignments | **internal** |
| `roster.setPrimaryCaptain` | Command | Owner / President; target must be an active captain; clears prior primary if any | **Yes** | **Yes** | `roster.captain_primary_set` | roster assignments | **internal** |
| `roster.clearPrimaryCaptain` | Command | Owner / President; leaves all captains active | **Yes** | **Yes** | `roster.captain_primary_cleared` | roster assignments | **internal** |
| `roster.listCaptains` | Query | Full member viewers; includes `is_primary` | No | No | — | roster assignments | **public** (Competition optional) |
| `roster.assignCoach` | Command | Owner / President | **Yes** | **Yes** | `roster.coach_assigned` | roster assignments | **internal** |
| `roster.clearCoach` | Command | Owner / President | **Yes** | **Yes** | `roster.coach_cleared` | roster assignments | **internal** |
| `roster.listCoaches` | Query | Full member viewers | No | No | — | roster assignments | **public** (Competition optional) |

**Rules:** At most **one** primary captain when a primary is set; primary is optional. Coach has **no** primary concept in Phase 2. Coach specialization APIs are **out of scope** (future metadata only).

**Deprecated:** `updateClubMemberRole` local extension as cloud SoT.

---

## 9. Approved peer-facing surface (summary)

Peers may use **only**:

- `club.get`, `club.list` (scoped)
- `governance.get` (references)
- `membership.listActiveRoster` (and privacy-safe member summary where already specified)
- `roster.listCaptains`, `roster.listCoaches` (optional metadata)

All other commands are **internal** to Club / Club UI.

---

## 10. Mapping to existing RPCs (transition)

| Freeze API | Existing RPC (if any) | Gap |
|------------|----------------------|-----|
| club.* | `club_get`, `club_list_*`, `club_create`, `club_update` | deactivate naming |
| membership.* | `club_list_members`, add/remove/restore/leave | certify + harden |
| joinRequest.* | submit/cancel/review/list | retire Phase 31 client |
| invitation.* | — | **new** 2E |
| governance.* | assign/clear owner, transfer president, VP RPCs | certify 2D; clearPresident policy |
| roster.* | — | **new** 2E (`club_roster_assignments`) |

---

## 11. Amendment rule

API additions require domain freeze compatibility, writer policy update, import allow-list check, and acceptance-gate updates.

**API freeze is LOCKED for Phase 2B exit.**
