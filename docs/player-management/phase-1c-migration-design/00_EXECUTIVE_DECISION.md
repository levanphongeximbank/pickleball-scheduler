# 00 — Executive Decision

**Branch:** `feature/player-phase-1c-migration-design`  
**Base:** Phase 1C contract `56fdb3cfa46c4c7b5327038f95a59516eb03db7e`  
**Mode:** Read-only audit + docs-only design  
**Date:** 2026-07-18  

---

## Decision

**Recommended canonical storage for Phase 1C foundation fields: OPTION A — extend `public.profiles`.**

Add additive nullable columns on the existing auth-linked person row:

| Column | Type |
|--------|------|
| `birth_date` | `date` null |
| `handedness` | `text` + CHECK |
| `activity_region` | `jsonb` null |
| `privacy_settings` | `jsonb` null |
| `identity_verification_status` | `text` + CHECK default `unverified` |

**Retain** existing `profiles.birth_year` and `profiles.gender`.

**Rejected for this migration wave: OPTION B — new `player_profiles` table** (see `04_CANONICAL_TABLE_OPTIONS.md`).

---

## Why Option A (architecture, not convenience)

1. **Already hybrid:** `gender` and `birth_year` already live on `profiles` (Phase 31); Rating V5 and many FKs already treat `profiles.id` as the person key.  
2. **No second identity store:** Additive columns keep one physical person row for auth-linked athletes.  
3. **RLS reuse:** `profiles_self_update` / staff policies already exist; guard trigger already protects privileged account fields.  
4. **Write path fit:** Phase 1C `updatePlayerProfile` + optional Identity birthYear writer already target this row family.  
5. **Lower dual-write risk than Option B now:** Introducing `player_profiles` while `birth_year`/`gender` remain on `profiles` would force dual-write or split reads during transition.

## Conditions / limitations (must accept)

1. **Auth-linked scope for durable writes in this wave:** rows require `profiles.id` (= `auth.users.id`). Non-auth `player-{uuid}` persons remain on legacy blob / non-durable overlay until a later wave.  
2. **Ownership remains split by contract:** Identity owns account/RBAC/session; Player Management owns demographics/privacy/verification **field contract** and the single `updatePlayerProfile` write API. Physical co-location ≠ Identity ownership of Player fields.  
3. **No executable SQL in this task** — Owner must approve a later SQL implementation task before Staging apply.

---

## Verdict stance

**PASS WITH CONDITIONS** — design complete; implementation/SQL not started; non-auth durable storage deferred.
