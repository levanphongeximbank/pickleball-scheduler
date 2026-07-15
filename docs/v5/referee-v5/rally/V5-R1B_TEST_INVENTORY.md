# REFEREE V5-R1B — Test Inventory

**Phase:** R1-B  
**Date:** 2026-07-13

---

## 1. Tổng số test Referee V5

| File | Count | Layer |
|------|------:|-------|
| `tests/referee-v5/referee-v5-engine.test.js` | 36 | Engine |
| `tests/referee-v5/referee-v5-command.test.js` | 7 | Command dispatch |
| `tests/referee-v5/referee-v5-persistence.test.js` | 50 | Persistence / RPC mock |
| `tests/referee-v5/referee-v5-d1.test.js` | 30 | Edge / security / D1 |
| `tests/referee-v5/referee-v5-e1-realtime.test.js` | 10 | Realtime |
| `tests/ui/referee-v5-c.test.jsx` | 36 | UI Court Visualizer |
| **Tổng Referee V5** | **169** | |

### Test liên quan khác

| File | Count | Liên quan |
|------|------:|-----------|
| `tests/rally-scoring.test.js` | 4 | TT rally **validation** (không V5 engine) |
| `tests/team-tournament-tt5b.test.js` | 9 | Bridge identity / lock |
| `tests/team-tournament-tt5c.test.js` | 10 | Result mapping / outbox |
| `tests/team-tournament-tt5d.test.js` | 11 | Safety / correction |
| `tests/team-tournament-referee.test.js` | 14 | Legacy TT referee |

**Thiếu:** `tests/referee-v5/tt5-integration.test.js` (được nhắc trong docs, không có trong repo).

**Helper:** `testHelpers.js` — chỉ `buildDoublesSideOutConfig`, `buildSinglesConfig` (side-out).

---

## 2. Phân loại theo domain

### Scoring

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| engine #9–16 (side-out points) | ✅ | | |
| engine #24–27 (singles side-out) | ✅ | | |
| persistence apply rally (side-out config) | ✅ | | |
| rally-scoring.test.js (TT validation) | | | ✅ (TT only) |
| **V5 rally doubles scoring** | | | **❌ missing** |

### Server rotation

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| engine #12–14 | ✅ | | |
| command server1→2→side-out | ✅ | | |
| UI #14–15, #26–27 | ✅ | | |
| Rally: no server 2 | | | **❌ missing** |

### Receiver / diagonal

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| engine #1–8 | | ✅ | |
| UI #6–10 | | ✅ | |
| Rally receiver after serve transfer | | | **❌ missing** |

### Positions / serve direction

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| engine #10–11, #32 | ✅ | | |
| UI position tests | | ✅ | |
| Rally score-based positions | | | **❌ missing** |

### Switch ends

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| engine #17–23 | | ✅ | |
| command switch + undo | | ✅ | |
| UI #18–19, #29–30 | | ✅ | |
| Rally auto side-switch milestone | | | **❌ missing** |

### Undo / replay

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| engine #30–34 | | ✅ | |
| command undo chains | | ✅ | |
| persistence replay #43 | ✅ | | |
| Rally replay + finalize | | | **❌ missing** |

### Persistence / HTTP / Edge

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| persistence #1–50 | Mostly SO | ✅ infra | Rally path |
| d1 #1–30 | Mostly SO | ✅ security | MLP reject only |

### Realtime

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| e1 all 10 | | ✅ | ❌ (not needed) |

### Team Tournament bridge

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| tt5b/c/d | | ✅ plumbing | Provision mapping |
| tt5c scores 11–8 | ✅ | | Rally 21–19 |

### Official result / standings

| Test | Side-Out | Shared | Rally mới |
|------|:--------:|:------:|:---------:|
| tt5c result mapping | | ✅ | Rally scores |
| persistence finalize | ✅ | ✅ | Rally finalize |

---

## 3. Bộ test PHẢI giữ PASS (Side-Out regression)

**Tổng ~43 engine+command tests** dùng side-out config — **bắt buộc PASS** khi phát triển Rally:

| Suite | Tests | Lý do |
|-------|------:|-------|
| `referee-v5-engine.test.js` | 36 | Core side-out + shared invariants |
| `referee-v5-command.test.js` | 7 | Dispatch + undo + side-out chain |
| UI side-out fixtures | ~15 | Server 1/2, side-out serving |

**Plus shared infrastructure (không đổi khi thêm rally):**
- persistence concurrency/idempotency (~15)
- d1 security (30)
- e1 realtime (10)
- tt5b/c/d bridge (30)

---

## 4. Rally tests cần tạo mới (đề xuất R2)

1. `buildDoublesRallyConfig` helper
2. Engine: point every rally, serve transfer, no server 2
3. Engine: game complete 21–19, deuce 22–20
4. Persistence: rally replay hash + finalize
5. UI: rally fixture, no side-out line
6. TT: provision `scoringSystem: rally` → V5 `scoringFormat: rally`, `pointsToWin: 21`
7. TT5C: result mapping 21–19

**Ước tính:** ≥25 test cases mới cho rally coverage tối thiểu.

---

## 5. Kết luận

| Metric | Value |
|--------|------:|
| Existing Side-Out regression (engine+command) | **43** |
| Shared behavior tests | **~90** |
| New Rally tests required | **≥25** (chưa có) |

**Code changes:** DOCUMENTATION ONLY
