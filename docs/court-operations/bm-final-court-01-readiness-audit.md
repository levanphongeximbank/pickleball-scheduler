# BM-FINAL-COURT-01 — Phase A Read-Only Readiness Audit

**Worktree:** `PICK_VN-Workstreams/business-modules/bm-final-court-01`  
**Branch:** `feature/bm-final-court-01-runtime-persistence-authority`  
**Verified HEAD:** `7971a260c325a723f78671a9754f17d2bcde14b5`  
**Audit date:** 2026-07-26  
**Mode:** READ-ONLY (no code changes before this document)

---

## Headline

Existing durable schema (`court_engine_stores.payload` jsonb + `court_engine_active_sessions` + claim RPCs) **CAN** hold full Court Engine runtime without new SQL. Runtime authority today is still **localStorage-first** with fire-and-forget cloud push and claim `RPC_NOT_DEPLOYED → local` fallback.

---

## COURT OWNERSHIP MATRIX

| Concern | Owner | Court Engine role | Notes |
|---------|-------|-------------------|-------|
| Venue / court inventory | Venue Management | Read only | Via `loadCourtsForClubScoped` / venue-court |
| Operating hours / availability | Venue Management | Read only | `courtEngineAvailabilityGuard` |
| Court descriptors / inventory status | Venue Management | Read only | No CE writes |
| Operational court runtime state | Court Operations | Own | `courtStates` in session blob |
| Session / queue lifecycle | Court Operations | Own | `courtSessionService` / `queueService` |
| Operational claims (claim request) | Court Operations (ops) | Own lifecycle | RPC + local storage today |
| Cluster inventory / admin CRUD | Court Cluster / Platform | Out of CE scope | Do not move ownership |
| Competition demand / assignment decisions | Competition Engine | Consume validated cmds | No inventory writes |
| Competition schedule decisions | Competition Engine | Own | — |

---

## CURRENT RUNTIME WRITE INVENTORY

| ID | Sink | File | Trigger | Dual-write / fallback |
|----|------|------|---------|----------------------|
| W1 | localStorage store blob | `courtEngineStorage.js` `saveCourtEngineStore` | Every `persistSession` / create / pull hydrate | Async cloud push fire-and-forget; local `ok:true` first |
| W2/W3 | localStorage active id | `saveActiveSessionId` | Session create/set/clear | Cloud active only inside push |
| W4 | migration flag | `courtEngineCloudStore.js` | `migrateLocalCourtEngineToCloud` | Local only |
| C1/C2 | Supabase upsert | `pushCourtEngineToCloud` | After local save when cloud enabled | Reads local then upserts; rewrites local with version |
| W5 | claim requests local | `courtClaimRequestStorage.js` | Claim submit/review/cancel local path | After `RPC_NOT_DEPLOYED` |
| W6–W8 | cluster keys | `data/courtCluster.js` | Cluster admin / sync | Out of Court Ops runtime authority scope |

**Silent success path:** `saveCourtEngineStore` returns `{ ok: true }` before `void pushCourtEngineToCloud(...)` resolves. Cloud `PUSH_FAILED` / `NO_SUPABASE` do not roll back local.

---

## LOCALSTORAGE KEY INVENTORY

| Key | Builder | Scope | Legacy | Write | Environments |
|-----|---------|-------|--------|-------|--------------|
| `pickleball-court-engine-v1::{tenant}::{club}` | `buildCourtEngineStorageKey` | tenant+club | — | `saveCourtEngineStore` | All when local path active |
| `pickleball-court-engine-v1::{club}` | `legacyStorageKey` | club | Yes (read fallback) | Not written (legacy) | Read when scoped empty |
| `pickleball-court-engine-active-v1::{tenant}::{club}` | `buildCourtEngineActiveKey` | tenant+club | — | `saveActiveSessionId` | Same |
| `pickleball-court-engine-active-v1::{club}` | `legacyActiveKey` | club | Yes | Not written | Read fallback |
| `pickleball-court-engine-migrated-v1::{tenant}::{club}` | inline | tenant+club | — | migrate helper | Cloud migrate |
| `pickleball-court-claim-requests-v1` | const | global | — | claim local path | Claim fallback |
| `pickleball-court-clusters-v1` | data layer | global | — | cluster CRUD | Cluster (out of CE runtime) |
| `pickleball-user-cluster-assignments-v1` | data layer | global | — | assignments | Cluster |
| `pickleball-active-cluster-v1` | data layer | global | — | active cluster | Cluster |

---

## DURABLE STORE CAPABILITY MATRIX

| Command / state | Covered without new SQL? | Mechanism |
|-----------------|--------------------------|-----------|
| Session create/open/close | Yes | `court_engine_stores.payload.sessions[]` |
| Active session pointer | Yes | `court_engine_active_sessions` |
| Queue / check-in / assignments | Yes | Inside session jsonb |
| Court states / timers / transfer / referee / events | Yes | Inside session jsonb |
| Optimistic concurrency | Yes | `version` + `VERSION_CONFLICT` |
| Claim submit/review/cancel/list | Yes | Existing claim RPCs (PHASE_33) |
| Field-level multi-writer merge | No | Blob last-writer-wins (acceptable; no new SQL this WS) |

**Verdict on capability:** Durable store is **sufficient** for Court Operations runtime persistence authority. Gap is **wiring/authority**, not schema.

---

## PUBLIC ENTRY POINT MATRIX

| Entry | Layer | Read | Write | Bypass storage facade? |
|-------|-------|------|-------|------------------------|
| `src/features/court-engine/index.js` | barrel | ✓ | exports storage | Compatibility surface |
| `hooks/useCourtEngine.js` | UI hook | ✓ | via services | No |
| `CourtEnginePage.jsx` | page | via hook | via hook | No |
| `CourtQuickManageDialog` | UI | props | callbacks | No |
| `courtEngineService` + session/queue/… | services | ✓ | `persistSession` → storage | Direct storage import |
| `repositoryFactory.js` | composition | ✓ | store factory | Facade owner (still dual-mode) |
| `AiAlertsPanel.jsx` | read-only | ✓ | ✗ | Service reads only |
| `courtClaimRequestService` | cluster ops | ✓ | RPC + local | Local fallback |
| Cluster admin UI / shell claim dialogs | UI | via service | via service | No direct storage |

---

## AUTHORIZATION MATRIX

| Action | Guard | Fail-closed today? |
|--------|-------|--------------------|
| Scheduling / check-in / queue / timer / confirm | `guardSchedulingAction` | Yes when RBAC on |
| Transfer | `guardTransferAction` | Yes when RBAC on |
| Lock / maintenance / referee | scheduling + `assertCourtOwnedByClub` | Scope yes |
| Claim review | `canReviewCourtClaimRequests` | Yes |
| Claim submit local | `isDevAuthAllowed` gate | Secure runtime blocks local submit |
| Page readiness | `resolveCourtEngineContextState` | Context only |

---

## ENVIRONMENT AUTHORITY MATRIX (as-found)

| Condition | Engine authority today | Claim path |
|-----------|------------------------|------------|
| Default `VITE_COURT_ENGINE_STORE` unset/`local` | localStorage canonical | RPC if config else local |
| `STORE=supabase` + Supabase config | local working set + cloud sync | RPC-first |
| `STORE=supabase` without config | local only (`cloud` disabled) | local / NO_SOURCE |
| Cloud push failure | local success retained | N/A |
| `RPC_NOT_DEPLOYED` | N/A | **local fallback** |
| `RPC_FAILED` / `NO_SUPABASE` (claims) | N/A | fail-closed |

---

## FALLBACK CLASSIFICATION MATRIX

| Path | Behavior | Classification |
|------|----------|----------------|
| `saveCourtEngineStore` + async push fail | local `ok:true` | **Silent cloud→local success** |
| Claim `RPC_NOT_DEPLOYED` | local write | **Graceful degrade to local** |
| Claim `RPC_FAILED` | error | Fail-closed |
| Availability guard deny | reject mutation | Fail-closed |
| Missing Supabase in “supabase mode” | cloud disabled → local | **Implicit local** |

---

## Call graph (writers)

```
UI (CourtEnginePage / useCourtEngine)
  → courtEngineService.perform*
    → domain mutators (checkIn/queue/timer/…)
    → courtSessionService.persistSession
      → loadCourtEngineStore / saveCourtEngineStore / saveActiveSessionId
        → localStorage.setItem
        → void pushCourtEngineToCloud (optional, unawaited)

claim UI
  → courtClaimRequestService
    → rpc* OR (RPC_NOT_DEPLOYED) → courtClaimRequestStorage localStorage
```

---

## Phase A gate

| Check | Result |
|-------|--------|
| Baseline HEAD matches | PASS |
| package/lock hashes match | PASS |
| Worktree clean before edit | PASS |
| Durable coverage without new SQL | PASS (sufficient) |
| localStorage still canonical | FAIL (must remediate) |
| No silent fallback required | FAIL (must remediate) |

**Proceed to Phase B remediation.**
