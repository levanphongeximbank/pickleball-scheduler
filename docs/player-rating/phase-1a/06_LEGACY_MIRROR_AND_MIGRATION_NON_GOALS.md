# 06 — Legacy, Mirror, Shadow, and Migration Non-Goals

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official documentation freeze
**Migration / deletion / rename of legacy modules:** Forbidden in Phase 1A

---

## 1. Classification vocabulary

| Label | Meaning |
|-------|---------|
| `LEGACY_FALLBACK` | Older path retained for compatibility; not target SSOT |
| `MIRROR` | Parallel calculation or display copy; not authoritative Player Rating SSOT |
| `SHADOW` | Parallel/shadow evaluation without becoming public SSOT by itself |
| `MOCK_ONLY` | Test/mock surface only |
| `LOCAL_ONLY` | Local/device persistence without cloud SSOT claim |
| `CODE_PRESENT` | Exists in source; not a Production-active claim |
| `FLAG_GATED` | Runtime path requires feature flag |
| `DATABASE_DRAFT` | SQL/docs artifact; apply/live status not assumed |
| `STAGING_EVIDENCE_PRESENT` | Staging/QA evidence artifacts exist |
| `PRODUCTION_STATUS_UNVERIFIED` | Production liveness not verified in this phase |

---

## 2. Surface classifications

| Surface | Path / symbol | Classification | Notes |
|---------|---------------|----------------|-------|
| Rating V5 feature module | `src/features/pick-vn-rating-v5/` | `CODE_PRESENT` + `FLAG_GATED` | Flag `VITE_PICK_VN_RATING_V5_ENABLED` default false |
| Rating V5 SQL foundation | `docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql` + later phase SQL | `DATABASE_DRAFT` | Do not declare Production SSOT |
| Rating V5 QA evidence | `docs/v5/rating-v5/qa-evidence/` | `STAGING_EVIDENCE_PRESENT` | Not automatic Production proof |
| Rating V5 shadow/rollout | `ratingV5RolloutService.js` (`shadow_mode_enabled`, `is_shadow` in completion builders) | `CODE_PRESENT` + shadow semantics | Shadow ≠ public SSOT |
| Pick_VN V2 | `src/features/pick-vn-rating/` + `docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql` | `LEGACY_FALLBACK` + `DATABASE_DRAFT` | Scale 1.0–8.0 legacy compatibility |
| V2 client sync trust risk | `pick_vn_sync_rating` (ADR-001 context) | `LEGACY_FALLBACK` hardening gate | Client-trusted verified fields — not target |
| Local player-rating assessment | `src/features/player-rating/` | `LOCAL_ONLY` | Not cloud SSOT |
| Competition Elo V2 | `src/features/competition-core/rating/` | `CODE_PRESENT` + `FLAG_GATED` | Internal competition signal / mirror relative to public Player Rating |
| CC-02 / CC-02C SQL | `docs/competition-core/supabase-cc02-*.sql` | `DATABASE_DRAFT` | Docs mark not for Production apply without Owner GO |
| Club Elo | `clubEloService.js` / `DEFAULT_CLUB_ELO` | Club-scoped legacy/mirror | Not public Player Rating |
| VPR ranking | `src/features/vpr-ranking/` | Ranking domain + `FLAG_GATED` | Not Player Rating |

Coexistence ADR (read-only reference): `docs/v5/rating-v5/adr/ADR-005-v2-coexistence.md`.

---

## 3. Explicit migration non-goals (Phase 1A)

Phase 1A must **not**:

1. Convert V2 1.0–8.0 values to V5 1.5–6.0 (or any scale conversion)
2. Convert Competition Elo ↔ public skill rating
3. Convert Club Elo ↔ public Player Rating
4. Convert VPR points ↔ Player Rating
5. Backfill Production or Staging rating rows
6. Delete legacy logic or rename existing modules
7. Cut over dual-write / single-write SSOT
8. Declare any existing table Production-authoritative without separate verified evidence + Owner GO
9. Implement shadow-to-public promotion pipelines

---

## 4. Target posture toward legacy

| Legacy / mirror | Target posture (docs only) |
|-----------------|----------------------------|
| Pick_VN V2 | Compatibility scale until a later authorized cutover |
| Competition Elo | Remains Competition-owned calculation signal; may inform future ports but is not public Player Rating |
| Club Elo | Remains club-scoped operational calculation |
| VPR | Remains Ranking-owned |
| V5 shadow rows / flags | Evidence of gated experimentation; not automatic public SSOT |

---

## 5. Freeze statement

Legacy, mirror, shadow, and mock classifications are frozen for honesty in planning. No migration or deletion work is authorized by Phase 1A.
