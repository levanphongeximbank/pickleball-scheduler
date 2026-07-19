# Club Phase 2C — Membership & Roster Parity Certification

**Status:** Implementation complete (awaiting Owner gate review)  
**Date:** 2026-07-19  
**Branch:** `feature/v5-club-phase-2c-membership`  
**Workstream:** WS-A  
**Charter:** V5.0-P0-SCOPE-FREEZE (G6 PASS)

---

## 1. Scope delivered

| Item | Result |
|------|--------|
| Membership canonical join spine | ✅ V2 → `club_members` via `clubStorageV2RpcService` |
| Freeze ports `membership.*` / `joinRequest.*` | ✅ `src/features/club/api/` |
| Canonical status / lifecycle | ✅ `membership/membershipLifecycle.js` |
| Role hierarchy (VP no add/remove) | ✅ `canAddClubMembers` + existing `canDeleteClubMembers` |
| Audit freeze aliases | ✅ `membershipAuditEvents.js` (server names documented) |
| Phase 31 hard-dead on V2 ON | ✅ `clubMembershipRequestRpcService` |
| Idempotency key threading | ✅ add/remove/restore/leave/submit/cancel/review |
| Roster design `club_roster_assignments` | ✅ Design doc (ship = 2E) |
| Competition / Venue / Payment / Notify | ✅ Untouched |

---

## 2. Single writer path (V2 ON)

```text
UI / freeze API
  → clubMemberService / clubMembershipRequestService
    → clubStorageV2RpcService (SECURITY DEFINER RPCs)
      → public.club_members / club_membership_requests_v42

Blocked:
  - clubExtensionStorage.members writers (assertLegacyMembershipRosterWriteAllowed)
  - Phase 31 RPC client (FEATURE_DISABLED)
```

V2-OFF: legacy blob writers remain for offline/dev only (non-Production).

---

## 3. Gate review (CLUB_PHASE2_ACCEPTANCE_GATES §4)

| Gate | Verdict | Evidence |
|------|---------|----------|
| G-ARCH | **PASS** | Single writer under V2; façade + legacy guard |
| G-API | **PASS** | `membership.*` / `joinRequest.*` barrels exported |
| G-AUTHZ | **PASS** | VP blocked add/remove; review still Owner/Pres/VP |
| G-RLS | **PASS** | No new SQL / no direct table writes in 2C |
| G-TENANT | **PASS** | Existing `guardClubTenant` on mutate paths |
| G-VER / G-IDEM | **PASS** | `expectedVersion` + `idempotencyKey`/`requestId` threaded |
| G-AUDIT | **PASS*** | Server emits; freeze aliases documented (*no SQL rename) |
| G-FLAG | **PASS** | Phase 31 returns FEATURE_DISABLED under V2 |
| G-RB | **PASS** | Flag-off → legacy path; restore FEATURE_DISABLED when V2 off |
| Roster design | **PASS** | `CLUB_PHASE2C_ROSTER_ASSIGNMENTS_DESIGN.md` |
| G-STG | **N/A** | No SQL changed |

\* G-AUDIT accepted via alias map without Production audit whitelist migration.

---

## 4. Tests

| Suite | Purpose |
|-------|---------|
| `tests/club-phase-2c-membership-parity.test.js` | Lifecycle, audit aliases, VP authz, Phase 31 kill, listActiveRoster |
| Existing 45A.4* membership suites | Regression single-writer / RPC contracts |

---

## 5. Rollback

1. Feature flag: `VITE_CLUB_STORAGE_V2=false` restores legacy writers (non-Prod).  
2. Code rollback: revert branch / undeploy preview.  
3. No SQL rollback required for 2C (no migration applied).

---

## 6. Explicit non-goals (remain for later phases)

- 2D Governance writer certification  
- 2E Invitation + Captain/Coach cloud ship  
- 2G Blob retirement  
- Competition Core / Venue / Booking / Payment / Notification
