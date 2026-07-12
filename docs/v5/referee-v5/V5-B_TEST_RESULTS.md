# Referee V5-B — Test Results

**Date:** 2026-07-12  
**Command:** `node --test tests/referee-v5/referee-v5-engine.test.js`

---

## Mandatory unit tests (35/35 PASS)

| # | Test | Result |
|---|------|--------|
| 1 | NEAR RIGHT → receiver + `NEAR_RIGHT_TO_FAR_LEFT` | ✅ |
| 2 | NEAR LEFT → receiver + `NEAR_LEFT_TO_FAR_RIGHT` | ✅ |
| 3 | FAR RIGHT → receiver + `FAR_RIGHT_TO_NEAR_LEFT` | ✅ |
| 4 | FAR LEFT → receiver + `FAR_LEFT_TO_NEAR_RIGHT` | ✅ |
| 5 | Server/receiver never same team | ✅ |
| 6 | Receiver not by array index | ✅ |
| 7 | Receiver changes when server switches logical side | ✅ |
| 8 | Receiver identity preserved on switch ends | ✅ |
| 9 | Serving team win awards point | ✅ |
| 10 | Serving team win swaps partner sides | ✅ |
| 11 | Receiving team holds position on serving team point | ✅ |
| 12 | Server 1 loss → server 2 | ✅ |
| 13 | Server 2 loss → side-out | ✅ |
| 14 | Side-out picks correct server | ✅ |
| 15 | Side-out resolves correct receiver | ✅ |
| 16 | No point on receiving team win (side-out) | ✅ |
| 17 | Switch ends swaps court ends | ✅ |
| 18 | Switch ends preserves score | ✅ |
| 19 | Switch ends preserves server number | ✅ |
| 20 | Switch ends preserves server identity | ✅ |
| 21 | Switch ends preserves receiver identity | ✅ |
| 22 | Arrow direction inverts on switch ends | ✅ |
| 23 | Logical service sides preserved on switch ends | ✅ |
| 24 | Singles even score → right court | ✅ |
| 25 | Singles odd score → left court | ✅ |
| 26 | Singles receiver = only opponent | ✅ |
| 27 | Singles no server number | ✅ |
| 28 | Version conflict rejected | ✅ |
| 29 | Duplicate sequence rejected | ✅ |
| 30 | Rebuild matches live state | ✅ |
| 31 | Undo restores score | ✅ |
| 32 | Undo restores positions | ✅ |
| 33 | Undo restores server | ✅ |
| 34 | Undo restores receiver | ✅ |
| 35 | Locked match rejects rally | ✅ |

**Extra:** screen mapping FAR RIGHT → `SCREEN_TOP_LEFT` ✅

---

## Build & lint

| Check | Result |
|-------|--------|
| `eslint src/features/referee-v5 tests/referee-v5` | **PASS** |
| `npm run build` | **PASS** |
| Integration tests | **NOT RUN** |
| RLS tests | **NOT RUN** |

---

## Legacy regression

Legacy referee tests remain in `test:unit` list (`referee-engine.test.js`, etc.) — not modified in V5-B.
