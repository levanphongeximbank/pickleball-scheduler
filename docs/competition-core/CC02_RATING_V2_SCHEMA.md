# CC-02 — Rating V2 Schema

**Phase:** CC-02 | **Depends on:** CC-01 (`a3489c2`) | **Date:** 2026-07-11

---

## 1. Conceptual model

| Field | Scale | Purpose |
|-------|-------|---------|
| `publicSkillLevel` | 1.0–8.0 (Pick_VN) | Trình công khai |
| `competitionElo` | Elo 1500+ | Thi đấu nội bộ, tách khỏi skill |
| `dailyPlayRating` | TBD | Daily Play (chưa cập nhật sau trận trong CC-02) |
| `ratingConfidence` | 0–100 | Độ tin cậy |
| `ratingStatus` | provisional / verified / locked / suspended | Vòng đời |

**Quy tắc:** Không so sánh trực tiếp `competitionElo` với `publicSkillLevel`. Dùng `mapCompetitionEloToSkill()`.

---

## 2. Local blob (club_data_v3)

Player fields added (optional, backward compatible):

```javascript
competitionElo        // number, Elo scale
competitionMatchCount // integer
dailyPlayRating       // number | null
```

Legacy fields **retained:** `ratingInternal`, `skillLevel`, `current_rating`, mirrors.

---

## 3. Supabase tables (migration file)

File: `docs/competition-core/supabase-cc02-rating-v2.sql`

| Table | Purpose |
|-------|---------|
| `player_ratings` | Canonical per player + tenant |
| `rating_history` | Audit trail |
| `rating_proposals` | Monthly review proposals (pending/approved/rejected/expired) |
| `rating_confidence_events` | Confidence changes |

**Status:** SQL prepared — **NOT APPLIED** to production.

---

## 4. Module layout

```text
src/features/competition-core/rating/
├── ratingConstants.js
├── kFactorConfig.js
├── mapCompetitionEloToSkill.js
├── isMatchRatingEligible.js
├── playerRatingCompat.js
├── competitionEloEngine.js
├── ratingServiceV2.js
├── monthlyReviewV2.js
└── index.js
```

---

## 5. Integration points (flag-gated)

| Location | When `VITE_COMPETITION_CORE_RATING_V2_ENABLED=true` |
|----------|-----------------------------------------------------|
| `eloService.applyEloFromMatchRecord` | Routes to `applyCompetitionEloFromMatchRecord` |
| `skillLevelService.generateMonthlySkillLevelProposals` | Uses `assessMonthlyPublicLevelV2` |
| `legacyAdapter.isEngineV2Available(RATING)` | Returns `true` |

When flags **off** (default): legacy path unchanged.

---

## 6. Decisions deferred to CC-03+

- Supabase sync service for `player_ratings`
- Daily Play rating updates
- Cloud backfill job
- UI Rating Review panel
