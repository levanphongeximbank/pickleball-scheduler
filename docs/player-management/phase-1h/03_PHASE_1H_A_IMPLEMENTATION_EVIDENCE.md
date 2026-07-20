# Phase 1H-A — Implementation Evidence

**Sub-phase:** **1H-A only** — Privileged Player verification status writer  
**Owner decision:** `AUTHORIZE_PHASE_1H_A_IMPLEMENTATION`  
**Branch:** `feature/player-phase-1h-verification-admin`  
**Scope freeze:** `00_PHASE_1H_SCOPE_FREEZE.md`  
**Date:** 2026-07-20

---

## 1. Summary

Phase 1H-A adds an explicit privileged API `updatePlayerVerificationStatus` for admin-only identity verification status changes. Generic `updatePlayerProfile` / self-write paths continue to reject verification fields. No SQL, schema, Production mutation, queue UI, or deploy in this sub-phase.

---

## 2. Files changed

### Added

| File | Role |
|------|------|
| `src/features/player/services/updatePlayerVerificationStatus.js` | Privileged writer |
| `src/features/player/constants/verificationTransitions.js` | Transition matrix + validator |
| `tests/player-management-phase-1h-a-verification-writer.test.js` | Focused 1H-A tests |
| `docs/player-management/phase-1h/03_PHASE_1H_A_IMPLEMENTATION_EVIDENCE.md` | This evidence |

### Modified

| File | Change |
|------|--------|
| `src/features/player/index.js` | Export privileged API + transition helpers |
| `src/features/player/constants/writableFields.js` | New error codes; privileged-path comment |
| `src/features/player/services/updatePlayerProfile.js` | Comment points to 1H-A API |
| `src/features/player/adapters/writePatchAdapter.js` | Comment points to 1H-A API |
| `src/features/identity/services/auditService.js` | `PLAYER_VERIFICATION_STATUS_UPDATED` action |
| `src/pages/AuditLogPage.jsx` | Vietnamese label for new audit action |
| `tests/player-management-phase-1c-profile-fields.test.js` | Public API allowlist includes 1H-A exports |
| `scripts/ci/unit-test-files.json` | Register 1H-A test file |

---

## 3. Public API

```js
updatePlayerVerificationStatus(playerId, nextStatus, options?)
```

Also exported (contract helpers):

- `IDENTITY_VERIFICATION_STATUS` / `IDENTITY_VERIFICATION_VALUES`
- `VERIFICATION_TRANSITION_MATRIX` / `validateVerificationTransition`
- `WRITE_ERROR_CODES` (includes `INVALID_TRANSITION`, `NOT_AUTHENTICATED`, `SELF_VERIFICATION_FORBIDDEN`)

**Not used for verification:**

- `updatePlayerProfile`
- `updateSelfProfile`
- `updateAuthenticatedSelfPlayerProfile`

---

## 4. Authorization model

| Rule | Behavior |
|------|----------|
| Unauthenticated | `NOT_AUTHENTICATED` |
| Self target (`actor.id === targetAuthUserId`) | `SELF_VERIFICATION_FORBIDDEN` (always; even SUPER_ADMIN) |
| `SUPER_ADMIN` / `PLATFORM_ADMIN` | Allowed (reuses Identity `user.manage` / platform short-circuit) |
| Same-venue `user.manage` (e.g. `TENANT_OWNER`) | Allowed when `target.venue_id` matches actor venue |
| Staff without `user.manage` (e.g. `VENUE_MANAGER`) | `UNAUTHORIZED` |
| Cross-venue `user.manage` | `UNAUTHORIZED` |
| Target missing `venue_id` (non–platform-admin) | `UNAUTHORIZED` |

Primitives reused (no second permission system):

- `guardPermission(PERMISSIONS.USER_MANAGE, { venueId })`
- Existing Identity role matrix + `src/auth/rbac.js` scope matching
- Production DB guard remains authoritative for JWT self-write block

---

## 5. Transition matrix (narrow)

| From \\ To | unverified | pending | verified | rejected |
|------------|------------|---------|----------|----------|
| **unverified** | ✗ | ✓ | ✓ | ✓ |
| **pending** | ✓ | ✗ | ✓ | ✓ |
| **verified** | ✓ | ✗ | ✗ | ✗ |
| **rejected** | ✓ | ✓ | ✗ | ✗ |

Rationale:

- Admin may start review, direct-verify, or direct-reject from `unverified`.
- From `pending`: approve, reject, or withdraw.
- From `verified`: revoke only to `unverified` (no direct reject/re-open).
- From `rejected`: clear or re-open via `pending` (no direct `rejected → verified`).

Invalid transitions return `INVALID_TRANSITION`.

---

## 6. Audit behavior

On **successful** write only:

| Field | Value |
|-------|--------|
| `action` | `player.verification_status_updated` (`AUDIT_ACTIONS.PLAYER_VERIFICATION_STATUS_UPDATED`) |
| `resourceType` | `player_profile` |
| `resourceId` | canonical `playerId` |
| `venueId` | target venue when available |
| `metadata` | `actorUserId`, `targetAuthUserId`, `targetPlayerId`, `previousStatus`, `nextStatus`, `venueId` |

No passwords/tokens; no unnecessary PII dumps. Failed authz / transition / persistence → **no audit**.

---

## 7. Read/write flow

```
resolveCanonicalPlayerId
  → load target profiles row (venue + current status)
  → reject self
  → authorize user.manage / platform admin
  → validate status + transition
  → updateProfileRowById({ identity_verification_status })
  → writeAuditLog (success only)
  → return normalized Player profile result
```

Persist path is explicit privileged `updateProfileRowById` — **not** `updatePlayerProfile` / durable generic mapper.

---

## 8. Tests

| Suite | Result |
|-------|--------|
| Focused 1H-A | **14/14 PASS** |
| Player Management regressions (1B–1H-A) | **175/175 PASS** (after allowlist update) |

Coverage includes: unauthenticated, self, generic writer still forbidden, unauthorized staff, cross-venue, SUPER_ADMIN, same-scope `user.manage`, valid/invalid transition, audit on success, no audit on failed write, public projector still hides verification.

---

## 9. Exclusions (unchanged)

- 1H-B queue UI
- 1H-C admin action UI
- Optional 1H-D entry point
- Self-service / self → `pending`
- Public directory UI
- Legacy dossier/blob cutover
- Duplicate resolution
- Full Admin Player Management
- SQL / schema / Production mutation / deploy

---

## 10. SQL / Production / deploy status

| Check | Result |
|-------|--------|
| New SQL | **None** |
| Schema changes | **None** |
| Production mutation | **None** |
| Deploy | **None** |
| Consumes existing Production foundation | Yes (`identity_verification_status` + guard + index from Phase 1E) |

---

## 11. Exact Owner action next

Pre-commit review of this working tree, then Owner-authorized commit (and later PR) when ready.  
Do **not** start 1H-B/1H-C until 1H-A is accepted.  
Do **not** authorize Production SQL/deploy under this sub-phase.
