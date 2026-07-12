# Referee V5-F — Test Plan

**Status:** Plan only — **NOT RUN** (no V5 implementation)  
**Engine version under test:** `referee-v5.0`

---

## 1. Test layers

| Layer | Tool | Phase |
|-------|------|-------|
| Unit — rule engines | `node --test` | V5-B |
| Unit — position/serve | `node --test` | V5-B |
| Integration — RPC | staging scripts | V5-E |
| RLS | `phase16-kn6-rls` pattern | V5-E |
| UI smoke | Vitest + RTL | V5-C |
| E2E mobile | Manual + future Playwright | V5-I |

---

## 2. Diagonal serve/receiver tests (mandatory — 15)

Supplement 2026-07-12. Module: `serveRotationEngine` + `CourtVisualizer`.

| # | Case | Status |
|---|------|--------|
| D1 | A at RIGHT → correct diagonal receiver D | NOT RUN |
| D2 | A scores, switches LEFT → receiver changes to C | NOT RUN |
| D3 | Serving team loses rally, not side-out yet → new server + receiver correct | NOT RUN |
| D4 | SIDE_OUT → opponent team correct server + receiver | NOT RUN |
| D5 | ENDS_SWITCHED → same server/receiver IDs, correct ends | NOT RUN |
| D6 | After ENDS_SWITCHED → arrow direction inverted correctly | NOT RUN |
| D7 | Reject receiver same team as server | NOT RUN |
| D8 | Reject receiver in non-diagonal box | NOT RUN |
| D9 | Singles → single correct receiver | NOT RUN |
| D10 | Reload restores server, receiver, arrow | NOT RUN |
| D11 | Undo rally restores prior receiver | NOT RUN |
| D12 | Two devices show identical server/receiver | NOT RUN |
| D13 | Client spoof `receiving_player_id` rejected | NOT RUN |
| D14 | Mobile 360px: ĐANG GIAO, ĐỠ BÓNG, arrow visible | NOT RUN |
| D15 | Multiple ENDS_SWITCHED → diagonal mapping still valid | NOT RUN |

---

## 3. Unit tests (mandatory — 20)

| # | Case | Module | Status |
|---|------|--------|--------|
| 1 | Serving team wins rally → partners switch sides | `sideOutDoubles` | NOT RUN |
| 2 | Receiving team wins → no point (side-out) | `sideOutDoubles` | NOT RUN |
| 3 | Server 1 → server 2 same team | `serveRotationEngine` | NOT RUN |
| 4 | Server 2 loses → side-out | `serveRotationEngine` | NOT RUN |
| 5 | Correct server after side-out | `serveRotationEngine` | NOT RUN |
| 6 | Correct receiver diagonal | `serveRotationEngine` | NOT RUN |
| 7 | ENDS_SWITCHED preserves scores | `positionEngine` | NOT RUN |
| 8 | ENDS_SWITCHED preserves serve rights | `positionEngine` | NOT RUN |
| 9 | ENDS_SWITCHED swaps team ends in state | `positionEngine` | NOT RUN |
| 10 | Singles even score → right court | `singlesSideOut` | NOT RUN |
| 11 | Rally scoring ignores side-out rotation | `rallyDoubles` | NOT RUN |
| 12 | Undo restores prior snapshot | `stateRebuildEngine` | NOT RUN |
| 13 | Rebuild from events = snapshot | `stateRebuildEngine` | NOT RUN |
| 14 | Duplicate idempotency key once | RPC mock | NOT RUN |
| 15 | Version conflict rejected | RPC mock | NOT RUN |
| 16 | Locked match rejects RALLY_WON | `matchStateEngine` | NOT RUN |
| 17 | Forfeit sets winner | `matchStateEngine` | NOT RUN |
| 18 | Team sub-match aggregate | integration | NOT RUN |
| 19 | Disputed match skips rating hook | finalize | NOT RUN |
| 20 | Double finalize once bracket/rating | finalize | NOT RUN |

---

## 4. Security tests (8)

| # | Case | Status |
|---|------|--------|
| 1 | PLAYER cannot apply event | NOT RUN |
| 2 | REFEREE not assigned → 403 | NOT RUN |
| 3 | Tenant A ≠ tenant B | NOT RUN |
| 4 | Expired token rejected | NOT RUN |
| 5 | Revoked token rejected | NOT RUN |
| 6 | Direct INSERT match_result blocked | NOT RUN |
| 7 | Override without reason rejected | NOT RUN |
| 8 | Locked state direct UPDATE blocked | NOT RUN |
| 9 | Client `receiving_player_id` in payload stripped/rejected | NOT RUN |

---

## 5. UI tests (10)

| # | Case | Status |
|---|------|--------|
| 1 | Four players visible doubles | NOT RUN |
| 2 | Server marked | NOT RUN |
| 3 | Receiver marked | NOT RUN |
| 4 | Post-rally animation matches state | NOT RUN |
| 5 | ENDS_SWITCHED swaps teams vertically | NOT RUN |
| 6 | 360px no overflow | NOT RUN |
| 7 | One-hand primary buttons | NOT RUN |
| 8 | Offline unsynced banner | NOT RUN |
| 9 | Undo no double event | NOT RUN |
| 10 | Refresh preserves server state | NOT RUN |
| 11 | Diagonal arrow matches engine receiver | NOT RUN |
| 12 | ĐANG GIAO / ĐỠ BÓNG distinct colors | NOT RUN |

---

## 6. Regression — legacy unchanged

When `VITE_REFEREE_V5_ENABLED=false`:

| Suite | Expected |
|-------|----------|
| `referee-rpc-security.test.js` | PASS (47 legacy tests) |
| `referee-flow.integration.test.js` | PASS |
| `team-tournament-referee.test.js` | PASS |

Run on every V5 PR touching shared modules.

---

## 7. Acceptance gates by phase

| Phase | Gate |
|-------|------|
| V5-B | Unit 1–13 + **Diagonal D1–D11** PASS |
| V5-C | UI 1–8 + **D14** PASS |
| V5-E | Security 1–9 + D13 PASS |
| V5-I | Full 20 + 15 diagonal + legacy regression PASS |

---

## 8. Test file layout (proposed)

```text
tests/referee-v5/
  side-out-doubles.test.js
  rally-doubles.test.js
  singles-side-out.test.js
  position-engine.test.js
  serve-rotation-diagonal.test.js
  serve-direction.test.js
  state-rebuild.test.js
  payload-guard.test.js
  finalize-idempotency.test.js
tests/ui/referee-v5-court-visualizer.smoke.test.jsx
```

---

*Test plan approved for implementation phases — no tests executed in V5-A.*
