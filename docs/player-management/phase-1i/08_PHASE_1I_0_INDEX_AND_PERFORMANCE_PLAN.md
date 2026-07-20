# Phase 1I-0 — Index and Performance Plan

**Owner authorization:** `AUTHORIZE_PHASE_1I_0_SQL_READ_MODEL_DESIGN` · **`APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`**  
**Branch:** `feature/player-phase-1i-0-read-model-design`  
**Base `origin/main` SHA:** `bfb8980852d3c17174b3f77f17331605a5923457`  
**Classification:** Design only — **do not create indexes now**  
**Document verdict:** `READY_FOR_PHASE_1I_0_COMMIT`

---

## 1. Current indexes

| Index | Relevance |
|-------|-----------|
| `profiles_identity_verification_status_partial_idx` | Helpful |
| `profiles_venue_id_idx` / `profiles_club_id_idx` | Unused by directory |
| display_name / privacy / player_id directory covering | **Missing** |

---

## 2. REQUIRED partial index (align eligibility including suspended)

```sql
-- DESIGN_ONLY — NOT AUTHORIZED FOR APPLY
CREATE INDEX /* proposed */ profiles_directory_eligible_name_id_idx
  ON public.profiles (
    lower(trim(display_name)),
    player_id
  )
  WHERE identity_verification_status = 'verified'
    AND privacy_settings IS NOT NULL
    AND jsonb_typeof(privacy_settings) = 'object'
    AND (privacy_settings ->> 'publicProfileEnabled') = 'true'
    AND status IS DISTINCT FROM 'suspended'
    AND player_id IS NOT NULL
    AND length(trim(player_id)) > 0
    AND nullif(trim(display_name), '') IS NOT NULL;
```

| Class | **REQUIRED** |
|-------|--------------|

Supports cursor order `(lower(trim(display_name)), player_id)` and eligibility filter parity with RPC.

---

## 3. Other indexes

| Proposal | Class |
|----------|--------|
| `(player_id) WHERE player_id IS NOT NULL` | **RECOMMENDED** (detail lookup) |
| GIN `activity_region` | **DEFERRED** |
| `pg_trgm` on `display_name` | **DEFERRED** |
| Existing verification partial | **Keep** |

---

## 4. Search / pagination notes

- Leading-wildcard `ILIKE` may not fully use btree — acceptable MVP with max 50 + auth.  
- Opaque cursor only to UI; invalid cursor errors (no reset).  
- No total COUNT.

---

## 5. Rollout

Indexes authored/applied only in **1I-B** (after **1I-A**), Staging first.
