# CC-00 — Codebase Audit & Baseline

**Phase:** CC-00 (read-only audit)  
**Branch:** `feature/competition-core-standardization`  
**Date:** 2026-07-11  
**Scope:** Không sửa thuật toán, không migration, không UI, không deploy.

---

## 1. Phạm vi đã thực hiện

- Quét toàn bộ code liên quan rating, chia bảng, ghép đội, ghép trận, standings, Daily Play, Tournament Engine 4.0.
- Xác định call graph engine → page/route/service.
- Kiểm tra schema local (club blob) và Supabase (`pick_vn_player_ratings`).
- Chạy baseline: `npm test`, `npm run lint`, `npm run build`.
- Tạo 4 tài liệu handoff trong `docs/competition-core/`.

---

## 2. Hiện trạng kiến trúc (tóm tắt)

Hệ thống hiện có **nhiều engine song song**, chưa có `Competition Core` thống nhất:

| Lớp | Module chính | Vai trò |
|-----|--------------|---------|
| Xếp sân / Daily | `src/ai/*` | Balance → Pairing (300 shuffle) → Scoring |
| Giải nội bộ / mở | `src/tournament/engines/*` + `src/pages/tournament.seeding.logic.js` | Ghép đội, snake draw, round robin |
| Giải mở random | `openConditionalRandomEngine.js` | Bốc thăm có ràng buộc CLB/đơn vị |
| Tournament Engine 4.0 | `src/features/tournament-engine/*` | Seed, Draw (heuristic), Ranking, engine run log |
| Rating công khai | `skillLevelEngine.js`, `skillLevelService.js`, Pick_VN | Monthly proposal, manual request |
| Elo blob CLB | `eloEngine.js`, `eloService.js` | Cập nhật sau trận giải (localStorage) |
| Elo CLB extension | `clubEloService.js` | Elo riêng trên `clubExtension` (friendly + internal tournament) |
| Standings legacy | `rankingEngine.js` (tournament) | Điểm vòng bảng, tie-break đơn giản |
| Standings TE 4.0 | `features/tournament-engine/engines/rankingEngine.js` | headToHead + seed, phát hiện tie |
| Team tournament | `teamStandingsEngine.js`, `teamGroupSeedEngine.js` | BXH đồng đội, seed bảng |

**Lưu trữ chính:** `localStorage` qua `clubStorage.js` (`pickleball-club-data-v3::{clubId}`). Supabase có bảng `pick_vn_player_ratings` cho cloud sync Pick_VN, **không** có `competition_elo` / `daily_play_rating` riêng.

---

## 3. Trả lời 15 câu hỏi bắt buộc

### Q1. `ratingInternal` hiện lưu giá trị gì?

**Không phải Elo chuẩn (1500 scale).** Là **số thập phân cùng thang với skill level Pick_VN** (1.0–8.0, bước 0.5), được cập nhật bằng **delta Elo áp dụng trực tiếp lên giá trị decimal đó**.

- Lưu trong player blob: `player.ratingInternal` (`src/models/player.js`).
- `getPlayerRatingInternal()` fallback → `rating` / `level` nếu thiếu.
- **`resolveInternalRating()` trong `eloEngine.js` ưu tiên `skillLevel` trước `ratingInternal`** — gây lệch nếu public skill khác internal.
- Công thức dùng `expectedScore(ratingA, ratingB)` với divisor **400** (Elo classic) nhưng input là **3.5, 4.0…** không phải 1500.
- Sau trận: `applyEloUpdatesToPlayers()` ghi `ratingInternal = nextRating` **và đồng bộ luôn** `skillLevel`, `level`, `rating`, `current_rating` qua `syncCurrentRatingMirrors()` — **không tách public vs internal**.

**Kết luận CC-02:** Cần tách `competitionElo` (scale Elo thật) khỏi `publicSkillLevel`; hiện tại hai khái niệm bị trộn.

---

### Q2. Có bao nhiêu rating field trong hệ thống?

**≥ 20 field / alias** trên player và bảng cloud (chi tiết `CC00_RATING_DATA_AUDIT.md`):

| Nhóm | Fields |
|------|--------|
| Public / legacy | `skillLevel`, `level`, `rating`, `current_rating` |
| Internal | `ratingInternal` |
| Pick_VN | `self_declared_rating`, `provisional_rating`, `verified_rating`, `rating_status`, `rating_confidence`, `rating_match_count` |
| Meta | `skillMeta.*`, `skillLevelLockedAt` |
| Club extension | `clubExtension.ratings[].elo` (Elo CLB riêng, default 1500) |
| Tournament entry | `entry.rating`, `entry.seed` |
| TE 4.0 participant | `participant.elo`, `participant.skillLevel`, `participant.seedScore` |

---

### Q3. Hàm nào cập nhật Elo sau trận?

| Hàm | File | Ghi chú |
|-----|------|---------|
| `buildEloUpdatesFromMatchRecord` | `src/tournament/engines/eloEngine.js` | Tính delta |
| `applyEloUpdatesToPlayers` | `src/tournament/engines/eloEngine.js` | Ghi vào player blob |
| `applyEloFromMatchRecord` | `src/domain/eloService.js` | load/save club data |
| `processCompletedMatch` | `src/domain/tournamentLifecycle.js` | Orchestrator sau trận |
| `processCompletedMatchById` | `src/domain/tournamentLifecycle.js` | Gọi từ `updateTournament` |
| `applyClubMatchElo` / `applyClubMatchEloById` | `src/features/club/services/clubEloService.js` | Elo trên `clubExtension` |
| `processClubInternalMatchCompletion` | `src/features/club/services/clubTournamentBridge.js` | Giải nội bộ CLB |
| `createFriendlyClubMatch` | `src/features/club/services/clubActivityService.js` | Friendly + Elo CLB extension |

---

### Q4. Trạng thái trận nào đang được cập nhật Elo?

**Điều kiện tạo record** (`playerHistoryEngine.js`): chỉ `COMPLETED` hoặc `FORFEIT`.

**Điều kiện gọi Elo blob** (`tournamentLifecycle.js`):

- Có `tournament.leagueId` (gắn mùa/giải).
- **Không** phải `daily_play`.
- **Không** phải club-internal-only path (club internal dùng `clubEloService` riêng).
- Không kiểm tra: BYE, walkover trước trận, cancelled, void, fraud — **chưa có** `isMatchRatingEligible()`.

**FORFEIT:** vẫn tạo record và có thể cập nhật Elo nếu có `scoreA/scoreB` và `winnerId`.

**POSTPONED / WAITING / PLAYING / ASSIGNED:** không tạo record, không Elo.

---

### Q5. Daily Play có cập nhật rating hay không?

**Không** cập nhật Elo/rating blob chính.

- `processCompletedMatch` set `skipEloForDailyPlay = true` → `reason: "daily-play-excluded"`.
- Test: `tests/skill-level-change-service.test.js` — `"daily play match completion does not update skillLevel via Elo"`.
- Daily vẫn ghi **lịch sử** qua `dailyMatchToRecord` cho player history / AI waiting.
- **Không có** `dailyPlayRating` riêng.

---

### Q6. Có bao nhiêu engine chia bảng?

**6 implementation paths** (cùng nghiệp vụ, khác thuật toán):

| # | Engine | File | Mode |
|---|--------|------|------|
| 1 | Legacy snake | `seedTeamsIntoGroups` | `tournament.seeding.logic.js` | open / skill_controlled |
| 2 | Legacy adapter | `assignEntriesToGroupsSnake` | `seededGroupEngine.js` | skill_controlled only |
| 3 | Open conditional | `assignEntriesOpenConditional` | `openConditionalRandomEngine.js` | official open |
| 4 | Constraint group | `assignGroupsWithConstraints` | `constraintGroupEngine.js` | wraps #2 |
| 5 | TE 4.0 draw | `generateDraw` | `drawEngine.js` | snake + heuristic + fallback #2 |
| 6 | Team group seed | `buildSnakeGroupsFromSortedTeams` | `teamGroupSeedEngine.js` | team tournament |

**Production paths thực tế:**

- Internal / AI Balance official → #4 (`internalTournamentEngine`, `buildOfficialAiBalancePlan`).
- Official Open → #3.
- Tournament Engine UI → #5.
- Legacy demo `Tournament.jsx` → #1.
- Animation preview → #1.

---

### Q7. Route nào gọi từng engine?

| Route / Page | Engine draw / team |
|--------------|-------------------|
| `/tournament/internal/:id` | `InternalTournamentSetup` → `buildInternalTournamentPlan` → `assignGroupsWithConstraints` |
| `/tournament/official/:id` | `OfficialTournamentSetup` → `buildOfficialOpenPlan` / `buildOfficialAiBalancePlan` |
| `/tournament/daily/:id` | `DailyPlaySetup` → `createFairDailyMatches` → `runAI` |
| `/tournaments/:id/engine` | `TournamentEnginePage` → `useTournamentEngine` → `generateDraw` / `generateSeed` |
| `/select-players` (Xếp sân) | `SelectPlayers` → `runAI` |
| `/tournament` (legacy) | `Tournament.jsx` → `buildSeededGroups` |
| Dev | `PairingInterventionPreviewPage` → snake legacy |
| AI Assistant | `groupSuggestion.js` → `generateDraw` |

Chi tiết call graph: `CC00_ENGINE_CALL_GRAPH.md`.

---

### Q8. `open` đang được hiểu theo những nghĩa nào?

| Ngữ cảnh | Ý nghĩa |
|----------|---------|
| Seeding `mode: "open"` | Xáo trộn ngẫu nhiên teams/players (`tournament.seeding.logic.js`) |
| `OFFICIAL_MODE.OPEN` | Giải mở official — bốc thăm có ràng buộc CLB (`official_open`) |
| `EVENT_TYPE.OPEN_DOUBLE` | Nội dung đôi tự do (không lọc giới tính) |
| `competitionType: "open"` | Xếp sân — không ràng buộc mixed (`ai/competition.js`) |
| `leagueCompetitionType: "open"` | Loại giải league trên `ClubManagement` |
| Finance `status: "open"` | Công nợ mở (`financeLedgerService`) — **không liên quan** |
| Animation `variant: "open"` | Luồng animation bốc thăm (`tournamentFlowAdapters.js`) |

**Rủi ro CC-03/CC-04:** Một từ `open` cho ≥5 nghĩa khác nhau; cần chuẩn hóa `DrawMode`.

---

### Q9. Hard constraint hiện xử lý bằng validation hay điểm phạt?

**Cả hai — không thống nhất:**

| Hệ thống | Hard | Soft |
|----------|------|------|
| Pairing constraints (`pairing-constraints/`) | `CONSTRAINT_MODE.HARD` → swap + `evaluation.ok`; group `hardViolations` | `SOFT` → chấp nhận nếu swap không cải thiện |
| AI scoring (`ai/scoring.js`) | `levelDiff > 0.5` → **loại phương án** (`totalScore: -100`) | history, waiting, rules = điểm |
| AI policy (`avoid_teammate`) | **Điểm phạt** `-35` / `-120`, không loại | `prefer_teammate` = bonus/penalty |
| Club rules | `team_level_diff_limit` = **penalty** vào ruleScore | configurable |

**Kết luận CC-03:** Hard constraint chưa tách khỏi scoring ở AI Core và policy engine.

---

### Q10. `300 candidates` là 300 tổ hợp khác hay permutation trùng?

**Chủ yếu là permutation trùng / near-duplicate**, không phải 300 tổ hợp có cấu trúc.

`runPairingEngine` (`pairing.js`):

1. Mỗi lần lặp: `shuffle(flattenPlayers(courts))` — xáo toàn bộ người trên sân.
2. Cắt `playersPerCourt` (4) cho từng sân.
3. `splitGroupToTeams`: slice 0–1 vs 2–3 (hoặc mixed nam-nữ cố định).

→ Với 1 sân 4 người chỉ có **3 cách chia đội** (AB|CD, AC|BD, AD|BC) nhưng engine **không sinh có hệ** — shuffle ngẫu nhiên lặp lại nhiều lần.

`AI_CONFIG.pairing.candidateCount = 300` (`config.js`).

**CC-06:** Cần thay bằng sinh tổ hợp deterministic + multi-court optimization.

---

### Q11. Tie-break hiện có đầy đủ hay chưa?

**Chưa đầy đủ so với spec CC-07.**

| Engine | Criteria |
|--------|----------|
| Legacy `rankingEngine.js` | matchPoints → scoreDiff → pointsFor → won → name |
| TE 4.0 `rankingEngine.js` | wins → matchPoints → pointDiff → pointsFor → **headToHead** → seed → manual |
| `tournament.standings.logic.js` | Giống legacy (session-based) |
| Team `teamStandingsEngine.js` | Configurable `tiebreakOrder` (wins, subMatchDiff, pointsScored, manual) |

**Thiếu so với target CC-07:**

- Mini-table 3+ đội bằng điểm (chỉ head-to-head pairwise).
- Số trận bỏ cuộc riêng.
- Bốc thăm cuối (chỉ `manual` placeholder).
- `ranking_rule_id` / version / lock sau IN_PROGRESS.
- Standings snapshot sau mỗi trận.

---

### Q12. Luật giải có version và lock sau khi bắt đầu?

**Một phần — chưa đạt CC-08.**

- Tournament status: `draft → registration → ready → active → completed` (`TOURNAMENT_STATUS`).
- `validateTournamentStatusChange` chặn transition sai; **không** có `DRAW_CONFIRMED`, `LOCKED`, `RESULT_REVIEW`.
- **Không** lock `pointsConfig`, `rankingRules`, draw mode khi `active`.
- `updateTournament` cho phép patch tùy ý nếu có quyền — không guard ruleset.
- TE 4.0: `rankingRules` merge default tại runtime — **không persist version** trên tournament.
- Team tournament: `settings.tiebreakOrder` lưu trên teamData — không version.

---

### Q13. Engine run có lưu random seed hay không?

**Có — nhưng chỉ Tournament Engine 4.0, localStorage, không đầy đủ.**

- `drawEngine.js`: `randomSeed` từ context (default 42), `mulberry32(randomSeed + attempt)`.
- `appendEngineRun` (`engineRunLog.js`): lưu `inputSummary`, `output`, `explain` — **không lưu explicit `randomSeed` trong entry** (cần verify inputSummary có embed).
- Legacy draw / internal / open: **không** persist seed.
- AI pairing: **không** seed — `Math.random()` mỗi lần.

---

### Q14. Có thể tái tạo kết quả draw hiện tại?

| Luồng | Tái tạo được? |
|-------|----------------|
| TE 4.0 `generateDraw` | **Có** nếu cùng participants, groupCount, randomSeed, ENGINE_VERSION |
| Legacy snake skill_controlled | **Có** (deterministic nếu không unseeded random) |
| Open conditional | **Có** nếu truyền `randomFn` seeded |
| Internal via UI | **Không** (không lưu seed; constraint swap có thể non-deterministic) |
| AI xếp sân | **Không** |

---

### Q15. Rủi ro P0 phải xử lý trước

| ID | Rủi ro | Impact |
|----|--------|--------|
| P0-1 | Elo delta áp dụng trực tiếp lên **public skill** (`syncCurrentRatingMirrors`) | Trình công khai thay đổi sau mỗi trận — trái mục tiêu CC-02 |
| P0-2 | `ratingInternal` dùng **cùng scale skill** + so sánh trực tiếp trong monthly review (`computeNextPublicLevel`) | CC-02 mapping bắt buộc |
| P0-3 | `resolveInternalRating` ưu tiên **skillLevel** hơn ratingInternal | Elo tính sai input |
| P0-4 | **6 draw engines** — kết quả khác nhau cùng input | CC-04 consolidation |
| P0-5 | Hard constraint AI = **điểm âm**, không reject | CC-03 |
| P0-6 | Không **eligibility gate** Elo (BYE, walkover, void) | CC-02 |
| P0-7 | Không **lock ruleset** khi giải active | CC-08 |
| P0-8 | **3 hệ Elo** (blob player, club extension, pick_vn cloud) không đồng bộ | CC-02 schema |

---

## 4. Database migration (phase này)

**Không có.** Chưa apply migration ở bất kỳ môi trường nào.

---

## 5. Test baseline

Xem `CC00_BASELINE_TEST.md`.

---

## 6. Preview / Production

```
Preview deployment: Not deployed
Production: NOT DEPLOYED
Production migration: NOT APPLIED
Waiting for owner GO
```

---

## 7. Files created (CC-00)

- `docs/competition-core/CC00_CODEBASE_AUDIT.md` (this file)
- `docs/competition-core/CC00_ENGINE_CALL_GRAPH.md`
- `docs/competition-core/CC00_RATING_DATA_AUDIT.md`
- `docs/competition-core/CC00_BASELINE_TEST.md`

---

## 8. Verdict

**PASS** — Audit CC-00 hoàn tất đủ deliverable. Baseline test có 8 fail **ngoài phạm vi competition-core** (menu/RBAC/club governance); build pass; lint có 324 issues pre-existing.

---

## 9. Đề xuất phạm vi CC-01

**Mục tiêu CC-01:** Domain model + feature flags + adapter shell — **không đổi hành vi**.

1. Tạo `src/features/competition-core/` với:
   - `constants/` — `DrawMode`, `RatingStatus`, `ConstraintSeverity`, `EngineType`, …
   - `types/` — JSDoc interfaces (`CompetitionEngineInput`, `CompetitionEngineResult`, …)
   - `flags/competitionCoreFlags.js` — env `VITE_COMPETITION_CORE_*`, default `false`
   - `adapters/legacyAdapter.js` — re-export/wrap engine hiện tại
2. **Không** sửa `eloEngine`, `drawEngine`, `pairing.js` logic.
3. **Không** migration SQL.
4. Test: thêm `tests/competition-core-flags.test.js` (flags default off); đảm bảo suite cũ không đổi kết quả engine.
5. Docs: `CC01_DOMAIN_MODEL.md`, `CC01_FEATURE_FLAGS.md`.

**Phụ thuộc:** CC-01 không block bởi baseline fail (menu audit); nên ghi chú trong CI cho phase sau.
