# TT-6A — Test Strategy

**Date:** 2026-07-13  
**Status:** Design for TT-6B+ gates  
**Production:** No tests run in TT-6A (docs only)

---

## 1. Test layers

| Layer | Location | When |
|-------|----------|------|
| Unit (pure logic) | `tests/team-tournament-tt6*.test.js` | TT-6B CI |
| Referee adapter unit | `tests/team-tournament-tt6-referee-adapter.test.js` | TT-6B |
| Integration (mock Supabase) | `tests/team-tournament-tt6-integration.test.js` | TT-6B |
| Staging E2E | `scripts/verify-phase-tt6-staging.mjs` | TT-6B/C staging |
| Regression | Existing TT-5 + V5 + TT full suites | Every commit |

---

## 2. Unit tests — event envelope

| Case | Assert |
|------|--------|
| Valid envelope normalizes from WAL payload | All required fields present |
| Missing tenantId rejected | Normalizer throws / drops |
| eventId stable for same WAL replay | Dedupe works |
| occurredAt not used for dedupe | Same eventId different timestamp → discard |

---

## 3. Unit tests — deduplication

| Case | Assert |
|------|--------|
| Same eventId twice | Second discarded; metric increment |
| Same entityVersion, same hash | Second discarded |
| Same entityVersion, different hash | Conflict → full reload flag |
| Polling + Realtime same update | Single render (one reload) |

---

## 4. Unit tests — stale version

| Case | Assert |
|------|--------|
| remoteVersion < localVersion | No reload |
| remoteVersion === localVersion | No reload |
| remoteVersion === localVersion + 1 | Targeted reload |
| remoteVersion > localVersion + 1 | Gap full snapshot reload |

---

## 5. Unit tests — connection state machine

| Transition | Assert |
|------------|--------|
| connecting → connected → synced | Valid |
| connected → error → reconnecting | Poll enabled |
| reconnect success | Snapshot reload called |
| unauthorized | Poll stopped |
| degraded | Banner flag; not synced |

---

## 6. Unit tests — polling coordinator

| Case | Assert |
|------|--------|
| Single scope — one timer | No duplicate intervals |
| Realtime healthy | Poll timer cleared |
| Tab hidden | Poll paused |
| Tab visible | Immediate refresh |
| Unsubscribe | Timer cleared |

---

## 7. Integration tests — subscription registry

| Case | Assert |
|------|--------|
| Double subscribe same scope | One channel, ref-count 2 |
| Unsubscribe one ref | Channel stays |
| Last unsubscribe | removeChannel called |
| Tournament switch | Old scope cleaned |

---

## 8. Security tests (staging JWT)

| Case | Role | Assert |
|------|------|--------|
| Captain A pre-publish | Captain A | WAL for team A lineup only |
| Captain A pre-publish | Captain A | No team B selections in any handler |
| Captain B pre-publish | Captain B | Symmetric |
| Post-publish | Both captains | getVisibleLineups returns both |
| Cross-tenant | User T2 | No events for T1 tournament |
| Regular player | Player | No referee_match events |
| Revoked referee | Referee | No match_live_states delivery |
| Expired assignment | Referee | access guard fail; unauthorized state |
| BTC | Manage | Receives bridge + sub-match events |

---

## 9. Reconnect tests

| Case | Assert |
|------|--------|
| Force WS disconnect | reconnecting + poll |
| Reconnect after N drops | Snapshot reload; dedupe reset or merge |
| Missed events during disconnect | Snapshot covers gap |
| Reconnect replay | No duplicate UI updates |

---

## 10. Multi-device tests

| Case | Assert |
|------|--------|
| Device A finalize V5 | Device B TT portal updates within SLA |
| Device A edit lineup | Device B captain sees own updates |
| Concurrent reconnect both devices | Both synced; no conflict storm |

Reuse patterns from `verify-referee-v5-multi-device-staging.mjs` and TT-5C E2E.

---

## 11. Race tests

| Case | Assert |
|------|--------|
| RPC mutation response before Realtime event | Version from RPC wins; event deduped |
| Realtime event before RPC response | Reload merges; no double toast |
| Standings recompute lag | Poll/degraded catches within interval |

---

## 12. Regression gates (unchanged minimum)

| Suite | Count |
|-------|-------|
| Referee V5 unit | 133/133 |
| Referee V5 UI | 36/36 |
| Legacy referee | 29/29 |
| Team Tournament | 236/236 |
| TT-5B/C/D | 9/10/11 |
| Build + lint | PASS |

Add TT-6 unit suite — target ≥15 cases in TT-6B.

---

## 13. Evidence artifacts (TT-6B)

```
docs/v5/qa-evidence/phase-tt6/
  TT6_ENVELOPE_REPORT.json
  TT6_DEDUPE_REPORT.json
  TT6_RECONNECT_REPORT.json
  TT6_SECURITY_LINEUP_REPORT.json
  TT6_SECURITY_REFEREE_REPORT.json
  TT6_E2E_STAGING_REPORT.json
```

---

## 14. Acceptance

| Area | Strategy complete |
|------|-------------------|
| Envelope | YES |
| Dedupe / stale / conflict | YES |
| Reconnect / polling | YES |
| Security roles | YES |
| Multi-device / race | YES |
| Regression integration | YES |
