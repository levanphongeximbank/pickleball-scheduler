# Phase 1H-B — Queue Implementation Evidence

**Sub-phase:** **1H-B only** — Admin Player verification queue (read/query foundation)  
**Owner decision:** `AUTHORIZE_PHASE_1H_B_IMPLEMENTATION`  
**Branch:** `feature/player-phase-1h-b-verification-queue`  
**Scope freeze:** `00_PHASE_1H_SCOPE_FREEZE.md`  
**Depends on:** Phase 1H-A (`updatePlayerVerificationStatus`)  
**Date:** 2026-07-20

---

## 1. Summary

Phase 1H-B adds an explicit privileged read API `listPlayerVerificationQueue` that lists Player records for admin verification review. Authorization reuses Identity `user.manage` + venue/platform rules. Results are projected through an internal admin queue DTO (not the public projector). No approve/reject/reset UI, no verification mutations, no SQL, no schema, no Production mutation, no deploy.

---

## 2. Files changed

### Added

| File | Role |
|------|------|
| `src/features/player/services/listPlayerVerificationQueue.js` | Privileged queue read service |
| `src/features/player/projectors/projectAdminVerificationQueueItem.js` | Internal admin queue DTO projector |
| `src/features/player/repositories/verificationQueueRepository.js` | Narrow profiles list source (injectable) |
| `src/features/player/constants/verificationQueue.js` | Default status, limits, error codes |
| `tests/player-management-phase-1h-b-verification-queue.test.js` | Focused 1H-B tests |
| `docs/player-management/phase-1h/04_PHASE_1H_B_QUEUE_IMPLEMENTATION_EVIDENCE.md` | This evidence |

### Modified

| File | Change |
|------|--------|
| `src/features/player/index.js` | Export queue API + DTO helpers |
| `tests/player-management-phase-1c-profile-fields.test.js` | Public API allowlist includes 1H-B exports |
| `scripts/ci/unit-test-files.json` | Register 1H-B test file |
| `docs/player-management/phase-1h/02_SUBPHASE_PLAN.md` | Mark 1H-B status |

---

## 3. Queue API

```js
listPlayerVerificationQueue(options?)
```

### Options

| Option | Behavior |
|--------|----------|
| `status` | `pending` \| `unverified` \| `rejected` \| `verified`. Default: **`pending`**. Unsupported values rejected. |
| `venueId` | Optional filter. Venue-scoped callers cannot request another venue. |
| `query` / `q` / `search` | Case-insensitive match on display name, playerId, authUserId |
| `limit` | Default `50`, hard cap `100` |
| `user` / `rbacEnabled` / `listProfileRows` | Test / DI overrides |

### Success shape

```js
{
  ok: true,
  data: [ /* admin queue DTO items */ ],
  meta: {
    count, limit, status, statusDefaulted,
    venueId, query, readOnly: true,
    sort: "updatedAt_desc_playerId_asc",
    maxLimit: 100,
  },
  errors: [],
}
```

Also exported:

- `VERIFICATION_QUEUE_DEFAULT_STATUS` / `DEFAULT_LIMIT` / `MAX_LIMIT` / `SUPPORTED_STATUSES` / `ERROR_CODES`
- `projectAdminVerificationQueueItem`
- `ADMIN_VERIFICATION_QUEUE_DTO_FIELDS` / `EXCLUDED_FIELDS`

**Not used for queue reads:** public projector, raw UI → Supabase, `updatePlayerVerificationStatus`.

---

## 4. Authorization model

| Rule | Behavior |
|------|----------|
| Unauthenticated | `NOT_AUTHENTICATED` |
| `SUPER_ADMIN` / `PLATFORM_ADMIN` | Allowed (Identity `user.manage` / platform short-circuit) |
| Same-venue `user.manage` (e.g. `TENANT_OWNER`) | Allowed; results scoped to actor venue |
| Staff without `user.manage` (e.g. `VENUE_MANAGER`) | `UNAUTHORIZED` |
| Cross-venue `venueId` request by venue-scoped caller | `UNAUTHORIZED` |
| Cross-venue rows | Excluded from results for venue-scoped callers |

Primitives reused (no second permission system):

- `guardPermission(PERMISSIONS.USER_MANAGE, { venueId })`
- Existing Identity role matrix + `src/auth/rbac.js`
- Same platform-admin short-circuit pattern as Phase 1H-A

Does **not** depend only on client-side route hiding (service enforces authz before listing).

---

## 5. Tenant / venue isolation

- Non–platform admins always filter to their assigned venue.
- Rows with missing `venue_id` are excluded for venue-scoped callers.
- Platform admins may omit `venueId` (all authorized rows) or pass an explicit venue filter.
- Empty authorized list is returned rather than leaking unauthorized existence via error codes for out-of-scope rows (rows simply omitted). Explicit out-of-scope `venueId` requests are rejected.

---

## 6. Supported status filters

| Status | Supported |
|--------|-----------|
| `pending` | Yes (default) |
| `unverified` | Yes |
| `rejected` | Yes |
| `verified` | Yes |
| `all` / unknown | **Rejected** (`UNSUPPORTED_STATUS`) |

**Default:** `pending` (actionable review queue). Missing/empty status does **not** return every Player.

---

## 7. Search / pagination / limit

| Behavior | Detail |
|----------|--------|
| Search | Deterministic substring match on `displayName`, `playerId`, `authUserId` |
| Limit default | `50` |
| Limit max | `100` (hard cap) |
| Pagination | Offset paging not introduced; deterministic limit + sort is the safe bound for 1H-B |

---

## 8. Sorting

Deterministic:

1. `updatedAt` descending (newer first; missing timestamps sort last)
2. Tie-break: `playerId` / `authUserId` ascending

No new schema fields added for sorting.

---

## 9. Queue DTO fields

| Field | Purpose |
|-------|---------|
| `playerId` | Canonical player id |
| `authUserId` | Minimal identity reference for admin ops |
| `displayName` | Queue display |
| `activityRegion` | Review context |
| `verificationStatus` | Queue status |
| `venueId` | Tenant/venue context |
| `updatedAt` | Ordering / freshness when available |

---

## 10. Sensitive fields excluded

Never returned on queue DTOs:

- `privacy_settings` / `privacySettings`
- `email`, `phone`
- birth/handedness/avatar
- roles / permissions
- tokens / passwords
- raw profile rows

Repository default select is also narrow (no privacy/PII columns). Public/directory projector privacy guarantees remain unchanged.

---

## 11. UI scope

**Deferred to optional Phase 1H-D.**

Rationale: existing `/users` User Management shell is create/edit/password focused. Adding a verification queue route or embedding mutation-adjacent UI would require navigation/shell restructuring beyond 1H-B read-foundation scope. Service + facade + tested read model are delivered; no queue page/route in this sub-phase.

---

## 12. Tests

| Suite | Result |
|-------|--------|
| Focused 1H-B | **17/17 PASS** |
| Phase 1H-A writer | **14/14 PASS** |
| Player Management regressions (1B–1H-B) | **192/192 PASS** |

Coverage includes: unauthenticated, unauthorized staff, SUPER_ADMIN, PLATFORM_ADMIN, same-scope `user.manage`, cross-venue exclusion/reject, default pending, explicit status, unsupported status, search, limit, sort, DTO exclusions, privacy exclusion, read-only (no mutation path).

---

## 13. Exclusions (Phase 1H-C and beyond)

- Approve / reject / reset actions
- Verification mutation UI / confirmation modals / bulk actions
- Self-service verification / self → `pending`
- Public Player Directory
- Legacy dossier/blob cutover
- Duplicate merge tooling
- Full Admin Player Management
- SQL / schema / Production mutation / deploy

---

## 14. SQL / Production / deploy status

| Check | Result |
|-------|--------|
| New SQL | **None** |
| Schema changes | **None** |
| Production mutation | **None** |
| Deploy | **None** |
| Consumes existing Production foundation | Yes (`identity_verification_status` + Phase 1E index/guard) |

---

## 15. Exact Owner action next

Pre-commit review of this working tree, then Owner-authorized commit (and later PR) when ready.  
Do **not** start 1H-C action UI until 1H-B is accepted.  
Do **not** authorize Production SQL/deploy under this sub-phase.
