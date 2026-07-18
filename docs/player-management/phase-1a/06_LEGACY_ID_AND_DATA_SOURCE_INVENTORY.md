# 06 — Legacy ID and Data Source Inventory

**Phase:** 1A — Contract Freeze  
**Status:** Official  
**Baseline:** Phase 1 Read-Only Audit (2026-07-18)

---

## Classification legend

| Class | Meaning |
|-------|---------|
| **canonical candidate** | Eligible to become / already preferred as official person key |
| **legacy operational source** | Still used in production paths; not long-term SSOT |
| **alias** | Alternate id for the same person |
| **membership edge** | Club belonging relationship, not person SSOT |
| **rating reference** | Points at a person for rating records |
| **ranking reference** | Points at a person for ranking records |
| **deprecated** | Must not be treated as SSOT; migrate away |
| **future migration target** | Intended destination after Owner-approved migration |

A single store may carry more than one class.

---

## Inventory

### 1. Auth users (`auth.users`)

| Attribute | Value |
|-----------|--------|
| ID space | UUID (`auth.users.id`) |
| Classification | alias (login identity) — **not** canonical `player_id` |
| Owner | Identity & Authentication |
| Notes | Required for auth-linked players; optional for non-auth players |
| Future | Remains login SSOT; links to Player via `authUserId` |

### 2. Profiles (`public.profiles`)

| Attribute | Value |
|-----------|--------|
| ID space | UUID PK = `auth.users.id` |
| Classification | legacy operational source (account + demographics mirror) + alias bridge |
| Owner | Identity & Authentication |
| Fields of interest | `display_name`, `phone`, `avatar_url`, `gender`, `birth_year`, `status`, `player_id`, (deprecated) `club_id` |
| Future | Account SSOT; demographics migrate toward Player Management write path |

### 3. `profiles.player_id`

| Attribute | Value |
|-----------|--------|
| ID space | Free text (no FK) |
| Classification | **alias** / preferred explicit map to canonical `player_id` |
| Owner | Bridge jointly governed by Identity (column) + Player Management (value policy) |
| Notes | Wave A convention often `player-auth-{authUserId}`; not membership SSOT |
| Future | Remains alias until/unless Player table becomes physical SSOT |

### 4. Athletes (`public.athletes`)

| Attribute | Value |
|-----------|--------|
| ID space | UUID `athletes.id` |
| Classification | legacy operational source + **alias** for cloud personhood |
| Owner | Club / Phase 42 cloud model today |
| Notes | `user_id` nullable; uniqueness historically soft — Phase 42N aims 1 auth → ≤1 athlete |
| Future | Alias of canonical player; not a second person store |

### 5. Club members (`public.club_members`)

| Attribute | Value |
|-----------|--------|
| ID space | UUID membership id; keys `user_id`, optional `athlete_id` |
| Classification | **membership edge** |
| Owner | Club Management |
| Status | `active` \| `left` \| `removed` |
| Future | Remains membership SSOT; references canonical `player_id` |

### 6. Club blob players (`club_data_v3.data.players[]`)

| Attribute | Value |
|-----------|--------|
| ID space | Opaque text per club blob |
| Classification | **legacy operational source** + alias candidates |
| Owner | Club storage / scheduling (today) |
| Notes | Primary operational roster for many tournament / history flows |
| Future | **future migration target** → Player Management facade; blob becomes mirror or retire |

### 7. `player-auth-{authUserId}`

| Attribute | Value |
|-----------|--------|
| ID space | Prefixed string |
| Classification | **canonical candidate** (preferred auth-linked form) |
| Owner | Player Management (contract); builders exist under club repos today |
| Notes | Used by DERIVED resolution and Wave A link plan |
| Future | Official preferred `player_id` for auth-linked athletes |

### 8. `profile-{authUserId}`

| Attribute | Value |
|-----------|--------|
| ID space | Prefixed route id |
| Classification | **alias** (UI/route only) |
| Owner | Account-only athlete routing (`accountOnlyAthleteService`) |
| Notes | **Not** canonical `player_id` |
| Future | Remain route alias or collapse behind Player resolve API |

### 9. `athlete-{athleteId}`

| Attribute | Value |
|-----------|--------|
| ID space | Prefixed route id over `athletes.id` |
| Classification | **alias** (UI/route only) |
| Owner | Club athlete resolve paths |
| Notes | Bookmark/legacy route; resolves via Phase 42N RPCs |
| Future | Route alias only |

### 10. `pick_vn_player_ratings` (Pick_VN V2)

| Attribute | Value |
|-----------|--------|
| ID space | Text rating `id`; unique `auth_user_id`; optional `vpr_athlete_id` |
| Classification | **rating reference** (+ legacy key by auth) |
| Owner | Player Rating |
| Future | Adapter to canonical `player_id`; no algorithm change in Phase 1A |

### 11. `player_ratings` (CC-02)

| Attribute | Value |
|-----------|--------|
| ID space | Text `player_id` (+ tenant) |
| Classification | **rating reference** / legacy operational key |
| Owner | Competition-core rating |
| Future | Align text `player_id` to canonical player ids via adapters |

### 12. Rating V5 `player_id` (`player_rating_profiles`)

| Attribute | Value |
|-----------|--------|
| ID space | UUID **references `profiles(id)`** today |
| Classification | **rating reference** with **non-canonical naming** |
| Owner | Player Rating V5 |
| Notes | Homonym risk: column name `player_id` ≠ canonical Player Management `player_id` |
| Future | Adapter layer; eventual alignment requires explicit migration design (out of 1A) |

### 13. `vpr_athletes`

| Attribute | Value |
|-----------|--------|
| ID space | UUID ranking athlete |
| Classification | **ranking reference** / ranking registry alias |
| Owner | Ranking (VPR) |
| Notes | Separate from club `athletes` |
| Future | Link to canonical `player_id`; retain ranking registry as needed |

### 14. `vpr_athlete_links`

| Attribute | Value |
|-----------|--------|
| ID space | (`vpr_athlete_id`, `club_id`, `player_id` text) |
| Classification | **ranking reference** + alias bridge to club/blob player ids |
| Owner | Ranking |
| Future | `player_id` text should resolve to canonical player |

### 15. Non-auth convention `player-{uuid}`

| Attribute | Value |
|-----------|--------|
| ID space | Prefixed UUID |
| Classification | **canonical candidate** (non-auth persons) |
| Owner | Player Management |
| Notes | Required by Phase 1A contract; minting deferred to later phases |
| Future | Official form for players without login |

---

## Homonym / collision watchlist

| Collision | Risk |
|-----------|------|
| Blob `players[].id` vs `athletes.id` vs `profiles.player_id` | Triple person SSOT |
| `player-auth-*` vs `profile-*` vs bare UUID | Wrong store writes / wrong picker |
| Rating V5 `player_id` (= profiles.id) vs canonical `player_id` | Wrong joins |
| Venue `customer.id` vs player ids | CRM / athlete mix-up |
| RBAC role `CUSTOMER` vs venue customer entity | Naming collision |

---

## Competition Engine IDs (out of Player SSOT)

Documented for boundary clarity only:

| ID | Class |
|----|-------|
| `ParticipantReference` kinds | Competition reference (not Player SSOT) |
| `competitionParticipantId` | Competition-scoped |
| `ParticipantSnapshot` | Frozen competition projection |

Phase 1A does not modify these.

---

## Migration posture (documentation only)

| From | Toward |
|------|--------|
| Blob players as person SSOT | Player Management canonical profile |
| Multi meaning `player_id` | Single resolution API + adapters |
| Rating keys by auth / profiles.id | Explicit adapters → canonical `player_id` |
| Ranking links by blob text id | Same canonical id |

**Phase 1A performs no migration.**
