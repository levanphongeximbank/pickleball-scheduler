# CC-02B — Rating V2 Runtime Integration

**Phase:** CC-02B | **Depends on:** CC-02A (`644ba2b`) | **Date:** 2026-07-11

---

## 1. Scope

Runtime wiring behind `VITE_COMPETITION_CORE_RATING_V2_ENABLED` (default **OFF**).

| Integration | File |
|-------------|------|
| Elo apply gate | `domain/eloService.js` |
| Competition Elo engine | `rating/competitionEloEngine.js` |
| Persist + idempotency | `rating/ratingServiceV2.js` |
| Monthly review V2 | `rating/monthlyReviewV2.js` + `skillLevelService.js` |
| Adapter V2 availability | `adapters/legacyAdapter.js` |
| Player blob fields | `models/player.js` |
| Match record metadata | `playerHistoryEngine.js` |

---

## 2. Behavior when flag ON

- Valid matches update **`competitionElo` only**
- **`skillLevel` / `current_rating` mirrors unchanged**
- BYE / Daily Play / walkover_before_start → skipped
- Unclear FORFEIT → `requires_review`, no auto update
- Confirmed FORFEIT (scores present) → eligible
- Same `match.id` → idempotent skip (`ratingV2AppliedMatchIds`)
- Monthly review → proposal only via `assessMonthlyPublicLevelV2`

---

## 3. Behavior when flag OFF

Legacy path unchanged (`eloEngine` + mirror sync).

---

## 4. Not in CC-02B

- Supabase sync
- Production migration apply
- Preview deploy
- CC-03 rules engine

---

## 5. Verification

See `CC02_RATING_VERIFICATION.md`.
