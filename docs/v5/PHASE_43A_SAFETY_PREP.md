# Phase 43A — Data Safety & Tenant Isolation (Safety Prep)

**Status:** PLANNING ONLY — no code in this phase gate  
**Prerequisite:** Phase 42 **CLOSED** (42M Production smoke PASS)  
**Blocks:** Phase 43B (operational SSOT), Phase 43T tournament pilot coding

---

## Objective

Remove **P0 safety risks** identified in Phase 42N audit without feature expansion, schema big-bang, or blob deletion.

### P0 targets

| ID | Issue | 43A scope |
|----|-------|-----------|
| P0-3 | Offline queue cross-user/tenant | ✅ Primary |
| P0-5 | API clubId bypass | ✅ Primary |
| P0-6 | Club switch no visibleClubs validation | ✅ Primary |
| P0-4 | Direct table business mutations | Inventory + guard first wave |
| P0-2 | Dual architecture | Containment flags, no legacy path when V2 |
| P0-1 | Blob local SoT | **Containment only** — no migration in 43A |

---

## Deliverables (this prep pack)

| Document | Purpose |
|----------|---------|
| [PHASE_43A_P0_ROOT_CAUSE_MATRIX.md](./PHASE_43A_P0_ROOT_CAUSE_MATRIX.md) | Root cause per P0 |
| [PHASE_43A_QUEUE_SCHEMA.md](./PHASE_43A_QUEUE_SCHEMA.md) | Target offline queue record |
| [PHASE_43A_DIRECT_MUTATION_INVENTORY.md](./PHASE_43A_DIRECT_MUTATION_INVENTORY.md) | All direct Supabase writes |
| [PHASE_43A_SCOPE_RESOLUTION_ARCHITECTURE.md](./PHASE_43A_SCOPE_RESOLUTION_ARCHITECTURE.md) | Tenant/club scope resolution |
| This file | Implementation sequence + tests + stop line |

---

## Implementation sequence (when GO PHASE 43A IMPLEMENT)

### Sprint 43A-1 — Offline queue (P0-3)

**Files to change:**

- `src/features/mobile/services/offlineQueue.js` (L52–74 enqueue, L177–228 flush)
- `src/auth/authStorage.js` (L106–108 logout — add queue quarantine)
- `src/context/TenantContext.jsx` (L223–253 switchTenant — quarantine queue)
- New: `src/features/mobile/services/offlineQueueSchema.js`
- New: `tests/phase43a-offline-queue-isolation.test.js`

**Behavior:**

1. Queue record includes all mandatory fields (see queue schema doc).
2. `request_id` = `crypto.randomUUID()` at enqueue.
3. Flush filters: `entry.userId === currentUser.id && entry.tenantId === currentTenantId`.
4. Legacy entries missing scope → status `quarantined`, never flushed.
5. Logout → quarantine all pending for previous user.
6. Retry same `request_id` → server dedup or client skip if already `synced`.

### Sprint 43A-2 — API scope (P0-5)

**Files to audit/fix:**

- `src/features/api/router/handlers/playersHandler.js`
- `src/features/api/router/handlers/courtsHandler.js`
- Any handler accepting `clubId`, `tenantId`, `venueId` query params

**Pattern:**

```
resolveAllowedClubs(auth) → verify clubId ∈ allowed → else 403 FORBIDDEN
```

### Sprint 43A-3 — Club switch validation (P0-6)

**Files:**

- `src/context/ClubContext.jsx` L255–266 `handleSwitchClub`
- `src/features/club/services/clubRegistryService.js` (visible clubs cloud list)

**Checks before switch:**

1. Club exists in cloud registry for current tenant.
2. Club ∈ `visibleClubs` for current user/role.
3. Invalidate membership cache (`clubActiveMembershipService.js`).
4. Do not carry prior club operational UI state.

### Sprint 43A-4 — Blob containment (P0-1 partial)

**Files:**

- `src/ai/cloudSync.js` L101–168 (guard push on tenant/user mismatch)
- `src/domain/clubStorage.js` L279–293 (telemetry hook before saveClubData)
- `src/ai/clubCloudPush.js` (debounce guard)

**No blob deletion in 43A.**

### Sprint 43A-5 — Direct mutation guards (P0-4 wave 1)

Priority wrap or server-verify:

- `checkins` — `offlineQueue.js` L84, `checkInService.js` L266
- `match_live` — remove or gate direct fallback in `matchLiveSync.js` L280+

Billing/AI: inventory only in 43A; wrap in 43A.1 if time.

---

## Mandatory tests (43A exit)

| # | Test | Type |
|---|------|------|
| T1 | User A queue not flushed as User B | unit + integration |
| T2 | Tenant A queue not flushed as Tenant B | unit + integration |
| T3 | Legacy unscoped queue → quarantined | unit |
| T4 | Same request_id retry → no duplicate insert | integration |
| T5 | Logout clears/quarantines pending session | integration |
| T6 | Club A→B switch invalidates membership cache | unit |
| T7 | Client clubId outside scope → FORBIDDEN | API test |
| T8 | Two tabs two users no cross-write | manual QA script |
| T9 | Offline reconnect respects scope | Playwright |
| T10 | `npm run build` + `npm run test:unit` PASS | CI |

---

## Preview QA gate (before GO DEPLOY 43A)

Script to add: `scripts/verify-phase43a-preview-qa.mjs`

Cases:

- Offline queue isolation (mock users)
- Tenant switch + club switch
- API forbidden cross-club
- Regression 42L menu matrix unchanged
- pageerror=0

**No Production deploy until Preview PASS.**

---

## Stop line

| Allowed in 43A implement | Not allowed |
|--------------------------|-------------|
| Safety/isolation code | Feature expansion |
| Queue schema migration (client-side) | SQL migration big-bang |
| Guards, quarantine, validation | Blob deletion |
| Tests + Preview QA | 43B booking SSOT |
| | 43T tournament coding |
| | Production deploy without Preview PASS |

---

## Rollback (43A implement)

- Feature flag: `VITE_PHASE43A_SAFETY=false` (to add) restores legacy queue flush behavior.
- Git revert commit hash recorded in deploy report.

---

## Checkpoint: await GO

**Current readiness:** Planning **COMPLETE** · Implementation **NOT STARTED**

**Next command:** `GO PHASE 43A IMPLEMENT` (after Phase 42 CLOSED)
