# 03 — Rating Scale and SSOT Matrix

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official documentation freeze
**Conversion formulas:** Forbidden in Phase 1A
**UI scale changes:** Forbidden in Phase 1A
**Data migration / backfill:** Forbidden in Phase 1A

---

## 1. Target public Player Rating scale (Owner decision)

| Item | Contract |
|------|----------|
| Target public skill scale | **1.5 – 6.0** |
| Nature | Documentation-level target contract only |
| Production data | Unchanged by Phase 1A |

Evidence that Rating V5 already encodes this numeric band in code:

| Path | Symbol | Classification |
|------|--------|----------------|
| `src/features/pick-vn-rating-v5/constants/ratingScale.js` | `V5_MIN_RATING = 1.5`, `V5_MAX_RATING = 6.0`, `toDisplayRating` | `CODE_PRESENT` |
| `docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql` | check / range comments (`rating_v5_rating_in_range`) | `DATABASE_DRAFT` |

Flag: `VITE_PICK_VN_RATING_V5_ENABLED` default `"false"` in `src/features/pick-vn-rating-v5/config/featureFlags.js` → `FLAG_GATED`. Live Production cutover status: `PRODUCTION_STATUS_UNVERIFIED`.

---

## 2. Scale classification matrix (frozen)

| Scale | Range / anchor | Classification | Owner domain | Evidence |
|-------|----------------|----------------|--------------|----------|
| Rating V5 1.5–6.0 | 1.5–6.0 (display step 0.1) | **Target Player Rating public skill scale contract** | Player Rating (target) | `ratingScale.js` `V5_MIN_RATING` / `V5_MAX_RATING` |
| Pick_VN V2 1.0–8.0 | 1.0–8.0 (step 0.5; fine 0.1 ≤4.0) | **Legacy compatibility scale** | Legacy Player Rating surface | `src/features/pick-vn-rating/constants/pickVnRatingScale.js` `PICK_VN_MIN` / `PICK_VN_MAX` |
| Competition Elo ~1500 | Default 1500; maps ↔ skill via 400 Elo/point in CC code | **Internal competition-derived calculation signal — not public Player Rating scale** | Competition Engine rating subsystem | `src/features/competition-core/rating/ratingConstants.js` `DEFAULT_COMPETITION_ELO`, `ELO_PER_SKILL_POINT_V1` |
| Club Elo | Default 1500, K=32 typical | **Club-scoped legacy or mirror calculation** | Club Management operational | `src/features/club/constants/clubStatus.js` / `clubEloService.js` (`DEFAULT_CLUB_ELO`, `applyClubMatchElo`) |
| VPR points | Placement × tournament level table | **Ranking domain — not Player Rating** | Ranking | `src/features/vpr-ranking/constants/defaultPointConfig.js` `DEFAULT_VPR_POINT_TABLE` |

### Explicit prohibitions

1. Do **not** create a conversion formula between these scales in Phase 1A.
2. Do **not** treat Competition Elo as automatically equal to public Player Rating.
3. Do **not** treat VPR points as skill rating.
4. Do **not** change UI display scales in Phase 1A.

---

## 3. Runtime SSOT reality

**Finding:** There is currently **no single runtime Player Rating SSOT** proven as Production-authoritative.

### 3.1 Candidate stores (evidence-safe)

| Store / surface | Path | Classification | May be declared Player Rating SSOT in Phase 1A? |
|-----------------|------|----------------|--------------------------------------------------|
| V5 `player_rating_profiles` + events/snapshots | `docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql`; registry `src/features/pick-vn-rating-v5/constants/v5TableRegistry.js` | `DATABASE_DRAFT` + `CODE_PRESENT` client; staging QA under `docs/v5/rating-v5/qa-evidence/` = `STAGING_EVIDENCE_PRESENT` | **No** — not proven Production SSOT |
| Pick_VN V2 `pick_vn_player_ratings` | `docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql` | `DATABASE_DRAFT` / `LEGACY_FALLBACK`; client trust issue (ADR-001) | **No** — legacy |
| CC-02 `player_ratings` / `rating_applications` | `docs/competition-core/supabase-cc02-rating-v2.sql`, `supabase-cc02c-rating-durability.sql` | `DATABASE_DRAFT`; Competition Elo signal | **No** — not public Player Rating SSOT |
| Local `src/features/player-rating/` | local assessment engine/store | `LOCAL_ONLY` | **No** |
| Club Elo extension / blob | club services | Legacy / mirror | **No** |

### 3.2 Target ownership model (not a claim of current table authority)

Player Rating **target** domain owns current state, self-assessed / provisional / verified / calculated values, display projection, confidence, history, snapshots, verification, manual adjustment, adjustment audit, result-to-rating processing, idempotency, and reversal — see `00_PHASE_1A_SCOPE_AND_DECISIONS.md` §2.3.

Neighbor owners remain as documented in `01_MODULE_OWNERSHIP_AND_BOUNDARIES.md`.

---

## 4. Display rating vs SSOT

| Concept | Rule |
|---------|------|
| `display_rating` | Projection for UI — **not** an independent source of truth |
| Rounding / step | Presentation concern; must not redefine stored calculated/verified semantics |
| Client-supplied display/verified values | Not authoritative |

Evidence of V5 display helper: `toDisplayRating` in `ratingScale.js` (`CODE_PRESENT`). Evidence of server-authority intent: `docs/v5/rating-v5/adr/ADR-001-server-authoritative-rating.md` (`Accepted` ADR; Production cutover still `PRODUCTION_STATUS_UNVERIFIED`).

---

## 5. Freeze statement

Scale classifications and the “no single runtime SSOT yet” finding are frozen. Target public scale is 1.5–6.0 as a documentation contract only. No conversion, migration, or UI scale change is authorized by Phase 1A.
