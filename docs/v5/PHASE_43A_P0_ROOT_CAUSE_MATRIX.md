# Phase 43A — P0 Root Cause Matrix

| P0 | Symptom | Root cause | File / function | Lines | Table/RPC | Risk | 43A fix |
|----|---------|------------|-----------------|-------|-----------|------|---------|
| **P0-1** | Booking/court data differs across devices | Local blob is write-first SoT | `saveClubData` | `clubStorage.js` 279–293 | localStorage `pickleball-club-data-v3::*` | Data loss / conflict | **Containment** — guard push; telemetry; defer SSOT to 43B |
| **P0-1** | Cloud overwritten by stale blob | Full snapshot REST POST | `syncToSupabase` | `cloudSync.js` 119–137 | `club_data_v3` | Silent overwrite | Block push if version/user/tenant mismatch |
| **P0-2** | Two club architectures active | V2 RPC + legacy RPC/blob coexist | `clubMembershipRequestRpcService.js` | 38–92 | legacy RPCs | Wrong contract | Assert V2-only paths when flag on; deprecate calls |
| **P0-2** | Registry dual-write | Legacy push when !V2 | `pushPendingLocalClubsToCloud` | `clubRegistryCloudSync.js` 47–50 | `club_upsert_registry` | Hidden state | Already skipped when V2 — add runtime assert |
| **P0-3** | Offline check-in wrong tenant | Flush all queue entries | `flushOfflineQueue` | `offlineQueue.js` 191–215 | `checkins` | **Critical** | Filter by userId + tenantId |
| **P0-3** | Queue survives logout | No queue clear on auth exit | `clearAuthSession` | `authStorage.js` 106–108 | — | Cross-user leak | Quarantine on logout |
| **P0-3** | No idempotent replay | Entry id is timestamp random | `enqueueOfflineAction` | `offlineQueue.js` 59–60 | — | Duplicate rows | UUID `request_id` + dedup |
| **P0-4** | Check-in bypasses RPC | Direct insert | `syncCheckinAction` | `offlineQueue.js` 84 | `checkins` | No audit/idempotency | Wrap RPC or idempotent insert key |
| **P0-4** | Match score bypass | Direct update fallback | `matchLiveSync.js` | ~280+ | `tournament_match_live` | Security | Remove fallback in secure runtime |
| **P0-5** | API reads other tenant club | clubId not validated | `playersHandler.js`, `courtsHandler.js` | — | API | **Critical** | Server scope resolution |
| **P0-6** | Switch to unauthorized club | No visibleClubs check | `handleSwitchClub` | `ClubContext.jsx` 255–266 | — | Data exposure | Validate against cloud registry |

---

## Test evidence gaps (from 42N)

| P0 | Existing test | Gap |
|----|---------------|-----|
| P0-3 | `mobile-sprint9.test.js` basic queue | No cross-tenant flush |
| P0-5 | — | No API clubId bypass test |
| P0-6 | `club-management.test.js` partial | No switchClub invalid id |
| P0-1 | — | No blob containment test |

---

## Success criteria (43A done)

Each P0 row has: code fix + test + Preview QA case + documented rollback.

P0-1 full SSOT migration explicitly **deferred to 43B**.
