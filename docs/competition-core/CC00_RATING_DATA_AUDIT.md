# CC-00 — Rating Data Audit

**Phase:** CC-00 | **Date:** 2026-07-11

Kiểm tra field rating, storage, schema Supabase, và luồng cập nhật.

---

## 1. Câu trả lời ngắn

| Câu hỏi | Kết luận |
|---------|----------|
| `ratingInternal` là Elo hay skill? | **Skill decimal (1.0–8.0)** cập nhật bằng delta Elo-style — **không phải Elo 1500+** |
| Bao nhiêu rating field? | **≥20** alias/field (bảng dưới) |
| Supabase có competition Elo? | **Không** — chỉ Pick_VN public rating fields |
| Daily Play rating? | **Không tồn tại** field riêng |
| Trigger/RPC cập nhật trình? | RPC sync Pick_VN trong `PHASE_30_PICK_VN_PLAYER_RATING.sql`; **không** RPC Elo thi đấu |

---

## 2. Player blob (localStorage — `club_data_v3`)

Path: `src/domain/clubStorage.js` → `data.players[]`

| Field | Type (effective) | Mục đích | Ghi chú |
|-------|------------------|----------|---------|
| `skillLevel` | number 1.0–8.0 | Trình công khai (mirror) | Sync với current_rating |
| `level` | number | Legacy mirror | = skillLevel |
| `rating` | number | Legacy mirror | = skillLevel |
| `current_rating` | number | Pick_VN canonical public | Ưu tiên đọc |
| `ratingInternal` | number | "Elo nội bộ" | **Cùng scale skill** |
| `rating_status` | enum string | Pick_VN lifecycle | 8 values |
| `rating_confidence` | number 0–1 | Confidence | |
| `rating_match_count` | integer | Số trận tính rating | Monthly proposal gate |
| `self_declared_rating` | number | Khảo sát / onboarding | |
| `provisional_rating` | number | Assessment engine | |
| `verified_rating` | number | Admin verify | |
| `skillLevelLockedAt` | ISO string | Khóa lần khai báo đầu | |
| `skillMeta.lastPublicLevelReviewAt` | ISO | Review tháng | |
| `skillMeta.lastRatingInternalUpdateAt` | ISO | Sau Elo | |
| `skillMeta.publicLevelHistory` | array | Audit local | max 24 entries |

**Club-level config** (`data.skillLevel`):

```javascript
// src/ai/config.js DEFAULT_SKILL_LEVEL_RULES
{
  enabled: false,
  step: 0.5,
  promoteThreshold: 0.35,
  demoteThreshold: 0.35,
  minMatchesForProposal: 5,
  ...
}
```

**Proposals / requests:**

- `data.skillLevelProposals[]` — monthly system proposals
- `data.skillLevelChangeRequests[]` — manual player requests

---

## 3. Club extension Elo (tách biệt)

Path: `src/features/club/storage/clubExtensionStorage.js`

| Field | Type | Default | Mục đích |
|-------|------|---------|----------|
| `ratings[].playerId` | string | — | VĐV |
| `ratings[].elo` | number | **1500** (`DEFAULT_CLUB_ELO`) | Elo CLB extension |
| `matches[].eloApplied` | boolean | false | Idempotent guard |

Dùng bởi: `clubEloService.js`, friendly matches, club internal tournament bridge.

**Không sync** với `player.ratingInternal` trong blob chính.

---

## 4. Supabase — `pick_vn_player_ratings`

File migration: `docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `auth_user_id` | uuid FK profiles | unique |
| `self_declared_rating` | numeric(3,1) | |
| `provisional_rating` | numeric(3,1) | |
| `verified_rating` | numeric(3,1) | |
| `current_rating` | numeric(3,1) default 3.5 | Public |
| `rating_status` | text check | 8 statuses |
| `rating_confidence` | numeric(4,3) default 0 | |
| `rating_match_count` | integer default 0 | |
| `rating_history` | jsonb | |
| `rating_verified_by` | uuid | |

**Không có:** `competition_elo`, `daily_play_rating`, `rating_internal`.

Sync service: `src/features/pick-vn-rating/services/pickVnClubSyncService.js`, `pickVnRatingService.js`.

---

## 5. Tournament / entry rating fields

| Location | Fields | Usage |
|----------|--------|-------|
| `entry.rating` | sum or avg player rating | Seed sort |
| `entry.seed` | integer | Draw snake |
| TE participant | `elo`, `skillLevel`, `seedScore`, `winRate` | TE 4.0 seed/draw |
| Team `avgLevel`, `topPlayerRating` | computed | teamGroupSeedEngine |

Official **open** entries: `stripOpenEntryMetadata` → `rating: 0, seed: null`.

---

## 6. Luồng cập nhật rating

### 6.1 Sau trận giải (blob Elo)

```
Match COMPLETED/FORFEIT
  → eventMatchToRecord / dailyMatchToRecord
  → processCompletedMatch (if leagueId)
  → buildEloUpdatesFromMatchRecord
       K=32 fixed, team avg resolveInternalRating(player)
  → applyEloUpdatesToPlayers
       ratingInternal := next
       skillLevel/level/rating/current_rating := snapPickVn(next)  ⚠ P0
  → saveClubData
```

**Skip paths:**

- `daily_play` → skipped
- No `leagueId` → skipped (except club internal → club extension)
- `club_internal` → `clubEloService` (separate store)

### 6.2 Monthly public level

```
assessMonthlyPublicLevel
  compare: ratingInternal vs publicLevel ± 0.35  ⚠ direct compare P0
  → createSkillLevelProposal (pending)
approveSkillLevelProposal → update public fields only via pick-vn service
```

### 6.3 Manual change request

`submitSkillLevelChangeRequest` → `approveSkillLevelChangeRequest` → `applySkillLevelValue`

### 6.4 Onboarding / assessment

`playerSkillAssessmentEngine.js` → provisional rating → `setInitialSkillLevel`

### 6.5 Friendly club match

`clubActivityService` → `applyClubMatchEloById` → **clubExtension.ratings only**

---

## 7. Elo formula vs stored values

```javascript
// eloEngine.js
expectedScore(rA, rB) = 1 / (1 + 10^((rB - rA) / 400))
delta = K * (actual - expected)   // K default 32
```

Input `rA`, `rB` ≈ **3.5, 4.0** (skill scale), không phải 1500.

**Test evidence:** `tests/elo-engine.test.js` — winner `skillLevel` tăng sau trận; `tests/skill-level-engine.test.js` — monthly review dùng `ratingInternal: 4.1` vs public `3.5`.

---

## 8. Giá trị thực tế / backfill risk

| Nguồn | Risk |
|-------|------|
| Legacy `level` only | `ratingInternal` = level copy |
| Elo đã chạy production | public skill **đã bị mirror** từ internal |
| Club extension | Elo 1500 scale — **khác scale** blob |
| Cloud Pick_VN | Có thể lệch local nếu chưa sync |
| UNRATED players | `ratingInternal: null` |

**CC-02 backfill đề xuất:**

1. `public_skill_level` ← `current_rating` ?? `skillLevel`
2. `competition_elo` ← cần **recalibrate** từ history hoặc map từ ratingInternal với flag `provisional`
3. `daily_play_rating` ← null / separate init
4. Không ghi đè — giữ cột blob cũ

---

## 9. Verification queries (staging — chưa chạy phase này)

```sql
-- Pick_VN distribution
select rating_status, count(*), avg(current_rating), avg(rating_match_count)
from public.pick_vn_player_ratings
group by 1;

-- Profiles without rating row
select count(*) from public.profiles p
left join public.pick_vn_player_ratings r on r.auth_user_id = p.id
where r.id is null;
```

Local (manual):

```javascript
// DevTools — active club blob
JSON.parse(localStorage.getItem('pickleball-club-data-v3::<clubId>'))
  .players.map(p => ({
    id: p.id,
    public: p.current_rating ?? p.skillLevel,
    internal: p.ratingInternal,
    status: p.rating_status,
    matchCount: p.rating_match_count
  }))
```

---

## 10. Gap vs CC-02 target schema

| Target (CC-02) | Hiện trạng |
|----------------|------------|
| `publicSkillLevel` | `current_rating` / mirrors — **OK rename** |
| `competitionElo` | **Missing** — `ratingInternal` wrong scale |
| `dailyPlayRating` | **Missing** |
| `ratingConfidence` | `rating_confidence` — exists Pick_VN |
| `ratingStatus` simplified | 8 statuses — cần map |
| `mapCompetitionEloToSkill()` | **Missing** — direct compare today |
| `isMatchRatingEligible()` | **Missing** |
| Dynamic K-factor | **Fixed K=32** everywhere |
| `rating_history` table | jsonb only on cloud |

---

## 11. Rollback plan (for future CC-02)

Phase CC-00: N/A.

Future CC-02:

- New tables only — no drop legacy columns
- Feature flag `COMPETITION_CORE_RATING_V2_ENABLED=false` → read legacy path
- Rollback = disable flag + stop writing new tables
