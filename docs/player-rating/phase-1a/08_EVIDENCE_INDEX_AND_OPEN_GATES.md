# 08 — Evidence Index and Open Gates

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official evidence register
**Production claims:** Evidence-safe labels only

---

## 1. Evidence index

### 1.1 Canonical identity

| Conclusion | Path | Symbol / artifact | Why | Uncertainty |
|------------|------|-------------------|-----|-------------|
| Player Management owns canonical `player_id` | `docs/player-management/phase-1a/01_MODULE_BOUNDARIES.md` | §2 Owns table | Explicit ownership contract | PM Phase 1A note historically said module “not created”; code now exists at `src/features/player/` |
| Canonical ID mint/alias contract | `docs/player-management/phase-1a/02_CANONICAL_PLAYER_ID_CONTRACT.md` | `player_id` contract | Official PM freeze | Mint string conventions exist; Player Rating Owner decision requires **opaque** FK treatment |
| Legacy ID inventory + V5 homonym | `docs/player-management/phase-1a/06_LEGACY_ID_AND_DATA_SOURCE_INVENTORY.md` | inventory sections | Lists aliases and Rating V5 `player_id`→`profiles.id` warning | Inventory completeness may evolve |
| Resolver implementation | `src/features/player/services/resolveCanonicalPlayerId.js` | `resolveCanonicalPlayerId`, `parsePlayerReference` | `CODE_PRESENT` | Player Rating port adapter not implemented |
| Resolution outcomes | `src/features/player/constants/resolutionOutcomes.js` | `RESOLUTION_OUTCOME` | `CODE_PRESENT` | — |
| ID helpers | `src/features/player/utils/playerId.js` | prefix helpers | `CODE_PRESENT` | Opacity still required for Rating FK |
| Derived auth id builder in Club | `src/features/club/repositories/canonicalRepositoryTypes.js` | `buildDerivedAuthPlayerId` | `CODE_PRESENT` + location is Club | Ownership tension — mint helpers still appear under Club |

### 1.2 Rating scales

| Conclusion | Path | Symbol | Why | Uncertainty |
|------------|------|--------|-----|-------------|
| V5 band 1.5–6.0 | `src/features/pick-vn-rating-v5/constants/ratingScale.js` | `V5_MIN_RATING`, `V5_MAX_RATING` | `CODE_PRESENT` | Flag-gated; Production `PRODUCTION_STATUS_UNVERIFIED` |
| V2 band 1.0–8.0 | `src/features/pick-vn-rating/constants/pickVnRatingScale.js` | `PICK_VN_MIN`, `PICK_VN_MAX` | `CODE_PRESENT` legacy scale | — |
| Competition Elo ~1500 | `src/features/competition-core/rating/ratingConstants.js` | `DEFAULT_COMPETITION_ELO` | `CODE_PRESENT` | Not public Player Rating |
| Club Elo ~1500 | `src/features/club/constants/clubStatus.js` / `clubEloService.js` | `DEFAULT_CLUB_ELO` | `CODE_PRESENT` | Club-scoped |
| VPR points | `src/features/vpr-ranking/constants/defaultPointConfig.js` | `DEFAULT_VPR_POINT_TABLE` | `CODE_PRESENT` Ranking | Not Player Rating |

### 1.3 Rating feature surfaces / flags

| Conclusion | Path | Symbol / flag | Why | Uncertainty |
|------------|------|---------------|-----|-------------|
| V5 gated | `src/features/pick-vn-rating-v5/config/featureFlags.js` | `VITE_PICK_VN_RATING_V5_ENABLED` default false | `FLAG_GATED` | Production enablement unverified here |
| V5 table registry | `src/features/pick-vn-rating-v5/constants/v5TableRegistry.js` | table name constants | `CODE_PRESENT` | DB apply status separate |
| V5 SQL draft | `docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql` | `player_rating_profiles`, `player_rating_events`, `rating_snapshots`, … | `DATABASE_DRAFT` | Not declared SSOT |
| Staging QA artifacts | `docs/v5/rating-v5/qa-evidence/` | reports JSON | `STAGING_EVIDENCE_PRESENT` | Not Production proof |
| Competition rating flag | `src/features/competition-core/config/featureFlags.js` | `VITE_COMPETITION_CORE_RATING_V2_ENABLED` | `FLAG_GATED` | Elo signal only |
| VPR flags | `src/features/vpr-ranking/config/vprFlags.js` | `VITE_VPR_RANKING_ENABLED`, `VITE_VPR_CLOUD_SYNC` | `FLAG_GATED` | Ranking domain |
| Local assessment | `src/features/player-rating/` | local engine/store | `LOCAL_ONLY` | — |

### 1.4 Security / trust

| Conclusion | Path | Symbol | Why | Uncertainty |
|------------|------|--------|-----|-------------|
| Forbidden client fields | `src/features/pick-vn-rating-v5/security/forbiddenClientFields.js` | `FORBIDDEN_CLIENT_RATING_FIELDS` | `CODE_PRESENT` | Defense-in-depth only |
| Server-authoritative ADR | `docs/v5/rating-v5/adr/ADR-001-server-authoritative-rating.md` | ADR-001 | Documents V2 client trust issue | V2 hardening still open |
| Permission matrix | `docs/v5/rating-v5/V5-A_PERMISSION_MATRIX.md` | matrix | Docs | Runtime `PRODUCTION_STATUS_UNVERIFIED` |

### 1.5 Idempotency (Competition Elo — related, not Player Rating SSOT)

| Conclusion | Path | Symbol | Why | Uncertainty |
|------------|------|--------|-----|-------------|
| CC-02C application key | `docs/competition-core/CC02C_IDEMPOTENCY_DESIGN.md` | `(match_id, player_id, rating_type)` | Design for Competition Elo durability | Narrower than Player Rating Phase 1A identity; `DATABASE_DRAFT` / not applied per doc |
| Runtime store helper | `src/features/competition-core/rating/ratingIdempotencyStore.js` | `buildRatingApplicationKey` | `CODE_PRESENT` | Competition Elo path |

### 1.6 Ownership boundary references

| Conclusion | Path | Why |
|------------|------|-----|
| PM boundaries include Rating/Ranking | `docs/player-management/phase-1a/01_MODULE_BOUNDARIES.md` §§6–7 | Neighbor freeze |
| Club excludes Rating SSOT ownership | `docs/club-phase2/CLUB_PHASE2_DOMAIN_FREEZE.md`, `docs/club-phase2/READ_WRITE_OWNERSHIP.md` | Club docs |
| V2 coexistence | `docs/v5/rating-v5/adr/ADR-005-v2-coexistence.md` | Legacy coexistence |

### 1.7 Competition result dependency

| Conclusion | Path | Symbol | Why | Uncertainty |
|------------|------|--------|-----|-------------|
| Required event names not found as symbols | repository-wide audit | `MATCH_RESULT_VALIDATED`, `MATCH_RESULT_INVALIDATED` | Absent as exact shipped constants | **Open Competition Engine publication gate** |
| Related lifecycle docs | `docs/competition-engine/core-07/` | `RESULT_FINALIZED`, etc. | Result lifecycle language exists | Not equivalent to required dependency event names |
| Elo apply from match | `src/features/competition-core/rating/` | apply + eligibility helpers | `CODE_PRESENT` + `FLAG_GATED` | Not public Player Rating algorithm |

---

## 2. Open gates (must not be guessed closed)

| ID | Gate | Blocker / evidence gap | Required next owner action (outside Phase 1A) |
|----|------|------------------------|-----------------------------------------------|
| G-ID-01 | Rating stores ↔ opaque PM `player_id` adapter | V5 homonym `profiles.id`; V2 `auth_user_id`; CC-02 text; blob ids | Authorized adapter design + evidence |
| G-ID-02 | Mint convention vs Rating opacity | PM docs list preferred string forms; Owner Rating decision requires opaque FK | Keep opacity; PM remains mint owner |
| G-CE-01 | Competition Engine publishes `MATCH_RESULT_VALIDATED` / `MATCH_RESULT_INVALIDATED` | Exact symbols not found | Competition Engine contract publication |
| G-CE-02 | `result_revision` wire format shared with Rating application identity | Not frozen jointly in this phase | Cross-module contract workshop |
| G-ALG-01 | Final match-result rating algorithm | Explicitly out of Phase 1A | Separate Owner authorization |
| G-MODE-01 | Mixed doubles rating semantics | Open design gate | Separate design |
| G-MODE-02 | Team rating semantics | Open design gate | Separate design |
| G-SSOT-01 | Single runtime Player Rating SSOT table/service | Multiple candidates; none proven Production SSOT here | Later phase with Production evidence |
| G-SEC-01 | Legacy V2 client-trusted verified fields | ADR-001 | Hardening / deprecation plan |
| G-PROD-01 | Production enablement of V5 / CC rating flags | Docs/QA exist; this phase did not re-verify live Production | Production verification checklist under separate auth |
| G-REV-01 | Runtime reversal ledger for Player Rating application identity | Contract only | Implementation phase later |
| G-BOOTSTRAP-01 | How is the initial Player Rating record created or initialized? **OPEN / UNRESOLVED**. Candidate classifications (none preferred): lazy bootstrap on first authorized read or operation; external Player Management event dependency; explicit manual initialization; another future Owner-approved mechanism | Bootstrap architecture not defined in Phase 1A; no preferred approach selected | Later Owner-approved phase must resolve; do not invent producers/events/runtime/SQL in Phase 1A |

---

## 3. Competition Engine dependency gates (summary)

Player Rating Phase 1A **depends on** Competition Engine to own and eventually publish:

1. `MATCH_RESULT_VALIDATED`
2. `MATCH_RESULT_INVALIDATED`

with identifiers sufficient for Rating application identity (`match_id`, `result_revision`, resolvable participants → `player_id`, tenant scope).

Until G-CE-01 / G-CE-02 close, Player Rating must not invent Competition Engine producers or pretend these events already ship.

---

## 4. Explicit non-claims

This evidence register does **not** claim:

* Any rating path is `PRODUCTION_ACTIVE`
* Any SQL file has been applied to Production
* Canonical identity FK alignment is complete across rating stores
* A final rating algorithm has been selected
* Mixed doubles or team rating rules exist

---

## 5. Freeze statement

Evidence citations and open gates above are the Phase 1A honesty baseline for Owner review. Closing gates requires separate authorization and must not occur by silent assumption inside Phase 1A docs-only work.
