# PHASE 45A.4D.1 — MEMBER RESTORE RPC REPORT

**Status:** Authored only — **NOT deployed / NOT executed** on Staging or Production.

**Branch intent:** `integration/phase45a4d1-member-restore-rpc`

---

## 1. Owner role / status decisions recorded (45A.4D.0B)

| Decision | Lock |
|---|---|
| Roster titles captain/coach/manager | **Option A — deferred** (no column, no table, no role RPC) |
| `membership_type` | Participation only; canonical value **`regular`** |
| Governance | `club_owner` / `president` / `vice_president` remain in `club_governance_assignments` |
| Status RPC | **No** `club_update_member_status` |
| `inactive` | Legacy/blob-only — **never** written to `public.club_members` |

Lifecycle:

| Transition | Command |
|---|---|
| active → left | `club_leave_membership` |
| active → removed | `club_remove_member` |
| left → active | `club_add_member` |
| removed → active | **`club_restore_member`** (this phase) |

---

## 2. RPC signature

```sql
public.club_restore_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_expected_version integer default null
) returns json
```

- `SECURITY DEFINER`, `search_path = public`
- `GRANT EXECUTE … TO authenticated`
- File: `docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql`

---

## 3. State-transition contract

| Prior state | Result |
|---|---|
| `removed` (most recent) | UPDATE same row → `active`; `left_at = null`; `version + 1`; preserve `membership_type` |
| `active` | `ALREADY_MEMBER` |
| `left` only (no removed) | `CONFLICT` — use `club_add_member` |
| No history | `NOT_FOUND` — use `club_add_member` |

Hard rules:

- No second INSERT row
- No governance assignment writes
- No `inactive` status
- No `profiles.club_id` authority
- Soft restore only (no `DELETE FROM club_members`)

---

## 4. Authorization

Mirrors **`club_add_member`** (admit / re-admit class — not admin-remove):

- `phase42_is_platform_super_admin()`, **or**
- `phase42_can_review_membership(club_id)` (owner / president / VP / tenant staff with `club.membership.review`)

Rationale: restore is non-destructive re-admission. VP alone is denied on **`club_remove_member`** but permitted on add/review; restore follows add.

---

## 5. Idempotency / concurrency

| Mechanism | Detail |
|---|---|
| Request id | Required → else `REQUEST_ID_REQUIRED` |
| Idempotency | `phase42_idempotency_get/put` key `club_restore_member` |
| Row lock | Club `FOR UPDATE`; target removed membership `FOR UPDATE` |
| Version | Optional `p_expected_version` → `VERSION_CONFLICT` |
| Active uniq | Pre-check active + `unique_violation` → `ALREADY_MEMBER` |

---

## 6. Audit / error contract

Audit action: **`club.member.restore`**

Payload includes: `request_id`, `from_version`, `prior_status`, `target_status`, `member_id`, `target_user_id`, `membership_type`.

Exactly one audit write on successful non-replayed restore (idempotent replay returns cached response before mutate/audit).

| Server token | Client API map (existing) |
|---|---|
| `NOT_AUTHENTICATED` | `UNAUTHORIZED` |
| `REQUEST_ID_REQUIRED` | `VALIDATION_ERROR` |
| `NOT_FOUND` | `NOT_FOUND` |
| `FORBIDDEN` | `FORBIDDEN` |
| `VALIDATION` | `VALIDATION_ERROR` |
| `ALREADY_MEMBER` | `CONFLICT` |
| `CONFLICT` | `CONFLICT` |
| `VERSION_CONFLICT` | `CONFLICT` |

No ad-hoc API error codes.

---

## 7. SQL design summary

1. Extend `audit_logs_action_check` with `club.member.restore` (preserves add/remove + lifecycle/governance actions).
2. `CREATE OR REPLACE FUNCTION public.club_restore_member(...)`.
3. Athlete fill via `phase42n_ensure_athlete_for_user` only when `athlete_id` is null.
4. Response envelope: `{ ok, data: { id, club_id, user_id, athlete_id, status, membership_type, restored, from_version }, version }`.

---

## 8. Intentionally NOT authored

- `club_update_member_role` / `club_update_member_status`
- Captain/coach/manager schema or `roster_role`
- Runtime / UI / feature-flag / migration apply

---

## 9. Next phase

**45A.4D.2 — Staging apply + behavioral QA** for `club_restore_member` only.

Then Production apply → runtime wiring (`rpcV2ClubRestoreMember` + service/UI) → retire leftover blob status toggles if still relevant.

---

## 10. Rollback (after a future apply)

- `DROP FUNCTION public.club_restore_member(uuid, text, uuid, integer);`
- Revert audit CHECK to the prior Phase 45A.4C.1 whitelist (without `club.member.restore`) if required
- No data migration to reverse soft restores individually (manual ops if needed)

---

## Verdict (authoring)

**PASS — authored SQL + contract tests; READY TO COMMIT for 45A.4D.1 review.**

SQL executed: **NO**  
Deployed: **NO**
