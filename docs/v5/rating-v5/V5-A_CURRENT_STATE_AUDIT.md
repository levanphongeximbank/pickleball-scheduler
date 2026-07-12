# V5-A — Current State Audit

**Date:** 2026-07-12 | **Scope:** Phase V5-A Foundation | **Status:** DRAFT — NOT APPLIED

---

## A. Component inventory

| Thành phần | File/table hiện tại | Vấn đề | V5 action |
|------------|---------------------|--------|-----------|
| Legacy tournament Elo | `src/tournament/engines/eloEngine.js` | Elo trên thang skill (~3.5), mirror trực tiếp `current_rating` | **Deprecate mirror** — giữ read-only cho import; match V5-D thay thế |
| Pick_VN scale V2 | `src/features/pick-vn-rating/constants/pickVnRatingScale.js` | Thang 1.0–8.0, snap 0.5 >4.0 | **Giữ cho legacy** — V5 dùng `pick-vn-rating-v5/constants/ratingScale.js` (1.5–6.0) |
| Questionnaire V2 | `src/features/player-rating/` | 7 bước, score 0–100 → band → ×0.6 | **Deprecate scoring** — giữ UI tạm; V5-B thay engine + qbank |
| Pick_VN cloud table | `pick_vn_player_ratings` (Phase 30) | RPC `pick_vn_sync_rating` tin client payload | **Harden** — V5 profile tách bảng; sync RPC chỉ input fields |
| CC-02 Rating V2 | `src/features/competition-core/rating/` | Elo 1500, flag OFF, SQL chưa production | **Reuse patterns** — idempotency, eligibility, K-factor cho V5-D |
| VPR ranking | `src/features/vpr-ranking/` | Điểm xếp hạng, không phải skill | **Giữ nguyên** — V5 chỉ đọc reliability gate |
| Club extension Elo | `src/features/club/services/clubEloService.js` | Elo 1500 local, client-only | **Scope** — evidence level 4 khi có organizer confirm |
| Blob SSOT | `club_data_v3` players[] | Client-writable rating mirrors | **Read cache** — canonical = `player_rating_profiles` |
| Assessment localStorage | `pickleball-player-rating-assessment-v1` | Client-only scoring | **Replace** — server RPC `rating_v5_complete_assessment` |
| RBAC | `skill_level.*` permissions | Chưa có `rating_v5.*` | **Extend** — `PHASE_V5A_RATING_FOUNDATION.sql` |

---

## B. Security gaps (P0)

| # | Gap | Impact | V5-A mitigation |
|---|-----|--------|-----------------|
| 1 | `pick_vn_sync_rating` accepts `verified_rating`, `rating_status` | User tự verified | `ratingPayloadGuard.js` + RLS no direct profile write |
| 2 | RLS `pick_vn_ratings_upsert_self` FOR ALL | PostgREST bypass RPC | V5 `player_rating_profiles` policy `using(false)` for write |
| 3 | Questionnaire scoring client-side | Manipulated provisional | RPC stub computes server-side (V5-B wiring) |
| 4 | `ratingInternal` → public mirror | Inflated display rating | V5 `displayRatingResolver` — open/verified tracks separate |
| 5 | CC-02 RPC trusts `previousRating`/`nextRating` from client | Injected Elo | V5 events append-only; engine server-only (V5-D) |

---

## C. Reuse / migrate / deprecate

### Reuse
- `pick-vn-rating/` UI components (badge, panel) — adapt labels V5
- `competition-core/rating/isMatchRatingEligible.js` — match eligibility
- `competition-core/rating/ratingIdempotencyStore.js` — idempotency pattern
- VPR module — independent ranking points
- RBAC infrastructure + audit_logs pattern

### Migrate (future phases, NOT now)
- `pick_vn_player_ratings.current_rating` → `player_rating_profiles.display_rating` (read bridge)
- `player_ratings.competition_elo` (CC-02) → `open_rating_mean` seed prior

### Deprecate (không xóa V2)
- `PROVISIONAL_RATING_CALIBRATION = 0.6`
- `SCORE_TO_RATING_BANDS` band mapping
- `snapPickVnRating` fine/coarse dual step for V5 display
- Client-authoritative `verified_rating` writes

---

## D. Coexistence rule

```
pick_vn_player_ratings     → legacy V2 (frozen, read)
player_rating_profiles     → V5 canonical (new)
player_skill_assessments   → V5 assessment history (new)
```

**KHÔNG** auto-migrate. **KHÔNG** ghi đè `verified_rating` V2.
