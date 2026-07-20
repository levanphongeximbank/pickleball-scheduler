# Phase 1H-C — Actions Implementation Evidence

**Sub-phase:** **1H-C only** — Admin verification actions (authorized UI + confirmation)  
**Owner decision:** `AUTHORIZE_PHASE_1H_C_IMPLEMENTATION`  
**Branch:** `feature/player-phase-1h-c-verification-actions`  
**Base main:** `f0a4e83859503c202fbcceef6e808b2ba09a330a` (PR #106 / 1H-B merge)  
**Scope freeze:** `00_PHASE_1H_SCOPE_FREEZE.md`  
**Depends on:** Phase 1H-A writer + Phase 1H-B queue read  
**Date:** 2026-07-20

---

## 1. Summary

Phase 1H-C connects a minimal admin verification queue UI to the existing authorized APIs:

- **Read:** `listPlayerVerificationQueue` (1H-B)
- **Write:** `updatePlayerVerificationStatus` (1H-A) — sole mutation path

Every mutation requires an explicit confirmation dialog. Queue state refreshes after successful writes. Audit remains owned by the Phase 1H-A service (UI never writes audit). No SQL, schema, Production mutation, self-service verification, bulk actions, or deploy.

---

## 2. Route / admin entry point

| Item | Value |
|------|-------|
| Route | `/users/verification` |
| Page | `src/pages/AdminPlayerVerificationPage.jsx` |
| Integration | Narrow leaf next to User Management (`/users`) in Admin menu |
| Route permission | `USER_MANAGE` only (stricter than `/users`) |
| UI gate | `PermissionGate` (UX only — APIs still enforce authz) |

**Not used:** embedding into `UserManagementPage` create/edit/password shell (still not a defensible mutation surface without redesign). Optional Phase 1H-D may deepen User Management shell integration if Owner wants a tab/panel there.

---

## 3. Files added / modified

### Added

| File | Role |
|------|------|
| `src/features/player/utils/verificationAdminActions.js` | Transition → action labels + confirmation payload |
| `src/features/player/utils/adminVerificationQueueController.js` | Testable load / confirm / mutate / refresh controller |
| `src/features/player/components/AdminPlayerVerificationQueue.jsx` | Minimal queue + actions UI |
| `src/pages/AdminPlayerVerificationPage.jsx` | Route page shell |
| `tests/player-management-phase-1h-c-verification-actions.test.js` | Focused 1H-C tests |
| `docs/player-management/phase-1h/05_PHASE_1H_C_ACTIONS_IMPLEMENTATION_EVIDENCE.md` | This evidence |

### Modified

| File | Change |
|------|--------|
| `src/router.jsx` | Lazy route `/users/verification` |
| `src/config/navigationConfig.js` | `ROUTE_PERMISSIONS` entry |
| `src/config/v5Menu/adminMenu.js` | Menu leaf “Xác minh VĐV” |
| `src/features/player/index.js` | Comment only (no new public exports) |
| `scripts/ci/unit-test-files.json` | Register 1H-C tests |
| `docs/player-management/phase-1h/02_SUBPHASE_PLAN.md` | Mark 1H-C status |

---

## 4. Queue API used

```js
listPlayerVerificationQueue({ status, query, ... })
```

- Default UI filter: **`pending`** (`VERIFICATION_QUEUE_DEFAULT_STATUS`)
- Supported filters: pending \| unverified \| rejected \| verified
- Search: passed as `query` to the 1H-B API (displayName / playerId / authUserId)

---

## 5. Mutation API used

```js
updatePlayerVerificationStatus(playerId, nextStatus, options)
```

- Called only after confirmation
- Duplicate submission blocked while `mutating === true`
- No `updatePlayerProfile` path
- No direct Supabase client calls from UI/controller

---

## 6. Transition → action mapping

Derived **only** from `VERIFICATION_TRANSITION_MATRIX` (1H-A). Matrix **not** broadened.

| Current status | Available next statuses (actions) |
|----------------|-----------------------------------|
| `unverified` | `pending`, `verified`, `rejected` |
| `pending` | `unverified`, `verified`, `rejected` |
| `verified` | `unverified` |
| `rejected` | `unverified`, `pending` |

UI labels (Vietnamese) map explicitly to canonical statuses; confirmation dialog always shows both label and canonical token.

Invalid transitions are **not** rendered as action controls.

---

## 7. Confirmation behavior

1. Admin clicks a valid action → `requestAction` opens dialog.
2. Dialog shows: target Player (display name / id), current status, intended next status.
3. **Cancel** → clears pending confirm; **no write**.
4. **Confirm** → single `updatePlayerVerificationStatus` call.
5. While mutating, confirm/cancel/actions are disabled / duplicate confirm rejected.

---

## 8. Loading / error / success / empty / denied

| State | Behavior |
|-------|----------|
| Loading | Spinner + status region |
| Ready | Queue table with actions |
| Empty | Info alert — no rows for current filter |
| Denied | Warning alert from queue API authz failure |
| Load error | Error alert; queue empty |
| Mutation error | Normalized message; **row retained** (no optimistic success) |
| Success | Success alert + deterministic queue refresh |

---

## 9. Authorization model

- Route hiding / `PermissionGate` is **insufficient alone**.
- Reads still authorized inside `listPlayerVerificationQueue`.
- Writes still authorized inside `updatePlayerVerificationStatus`.
- Unauthorized callers receive deterministic **denied** UI state from API codes.
- Component does **not** re-implement Identity RBAC.

---

## 10. Tenant / venue enforcement

Unchanged from 1H-A / 1H-B:

- Venue-scoped `user.manage` cannot cross venues.
- Platform admins follow existing short-circuit + permission checks.
- Cross-tenant/venue targets remain blocked by services.

---

## 11. Rendered DTO fields (privacy)

Only Phase 1H-B admin queue DTO fields:

- `playerId`
- `authUserId` (operational reference in secondary text)
- `displayName`
- `activityRegion`
- `verificationStatus`
- `venueId`
- `updatedAt`

### Sensitive fields excluded

Never rendered/fetched by this UI:

- `privacy_settings` / privacy objects
- email, phone
- birth data, handedness
- tokens / auth metadata
- raw roles / permissions
- unrelated profile fields

---

## 12. Audit ownership

**Phase 1H-A service only** (`updatePlayerVerificationStatus` → `writeAuditLog`).  
UI / controller contain **no** audit writes.

---

## 13. Rejection reason handling

**Deferred.**

No canonical audited reason field exists on the 1H-A writer contract. Phase 1H-C does **not**:

- add SQL / schema for reason
- invent an unaudited local-only reason field
- pass free-text reason into the mutation API

Confirmation notes that rejection reason is deferred.

---

## 14. Tests

| Suite | Result |
|-------|--------|
| Focused 1H-C | **18/18 PASS** |
| Phase 1H-A | **14/14 PASS** |
| Phase 1H-B | **17/17 PASS** |
| Player Management regressions (1B–1H-C) | **210/210 PASS** |
| ESLint (changed files) | **PASS** (clean) |

Coverage includes: authorized load, denied state, default pending, status filter, search wiring, valid/invalid actions, confirmation required, cancel no-write, single mutation call, duplicate block, refresh on success, retain row on failure, normalized error, no direct db/audit/profile-verification write in UI, sensitive field exclusion, rejection reason deferred, evidence SQL=None.

---

## 15. SQL / schema / Production / deploy

| Check | Result |
|-------|--------|
| New SQL | **None** |
| Schema changes | **None** |
| Production mutation | **None** |
| Deploy | **None** |

---

## 16. Optional Phase 1H-D decision

| Option | Recommendation |
|--------|----------------|
| Deeper User Management tab/panel embedding | **Optional 1H-D** — only if Owner wants verification inside `/users` shell |
| Keep dedicated `/users/verification` leaf | **Accepted for 1H-C** — minimal, adjacent, no global nav redesign |

Owner may:

- accept 1H-C as sufficient entry, skip 1H-D; or
- authorize 1H-D to embed/link from User Management without expanding scope into full Admin Player Management.

---

## 17. Exact Owner action next

Pre-commit review of this working tree, then Owner-authorized commit (and later PR) when ready.  
Do **not** commit / push / open PR from this agent turn.  
Do **not** authorize Production SQL/deploy under this sub-phase.
