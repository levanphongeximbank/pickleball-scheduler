# COACHING-04 — PLAYER Self-Scope Mapping Blocker Certification

**Status:** CERTIFIED BLOCKED — not Staging GO  
**Date:** 2026-07-25  
**Branch:** `feature/bm-coaching-04-assignment-rls-ui-cutover`  
**PR:** #269  
**Audit HEAD:** `8c5a2af231f779bbedb2cced1398437506d24175` (pre-certification base)  
**Marker:** `COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED_NO_STAGING_GO`

---

## 1. Verdict

Independent principal → Coaching `player_id` audit **did not prove** a canonical, fail-closed SQL RLS contract suitable for PLAYER self-scope.

Therefore:

- No invented Coaching mapping helpers
- No PLAYER Coaching permission seeds/grants
- No PLAYER self-scope RLS policies
- No COACH-only SQL apply from this audit
- **COACHING-04 Staging GO remains withheld** for PLAYER self-scope (and this audit does not authorize any Staging apply)

Related prior marker remains valid: `COACHING_04_PLAYER_SELF_SCOPE_MAPPING_BLOCKED` in `02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md`.

---

## 2. Sources audited (read-only)

| Area | Paths / artifacts |
|------|-------------------|
| Player Management app | `src/features/player/**` (no `src/features/player-management/**`) |
| Resolution facade | `resolveByAuthUser.js`, `resolveCanonicalPlayerId.js`, `resolutionOutcomes.js` |
| Club canonical repo | `src/features/club/repositories/canonicalPlayerRepository.js`, `canonicalRepositoryTypes.js` |
| Platform adapter | `src/features/player/platform/playerPlatformAdapter.js` |
| Athlete adapter | `src/features/player/adapters/athleteAdapter.js` |
| Identity schema | `docs/supabase-rbac.sql` (`public.profiles`) |
| Club membership schema | `docs/v5/PHASE_42B_SCHEMA.sql` (`club_members`, `athletes`) |
| Player Management docs | Phase 1A inventory; Phase 1B facade; Phase 1F-A self profile; Phase 1I directory SQL |
| Module-scoped SQL | `docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql` (`team_tournament_user_player_id`) |
| Rating ID space | `docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql` |
| Coaching pack | `docs/coaching-training/coaching-02/**`, `coaching-04/02_*`, `10_*` (PLAYER helpers absent) |
| Tests sampled | player-management Phase 1B facade; self-profile; coaching-04 static blocker assertions |

Player / Identity / Club **internals were not modified**.

---

## 3. Candidate mappings rejected

| Candidate | Why rejected for Coaching RLS SoT |
|-----------|-----------------------------------|
| `auth.uid() = player_id` | Coaching `player_id` is typed Player Management **text** (deferred RI), not auth UUID. Equality is unproven and forbidden without adapter. |
| `profiles.id = auth.uid()` | **Accepted only as Identity principal.** Not Coaching `player_id`. |
| `profiles.player_id` | Alias column: nullable, **no FK**, historically **not UNIQUE**, free text. Resolution outcomes include MAPPED / DERIVED / UNMAPPED / INVALID / AMBIGUOUS. |
| `team_tournament_user_player_id()` | Team-Tournament module helper: thin `profiles.player_id` read; empty string when null; no tenant/club; no AMBIGUOUS/INVALID fail-closed contract for Coaching. |
| Rating V5 `auth.uid() = player_id` | Rating `player_id` is `uuid REFERENCES profiles(id)` — different ID space from Coaching typed text. |
| JS `resolveByAuthUser` / `resolveCanonicalPlayerId` | App-layer facade only; multi-outcome; may refuse selection when AMBIGUOUS; **not** a SECURITY DEFINER Coaching RLS helper. |
| `club_members` / `athletes` | Membership/athlete edges use `user_id` / `athlete_id`; **no** canonical Coaching `player_id` column contract for self-scope. |
| Any `coaching_04_*player*` helper | Intentionally absent; verification expects zero rows. Inventing one here would be a security fiction. |

---

## 4. Partial chain (proven fragments only)

```text
auth.users.id
  → public.profiles.id                 ✅ Identity principal (PK/FK)
  → public.profiles.player_id          ⚠️ alias only (not Coaching SoT)
  → JS resolveByAuthUser outcomes      ⚠️ MAPPED|DERIVED|UNMAPPED|INVALID|AMBIGUOUS
  → public.club_members (user_id)      ✅ membership edge (no player_id column)
  → coaching_*.player_id               ❌ typed deferred-RI text; no principal binding SQL
```

Missing link for Coaching: **one deterministic SQL function/view** returning a single Coaching `player_id` (or fail-closed NULL) for JWT principal in `(tenant_id, club_id)` with Owner-approved UNMAPPED/INVALID/AMBIGUOUS semantics.

---

## 5. Staging read-only proof

Target: `qyewbxjsiiyufanzcjcq`  
Method: `BEGIN TRANSACTION READ ONLY` … `ROLLBACK` via Management API catalog probe  
Script: `scripts/coaching/coaching-04-player-mapping-audit.mjs`  
Probe builder: `buildCoaching04PlayerMappingProbeSql()`  

Evidence files:

- `evidence/PLAYER_MAPPING_OFFLINE.json`
- `evidence/PLAYER_MAPPING_LIVE_READONLY.json`

Mandatory safety stamps (must remain):

```text
databaseWrites=0
sqlApplied=false
roleGrantsApplied=false
productionTouched=false
```

Catalog checks (presence/signature/index/count — no PII dumps):

- `profiles` columns (`id`, `player_id`, `status`, `venue_id`, `club_id`)
- indexes on `profiles.player_id` (unique vs non-unique)
- `club_members` / `athletes` column inventory for `player_id`
- presence/absence of `team_tournament_user_player_id` and invented `coaching_04_*player*` helpers
- `coaching.self.%` permission count
- PLAYER role → coaching.* grant count

**Staging catalog visibility does not create a Coaching SoT.** Even if `profiles.player_id` or TT helper exist on Staging, Coaching still lacks an Owner-approved principal→Coaching-`player_id` contract.

---

## 6. Missing canonical contract

Owning workstreams (joint Owner decision required):

1. **Player Management** — canonical `player_id` value policy + resolution SoT for Coaching typed refs  
2. **Identity** — principal / profiles binding rules compatible with that SoT  
3. **Coaching** (later pack) — SECURITY DEFINER helpers + PLAYER self-scope RLS/grants **only after** (1)+(2)

---

## 7. Acceptance criteria to unblock

All must be true before any PLAYER Coaching grant/RLS authoring:

1. Canonical SQL function/view: `auth.uid()` → Coaching `player_id` for `(tenant_id, club_id)` with fixed `search_path`, `REVOKE PUBLIC`, no anon, no caller-supplied player identity.
2. Explicit fail-closed handling for UNMAPPED / INVALID / AMBIGUOUS / inactive membership (no silent backfill, no first-candidate pick).
3. Documented policy when one principal could map to multiple player ids.
4. Uniqueness / lifecycle / deletion / reassignment semantics published and tested.
5. Positive self-read + negative cross-player / cross-tenant / cross-club SQL fixtures.
6. Dedicated self-read permission (e.g. `coaching.self.read`) — **never** `coaching.records.read` for PLAYER.
7. Owner approval of the SoT and permission catalog; then COACHING-04 (or successor) additive SQL + tests.

---

## 8. Explicit non-actions from this audit

1. Do not apply COACHING-04 SQL or COACH grants solely because this audit completed.  
2. Do not invent `coaching_04_mapped_player_id()` (or equivalent) from `profiles.player_id` / TT helper / Rating equality.  
3. Do not modify Player / Identity / Club internals in this workstream.  
4. Do not activate durable runtime or retire localStorage.  
5. Staging GO for COACHING-04 remains an **Owner** decision; PLAYER self-scope stays blocked until criteria in §7.

---

## 9. Cross-references

- `02_COACHING_04_PLAYER_SELF_SCOPE_MAPPING.md`  
- `05_COACHING_04_ACCESS_MATRIX.md` (PLAYER = blocked / N)  
- `10_COACHING_04_ASSIGNMENT_HELPERS.sql` (PLAYER helpers INTENTIONALLY ABSENT)  
- `40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql` (no PLAYER grants)  
- COACHING-03 matrix: PLAYER zero until self-scope proven
