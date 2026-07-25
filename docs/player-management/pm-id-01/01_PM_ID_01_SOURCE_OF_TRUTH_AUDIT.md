# PM-ID-01 — Source of Truth Audit

**Method:** Read contracts + code + SQL inventories. No inference from file/column names alone.  
**Scope:** Principal, Player, Membership, Mapping candidates.

---

## A. Principal SoT

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| `auth.users.id` | **VERIFIED_CANONICAL** | Chain map in `docs/player-management/phase-1c-migration-design/02_IDENTITY_AND_PLAYER_OWNERSHIP.md`; `profiles.id` PK references `auth.users(id)`. |
| `auth.uid()` | **VERIFIED_CANONICAL** (SQL session principal) | Used fail-closed in directory RPCs (`docs/player-management/phase-1i/06_PHASE_1I_0_SQL_CONTRACT.md`) and RBAC helpers (`docs/supabase-rbac.sql`). |
| `profiles.id` | **VERIFIED_CANONICAL** (account key = auth user uuid) | `src/auth/profileService.js` and schema: profile id equals auth user id. |
| Identity Tenant `projectIdentityActor` | **PARTIAL_ONLY** | Projects already-resolved `{actorType, actorId}`; does not authenticate (`identityActorAdapter.js`). |
| App `getCurrentUser()` | **PARTIAL_ONLY** | Session bridge for JS; not database SoT. |

**PM-ID-01 decision:** Resolver principal = `auth.uid()` (SQL) / authenticated session user id (JS). Never caller-supplied.

---

## B. Player SoT

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| Canonical `player_id` type | **VERIFIED_CANONICAL** = **`text` / string** | Phase 1A `02_CANONICAL_PLAYER_ID_CONTRACT.md`; `profiles.player_id text` in `docs/supabase-rbac.sql`. |
| Mint forms | **VERIFIED_CANONICAL** | `player-auth-{authUserId}` / `player-{uuid}`. |
| Dedicated `player_profiles` person table | **REJECTED** (absent this wave) | Phase 1C option B deferred; no CREATE TABLE found. |
| Hybrid stores (`profiles` + blob `players[]` + `athletes`) | **PARTIAL_ONLY** | Operational/directory sources; not a single person table. |
| Lifecycle fields | **PARTIAL_ONLY** | Split across `profiles.status`, athlete status, membership status — not one player row lifecycle. |

**PM-ID-01 decision:** Store canonical `player_id` as **`text`**. Do not cast to uuid. Existence checks are fail-closed in helpers (no inventing rows).

---

## C. Membership scope

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| `tenant_id` | **VERIFIED_CANONICAL** = `text` = `venues.id` | `docs/v5/PHASE_42B_SCHEMA.sql` comment + FKs. |
| `club_id` | **VERIFIED_CANONICAL** = `text` = `clubs.id` | Same schema; `club_members.club_id`. |
| Active membership SSOT | **VERIFIED_CANONICAL** | `public.club_members` with `status in ('active','left','removed')`; active unique `(club_id, user_id)`. |
| `profiles.club_id` | **REJECTED** as membership SoT | Module boundaries: membership SSOT is `club_members`. |
| Account suspension | **PARTIAL_ONLY** | `profiles.status = 'suspended'` is account lock, distinct from membership end. |

**PM-ID-01 decision:** MAPPED requires active `club_members` row for `(tenant_id, club_id, principal_id)`.

---

## D. Mapping candidates

| Candidate | Verdict | Why |
|-----------|---------|-----|
| Dedicated `player_identity_links` (this package) | **VERIFIED_CANONICAL** (authored SoT) | No prior equivalent table exists; additive Player-owned mapping. |
| `profiles.player_id` | **PARTIAL_ONLY** | Preferred alias/bridge for app resolution; nullable; no FK; historically not UNIQUE; rejected as Coaching RLS SoT. |
| `resolveByAuthUser` / `resolveCanonicalPlayerId` | **PARTIAL_ONLY** | App-layer Phase 1B facade; includes DERIVED; accepts injected auth id; not SECURITY DEFINER SoT. |
| `canonicalPlayerRepository.resolvePlayerForProfile` | **PARTIAL_ONLY** | Club hybrid policy; DERIVED path. |
| `adaptAthleteRow` / `athletes.id` | **LEGACY_ONLY** | Alias person UUID; must not invent player id from athlete uuid. |
| `team_tournament_user_player_id()` | **REJECTED** | Module-scoped thin `profiles.player_id` read; no AMBIGUOUS/INACTIVE contract. |
| `coaching_04_mapped_player_id()` | **REJECTED** / intentionally absent | COACHING-04 helpers document absence; blocker remains. |
| Rating V5 `player_id` (= profiles.id uuid) | **UNSAFE** / **REJECTED** | Different ID space; Phase 1A forbidden equation. |
| Directory RPCs | **UI_ONLY** | Read-model search/get; not principal→player mapper. |
| Self-profile UI | **UI_ONLY** | Consumer of Phase 1F-A facade. |
| Name / email / phone matching | **REJECTED** | Forbidden for PM-ID-01 mapping and backfill. |
| First-row `LIMIT 1` without uniqueness | **UNSAFE** / **REJECTED** | Violates AMBIGUOUS contract. |

---

## Gap closed by PM-ID-01

| Gap | Closure |
|-----|---------|
| No Player-owned SQL mapping table | `player_identity_links` |
| No fail-closed SQL statuses for Coaching RLS | Resolution helper + boolean RLS helper |
| App DERIVED not acceptable for RLS | PM-ID-01 statuses exclude DERIVED; only ACTIVE link → MAPPED |
| Caller-supplied principal risk | Helpers use `auth.uid()` only |

---

## Explicit non-equivalences

```text
auth.uid()              ≠  player_id
profiles.id             ≠  player_id
profiles.player_id      ≠  Coaching SoT (alias only)
player-auth-{uid} alone ≠  MAPPED without ACTIVE link row
```
