# PHASE 45A.4C.1 — Canonical `club_add_member` / `club_remove_member` RPCs

**Status:** authored, NOT deployed, NOT executed. Runtime cutover is Phase 45A.4C.4.
**Branch:** `integration/phase45a4c-add-remove-member-rpc` (from `origin/main` `c08fe9e`)
**Confidence:** EXACT — contracts from approved Phase 45A.4C readiness audit; conventions proven from leave/review/update command family.

---

## 1. Scope

Author exactly **two** new Membership SSOT write RPCs:

1. `public.club_add_member(...)`
2. `public.club_remove_member(...)`

Plus an `audit_logs_action_check` whitelist patch adding:

- `club.member.add`
- `club.member.remove`

This phase does **not** apply SQL, create a migration, wire runtime, modify UI/services/repositories, change feature flags, modify Supabase data, deploy, commit, push, or create a PR.

---

## 2. Baseline (Phase 45A.4C)

| Fact | Status |
|------|--------|
| Membership reads canonical | ✅ |
| Membership request commands canonical (45A.4B) | ✅ |
| `public.club_members` is Membership SSOT | ✅ |
| Manage Members mutations disabled under V2 | ✅ |
| Canonical add/remove member RPC | ❌ → authored here (not deployed) |

---

## 3. Target architecture (final — wired in 45A.4C.4)

```
UI
  ↓
clubMemberService (add/remove orchestrator — extend in 45A.4C.4)
  ↓
clubStorageV2RpcService
  ↓
club_add_member / club_remove_member
  ↓
public.club_members
```

- No blob roster write
- No `profiles.club_id` authority
- No direct UI Supabase call
- No cloud-failure fallback to local success
- `canonicalMembershipRepository` stays read-only
- `clubMembershipRequestService` remains request/leave/review gateway (not competing)

---

## 4. SQL contract summary

See `PHASE_45A4C1_MEMBER_RPC.sql`.

| Statement | Effect |
|-----------|--------|
| `audit_logs_action_check` alter | Whitelist `club.member.add` / `club.member.remove` (superset of existing) |
| `club_add_member` | INSERT or reactivate `left` → `active` |
| `club_remove_member` | Soft `active` → `removed` (+ end non-protected gov; clear profile links) |
| Grants | `EXECUTE … TO authenticated` |

Shared conventions: `SECURITY DEFINER`, `search_path = public`, `RETURNS json`, `auth.uid()`, `p_request_id`, `phase42_idempotency_get/put`, `phase42_err`, `phase42_write_audit`, club row `FOR UPDATE`, no hard `DELETE`.

---

## 5. `club_add_member`

```
public.club_add_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_membership_type text default 'regular',
  p_expected_version integer default null
) returns json
```

| Concern | Behavior |
|---------|----------|
| Auth | `auth.uid()` required |
| Idempotency | scoped `club_add_member` |
| Club | exists + `deleted_at is null` else `NOT_FOUND` |
| Authz | SA **or** `phase42_can_review_membership(club)` (owner/president/VP **or** tenant staff + `club.membership.review`) |
| Target | `auth.users` exists else `NOT_FOUND`; null → `VALIDATION` |
| Active duplicate | `ALREADY_MEMBER` |
| `left` history | REACTIVATE to `active`; optional `p_expected_version` → `VERSION_CONFLICT` |
| `removed` history (no left) | `CONFLICT` — restore RPC out of scope |
| Never-seen | INSERT `status='active'`, `version=1`, athlete via `phase42n_ensure_athlete_for_user` |
| Audit | `club.member.add` |
| Response `data` | `{ id, club_id, user_id, athlete_id, status, membership_type, reactivated }` |

---

## 6. `club_remove_member`

```
public.club_remove_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_expected_version integer default null
) returns json
```

| Concern | Behavior |
|---------|----------|
| Auth | `auth.uid()` required |
| Idempotency | scoped `club_remove_member` |
| Authz | SA **or** gov `club_owner`/`president` **or** (permission `club.membership.review` + tenant member). **VP alone → FORBIDDEN** |
| Target | active member else `NOT_MEMBER` |
| Version | optional `p_expected_version` → `VERSION_CONFLICT` |
| Governance | active president/owner on target → `GOVERNANCE_BLOCK` |
| Soft remove | `status='removed'`, `left_at=now()`, version bump — **not** `'left'` |
| Gov cleanup | end active assignments for that member (after block check) |
| Profile links | `phase42_clear_profile_club_links(target)` |
| History | row preserved; no hard delete |
| Audit | `club.member.remove` |
| Response `data` | `{ id, club_id, user_id, status: 'removed', version }` |

**Semantic distinction:** `club_leave_membership` = self → `left`; `club_remove_member` = admin → `removed`.

---

## 7. Add-vs-restore decision (locked)

| Prior state | `club_add_member` |
|-------------|-------------------|
| No row | INSERT |
| `left` | REACTIVATE |
| `removed` (no `left`) | REJECT `CONFLICT` |
| `active` | `ALREADY_MEMBER` |

`club_restore_member` remains **out of scope** for 45A.4C.

---

## 8. Error / audit contract

Server tokens use the existing Phase 42 vocabulary. Client remapping remains `mapClubCommandError` (extend in 45A.4C.4 if `VALIDATION` is missing from the map).

| Server token | Intended API map |
|--------------|------------------|
| `NOT_AUTHENTICATED` | `UNAUTHORIZED` |
| `REQUEST_ID_REQUIRED` | `VALIDATION_ERROR` |
| `NOT_FOUND` | `NOT_FOUND` |
| `FORBIDDEN` | `FORBIDDEN` |
| `VALIDATION` | `VALIDATION_ERROR` |
| `ALREADY_MEMBER` | `CONFLICT` |
| `NOT_MEMBER` | `NOT_FOUND` |
| `GOVERNANCE_BLOCK` | `FORBIDDEN` |
| `VERSION_CONFLICT` | `CONFLICT` |
| `CONFLICT` | `CONFLICT` |

---

## 9. Non-goals / freeze

- No SQL apply / migration / Staging or Production execution
- No runtime / UI / service / repository edits
- No feature-flag changes
- No Supabase data modification
- No blob roster mutation
- No `club_restore_member` / role / status RPCs
- Billing SQL stash untouched

---

## 10. Next phase

**45A.4C.2 — Apply Staging + QA** against this SQL file (owner-approved apply window).

Then: 45A.4C.3 Production → 45A.4C.4 runtime wiring + enable controls → 45A.4C.5 retire blob add/remove → 45A.4C.Z certification.

---

## 11. STOP checklist

| Constraint | Status |
|------------|--------|
| SQL created (authored) | **YES** (`docs/v5/phase45a4c1/`) |
| SQL applied / executed | **NO** |
| Migration created | **NO** |
| Runtime / UI / services modified | **NO** |
| Feature flags changed | **NO** |
| Supabase data modified | **NO** |
| Deploy / commit / push / PR | **NO** |
