# Club Phase 2B — Domain Freeze

**Status:** FROZEN (documentation only)  
**Date:** 2026-07-19  
**Authority:** Phase 2B Domain & API Freeze  
**Supersedes for implementation intent:** as-built notes in `CLUB_DOMAIN_MODEL.md` where they conflict  
**Product decisions:** Invitation **GO** · Captain **GO** · Coach **GO** · Committee **DEFER**  
**Phase status:** Phase 2A **CLOSED** · Phase 2B **LOCKED** · Next implementation: **Phase 2C** (not started)

---

## 1. Freeze statement

Phase 2 Club Management **owns** only the entities in §3.  
All entities in §4 are **explicitly excluded** from Club ownership.  
No code/SQL may contradict this freeze without a new Owner decision and freeze amendment.

### Owner cardinality & deferred decisions (locked)

| Decision | Value | Target phase |
|----------|-------|--------------|
| Captain cardinality | **0..N** — multiple allowed; **not** single-Captain | 2E schema |
| Primary Captain | **Optional** designation among captains (at most one primary when set) | 2E |
| Coach cardinality | **0..N** — multiple allowed; **not** single-Coach | 2E schema |
| Coach specialization | Future metadata **may** extend base assignment; must **not** replace it | Post-2E / later |
| Committee | **Excluded** from Phase 2 | Post–Phase 2 |
| Invitation actor policy (who may create) | **Deferred** — freeze default exists; final lock in | **2E** |
| Invitation identity (user_id vs email/token) | **Deferred** | **2E** |
| Rating ownership (Club Ratings tab) | **Deferred** | **2F** |
| Activity-schedule long-term ownership | **Deferred** | **2F** |

---

## 2. Shared platform rules (all Club entities)

| Rule | Value |
|------|--------|
| Multi-tenant scope | Every row scoped by `tenant_id` (venue/tenant of the club) |
| Identity keys | Prefer `user_id` (auth) + optional `player_id` / `athlete_id` **references** — never redefine person SoT |
| Write plane | SECURITY DEFINER RPCs only when `VITE_CLUB_STORAGE_V2` Production path |
| Versioning | Parent `clubs.version` and/or row `version`; commands carry `expected_version` where mutating shared aggregates |
| Idempotency | Client `idempotency_key` required on all mutating commands |
| Audit | Every successful mutation → `phase42_write_audit` (or successor) with actor, club_id, tenant_id, action, before/after refs |
| Soft delete preference | Prefer status transitions over hard delete; hard delete only via explicit admin policy later |
| Flag-off | Offline/V2-OFF writers are **non-Production**; must not invent second SoT |

---

## 3. Club-owned entities (Phase 2)

### 3.1 Club

| Field | Freeze |
|-------|--------|
| **Canonical name** | `Club` · table `public.clubs` |
| **Source of truth** | `public.clubs` |
| **Lifecycle** | create → (`pending_approval` \| `pending_setup` \| `active`) → `inactive` (soft) |
| **Status values** | `active` \| `inactive` \| `pending_setup` \| `pending_approval` |
| **Authoritative writer** | Club → `clubTenantService` → `club_create` / `club_update` |
| **Allowed readers** | Club UI; peers via allow-listed read APIs |
| **Versioning** | `clubs.version` required on update |
| **Audit events** | `club.created`, `club.updated`, `club.deactivated` |
| **Tenant scope** | `tenant_id` / venue binding required |
| **Deletion/retirement** | Soft deactivate via status; hard delete **out of Phase 2** unless separately gated |

---

### 3.2 Club Membership

| Field | Freeze |
|-------|--------|
| **Canonical name** | `ClubMembership` · table `public.club_members` |
| **Source of truth** | `public.club_members` |
| **Lifecycle** | join (add/approve/accept-invite) → `active` → `left` \| `removed` → optional `restore` → `active` |
| **Status values** | `active` \| `left` \| `removed` (UI may map legacy `inactive` → non-active) |
| **Authoritative writer** | Club membership command plane (`club_add_member`, `club_remove_member`, `club_restore_member`, `club_leave_membership`, approve-request / accept-invite side effects) |
| **Allowed readers** | Club; Competition (active roster); Notification (recipients); Ranking/AI (read); Player (membership refs) |
| **Versioning** | Member row `version` and/or club aggregate version per RPC contract |
| **Audit events** | `membership.added`, `membership.left`, `membership.removed`, `membership.restored` |
| **Tenant scope** | Club’s `tenant_id` |
| **Deletion/retirement** | Status `removed`/`left`; no silent physical delete in Phase 2 |

**Note:** Base membership role in V2 remains membership edge; Captain/Coach are **separate assignment entities** (§3.6–3.7), not a substitute for membership.

---

### 3.3 Join Request

| Field | Freeze |
|-------|--------|
| **Canonical name** | `ClubJoinRequest` · table `public.club_membership_requests_v42` |
| **Source of truth** | `public.club_membership_requests_v42` |
| **Lifecycle** | create → `pending` → `approved` \| `rejected` \| `cancelled` |
| **Status values** | `pending` \| `approved` \| `rejected` \| `cancelled` |
| **Authoritative writer** | Club → join-request services + V2 submit/cancel/review RPCs |
| **Allowed readers** | Requester (own); Owner/President/VP (pending for club); Club UI |
| **Versioning** | Request row version or review idempotency key |
| **Audit events** | `join_request.created`, `join_request.approved`, `join_request.rejected`, `join_request.cancelled` |
| **Tenant scope** | Club’s `tenant_id` |
| **Deletion/retirement** | Terminal statuses retained for audit; purge policy out of Phase 2 |

**Approve side effect:** creates/activates `ClubMembership` in same transactional command path.

---

### 3.4 Invitation

| Field | Freeze |
|-------|--------|
| **Canonical name** | `ClubInvitation` · table **`public.club_invitations`** (new — Phase 2E) |
| **Source of truth** | `public.club_invitations` (cloud only; no local-extension SoT) |
| **Lifecycle** | create → `pending` → `accepted` \| `rejected` \| `revoked` \| `expired` |
| **Status values** | `pending` \| `accepted` \| `rejected` \| `revoked` \| `expired` |
| **Authoritative writer** | Club invitation command plane (new RPCs; see API freeze) |
| **Allowed readers** | Inviter/governance; invitee (own invites); Notification (event payload) |
| **Versioning** | Invitation row `version`; accept/reject require expected version or single-use token semantics |
| **Audit events** | `invitation.created`, `invitation.accepted`, `invitation.rejected`, `invitation.revoked`, `invitation.expired` |
| **Tenant scope** | Club’s `tenant_id` |
| **Deletion/retirement** | Terminal statuses retained; `expire` is system/cron or on-read lazy transition |

**Accept side effect:** creates/activates `ClubMembership` when valid.  
**Not the same as:** tournament invite wizard member list (ephemeral; remains Competition UX exception, not this entity).

**Minimum fields (freeze):** `id`, `tenant_id`, `club_id`, `invited_by_user_id`, `status`, `expires_at`, `message`, `version`, timestamps, optional `player_id` reference.

**Deferred to Phase 2E (do not invent in 2C/2D):** final **actor policy** (whether VP may create invites) and **invitee identity model** (`invited_user_id` vs email/token for non-accounts). API freeze lists a working default; 2E may tighten without changing entity ownership.

---

### 3.5 Governance Assignment

| Field | Freeze |
|-------|--------|
| **Canonical name** | `ClubGovernanceAssignment` · table `public.club_governance_assignments` |
| **Source of truth** | `public.club_governance_assignments` |
| **Lifecycle** | assign → active assignment → clear / transfer (replace) |
| **Role codes** | `club_owner` \| `president` \| `vice_president` |
| **Cardinality** | Owner ≤1 · President ≤1 (required for `active` club) · VP ≤2 |
| **Authoritative writer** | Club governance services + `club_assign_owner` / `club_clear_owner` / `club_transfer_president` / VP RPCs (Phase 1B/1C gates) |
| **Allowed readers** | Club; Identity elevation; Competition (read refs only); Ranking/AI read |
| **Versioning** | Club version and/or assignment version per RPC |
| **Audit events** | `governance.owner_assigned`, `governance.owner_cleared`, `governance.president_assigned`, `governance.president_cleared`, `governance.vp_assigned`, `governance.vp_cleared` |
| **Tenant scope** | Club’s `tenant_id` |
| **Deletion/retirement** | Clear assignment row / mark inactive; retain audit |

**President clear:** only via transfer to a successor in Phase 2 — club must not become `active` without president (G1).

---

### 3.6 Captain Assignment

| Field | Freeze |
|-------|--------|
| **Canonical name** | `ClubCaptainAssignment` |
| **Canonical storage** | **`public.club_roster_assignments`** with `role_code = 'captain'` (new — Phase 2E; designed in 2C) |
| **Source of truth** | `public.club_roster_assignments` (not local `clubMember.role`) |
| **Lifecycle** | assign → active → clear; optional set/clear **primary** |
| **Status values** | `active` \| `cleared` (or row delete + audit; prefer soft clear) |
| **Cardinality** | **0..N** active captains per club — **no** single-Captain enforcement |
| **Primary designation** | **Optional** boolean/flag `is_primary` (or equivalent); **at most one** primary captain when any primary is set; clubs may have captains with **no** primary |
| **Preconditions** | Target must be `ClubMembership` with `status = active` |
| **Authoritative writer** | Club roster-assignment command plane |
| **Allowed readers** | Club UI; Competition (optional roster metadata read) |
| **Versioning** | Assignment version + membership/club expected version as defined in API freeze |
| **Audit events** | `roster.captain_assigned`, `roster.captain_cleared`, `roster.captain_primary_set`, `roster.captain_primary_cleared` |
| **Tenant scope** | Club’s `tenant_id` |
| **Deletion/retirement** | Clear on membership leave/remove (automatic side policy); clearing a primary leaves other captains intact |

---

### 3.7 Coach Assignment

| Field | Freeze |
|-------|--------|
| **Canonical name** | `ClubCoachAssignment` |
| **Canonical storage** | Same table **`public.club_roster_assignments`** with `role_code = 'coach'` |
| **Source of truth** | `public.club_roster_assignments` |
| **Lifecycle** | assign → active → clear |
| **Status values** | `active` \| `cleared` |
| **Cardinality** | **0..N** active coaches per club — **no** single-Coach enforcement |
| **Specialization** | **Not required** in Phase 2. Future specialization (e.g. type/tags) may be added as **metadata on the base assignment** without replacing this model |
| **Preconditions** | Active membership required |
| **Authoritative writer** | Club roster-assignment command plane |
| **Allowed readers** | Club UI; Competition (optional) |
| **Versioning** | Same as Captain |
| **Audit events** | `roster.coach_assigned`, `roster.coach_cleared` |
| **Tenant scope** | Club’s `tenant_id` |
| **Deletion/retirement** | Clear on membership leave/remove |

**Not Phase 2:** `manager` roster title cloud SoT · Committee · Coach specialization schema.

---

## 4. Explicitly excluded from Club ownership

| Concern | Owner module | Club may |
|---------|--------------|----------|
| Player profile / demographics | Player | Reference `player_id` only |
| Rating (Elo / Pick_VN / verification scores) | Rating / Competition | Display via their APIs — **not** Club SoT |
| Ranking / standings | Ranking | Read membership for filters |
| Tournament | Competition | Provide roster eligibility |
| Matchup / bracket / match engine | Competition | Bridge callbacks only (no engine SoT) |
| Activity schedule engine (long-term) | **Deferred to Phase 2F** | Existing schedule remains transitional; ownership decision in 2F |
| Rating / Club Ratings tab SoT | **Deferred to Phase 2F** | Club must not claim rating SoT in Phase 2C–2E |
| Booking | Venue | No ownership |
| Court inventory | Venue | May store `registered_cluster_id` **reference** on Club only |
| Finance transactions / ledger | Finance | No ownership |
| Notification delivery state | Notification | Emit events only |
| Committee | — | **DEFER** — not modeled in Phase 2 |
| Auth RBAC role matrix | Identity | Elevation may react to governance |

---

## 5. Relationship diagram (frozen)

```text
Tenant
  └── Club
        ├── ClubGovernanceAssignment (owner | president | vp×≤2)
        ├── ClubMembership (active | left | removed)
        │     ├── ClubCaptainAssignment (0..N, optional primary)
        │     └── ClubCoachAssignment (0..N)
        ├── ClubJoinRequest (inbound)
        └── ClubInvitation (outbound)
```

Join Request **approve** and Invitation **accept** both converge on **ClubMembership**.

---

## 6. Amendment rule

Any change to §3–§4 requires:

1. Owner product decision recorded  
2. Freeze doc version bump  
3. API freeze + writer policy + acceptance gates updated  
4. No silent schema drift in implementation PRs  

**Domain freeze is LOCKED for Phase 2B exit.**
