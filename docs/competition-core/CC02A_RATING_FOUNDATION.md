# CC-02A — Rating V2 Foundation

**Phase:** CC-02A | **Parent:** CC-01 (`a3489c2`) | **Date:** 2026-07-11

---

## 1. Scope

Domain-level rating foundation only — **no runtime wiring**, **no DB writes**, **no feature-flag switching**.

| Component | Path |
|-----------|------|
| Constants | `rating/ratingConstants.js` |
| K-factor tiers | `rating/kFactorConfig.js` |
| Elo ↔ skill mapping v1 | `rating/mapCompetitionEloToSkill.js` |
| Match eligibility | `rating/isMatchRatingEligible.js` |
| Read adapters | `rating/playerRatingCompat.js` |
| SQL (not applied) | `supabase-cc02-rating-v2.sql` |

---

## 2. Mapping (v1)

- `mapCompetitionEloToSkill()` — pure, versioned
- `mapSkillToCompetitionElo()` — inverse
- `mapLegacySkillToInitialElo()` — backfill alias

Anchor: skill `3.5` ↔ Elo `1500`, step `400` Elo per 1.0 skill.

**Never** compare raw `competitionElo >= publicSkillLevel + delta`.

---

## 3. Eligibility rules

| Case | Status |
|------|--------|
| Normal completed match | `eligible` |
| BYE | `ineligible` |
| Daily Play | `ineligible` |
| cancelled / void / test | `ineligible` |
| walkover_before_start | `ineligible` |
| FORFEIT (unconfirmed) | **`requires_review`** |
| FORFEIT (confirmed) | `eligible` |

---

## 4. K-factor (config only)

| Matches | K |
|---------|---|
| 0–9 | 40 |
| 10–49 | 32 |
| 50+ | 20 |

---

## 5. Out of scope (CC-02B)

- `eloService` / `skillLevelService` wiring
- `competitionEloEngine` / `ratingServiceV2` / `monthlyReviewV2`
- Feature flag runtime path
- Production migration apply

---

## 6. Related docs

- `CC02A_RATING_SOURCE_MATRIX.md`
- `CC02_RATING_V2_SCHEMA.md`
- `CC02_RATING_MAPPING.md`
- `CC02_RATING_MIGRATION.md`
- `CC02A_TEST_REPORT.md`
