# 03 — Player Profile Field Dictionary

**Phase:** 1A — Contract Freeze  
**Status:** Official  
**Baseline:** Phase 1 Read-Only Audit (2026-07-18)

---

## Conventions

| Column | Meaning |
|--------|---------|
| Type | Logical type for the Player Profile contract |
| Required | Required on a complete Phase 1 profile (not necessarily present in every legacy row today) |
| Owning module | Long-term write owner |
| Current source | Where the value lives today |
| Future canonical source | Where Phase 1+ writes should land |
| Writable in Phase 1 | Whether Player Management Phase 1 (through 1F) is allowed to write it via the new facade — Phase **1A itself writes nothing** |
| Privacy | `public` \| `internal` \| `restricted` \| `system` |
| Legacy aliases | Alternate field names / stores |

Privacy classes:

- **public** — may appear on public profile when privacy settings allow  
- **internal** — staff / authorized operators only  
- **restricted** — elevated RBAC / tenant boundary only  
- **system** — infrastructure / linkage; never public

---

## Field dictionary

### playerId

| Attribute | Value |
|-----------|--------|
| Type | `string` |
| Required | Yes |
| Owning module | Player Management |
| Current source | Blob `players[].id`, `profiles.player_id`, derived `player-auth-*` |
| Future canonical source | Player Management identity record |
| Writable in Phase 1 | Mint/link only under ID contract rules (no silent duplicates) |
| Privacy | system |
| Legacy aliases | `id`, `player_id`, `playerProfileId` |

### authUserId

| Attribute | Value |
|-----------|--------|
| Type | `string` (uuid) \| `null` |
| Required | No (players without login allowed) |
| Owning module | Identity & Authentication (account); Player Management stores the link |
| Current source | `profiles.id` / `auth.users.id`; blob `authUserId` (legacy) |
| Future canonical source | Link field on player profile → Identity account |
| Writable in Phase 1 | Link/unlink only; never create a second profile on link |
| Privacy | system |
| Legacy aliases | `user_id`, `userId`, `profile.id` |

### athleteId

| Attribute | Value |
|-----------|--------|
| Type | `string` (uuid) \| `null` |
| Required | No |
| Owning module | Club / cloud athlete row today; alias under Player Management |
| Current source | `athletes.id` |
| Future canonical source | Alias of canonical `playerId` (not a second person) |
| Writable in Phase 1 | Read + link documentation; no Club schema change in 1A |
| Privacy | system |
| Legacy aliases | `athletes.id`, route `athlete-{id}` |

### displayName

| Attribute | Value |
|-----------|--------|
| Type | `string` |
| Required | Yes |
| Owning module | Player Management (profile); Identity may mirror for account UI |
| Current source | `profiles.display_name`, blob `players[].name`, `athletes.display_name` |
| Future canonical source | Player profile `displayName` |
| Writable in Phase 1 | Yes (via future facade; mirrors allowed) |
| Privacy | public (default) |
| Legacy aliases | `name`, `display_name` |

### fullName

| Attribute | Value |
|-----------|--------|
| Type | `string` \| `null` |
| Required | No |
| Owning module | Player Management |
| Current source | Often same as display name; not consistently separate |
| Future canonical source | Player profile `fullName` |
| Writable in Phase 1 | Yes |
| Privacy | internal (default; may be public if privacy allows) |
| Legacy aliases | legal name fields if introduced later |

### phone

| Attribute | Value |
|-----------|--------|
| Type | `string` \| `null` |
| Required | No |
| Owning module | Player Management (profile contact); Identity may mirror on `profiles.phone` |
| Current source | `profiles.phone`, `athletes.phone`, blob `players[].phone` |
| Future canonical source | Player profile `phone` with Identity mirror for account UX |
| Writable in Phase 1 | Yes |
| Privacy | restricted (never public unless privacy explicitly permits) |
| Legacy aliases | `phone_number` |

### email

| Attribute | Value |
|-----------|--------|
| Type | `string` \| `null` |
| Required | No |
| Owning module | Identity (auth email primary); Player may mirror for directory |
| Current source | Auth / profile email |
| Future canonical source | Identity account email; Player stores optional mirror |
| Writable in Phase 1 | Prefer Identity write path; Player read/mirror |
| Privacy | restricted |
| Legacy aliases | `email_address` |

### avatarUrl

| Attribute | Value |
|-----------|--------|
| Type | `string` (url) \| `null` |
| Required | No |
| Owning module | Player Management (profile); Identity may mirror |
| Current source | `profiles.avatar_url` |
| Future canonical source | Player profile `avatarUrl` |
| Writable in Phase 1 | Yes |
| Privacy | public (default) |
| Legacy aliases | `avatar_url`, `avatar` |

### gender

| Attribute | Value |
|-----------|--------|
| Type | enum `male` \| `female` \| `unknown` |
| Required | No (defaults to `unknown`) |
| Owning module | Player Management |
| Current source | Blob gender (often VN labels); `profiles.gender` (`male`\|`female`\|`other`) |
| Future canonical source | Player profile `gender` (canonical enum) |
| Writable in Phase 1 | Yes — via adapters only for legacy labels |
| Privacy | public (sport category; subject to privacy settings) |
| Legacy aliases | `Nam`, `Nữ`, `M`, `F`, `sex`, `gioiTinh`, profiles `other` → adapter → `unknown` |

### birthDate

| Attribute | Value |
|-----------|--------|
| Type | `date` (ISO) \| `null` |
| Required | No |
| Owning module | Player Management |
| Current source | **Missing** today |
| Future canonical source | Player profile `birthDate` |
| Writable in Phase 1 | Yes (new field; additive) |
| Privacy | restricted (full DOB never public by default) |
| Legacy aliases | `dob`, `date_of_birth` |

### birthYear

| Attribute | Value |
|-----------|--------|
| Type | `number` (yyyy) \| `null` |
| Required | No |
| Owning module | Player Management |
| Current source | `profiles.birth_year` |
| Future canonical source | Player profile `birthYear` (may derive from `birthDate`) |
| Writable in Phase 1 | Yes |
| Privacy | internal (year may be public only if privacy allows; full DOB never) |
| Legacy aliases | `birth_year` |

### ageGroup

| Attribute | Value |
|-----------|--------|
| Type | `string` \| `null` (derived) |
| Required | No |
| Owning module | Player Management (derive); Competition may snapshot eligibility age group |
| Current source | Competition rules / derived; not a stable profile column |
| Future canonical source | Derived from `birthDate` / `birthYear` + rule table |
| Writable in Phase 1 | No (derived only) |
| Privacy | public or internal depending on competition disclosure |
| Legacy aliases | category age bands |

### handedness

| Attribute | Value |
|-----------|--------|
| Type | enum (proposed) `right` \| `left` \| `ambidextrous` \| `unknown` |
| Required | No |
| Owning module | Player Management |
| Current source | **Missing** on profile (glossary / questionnaire text only) |
| Future canonical source | Player profile `handedness` |
| Writable in Phase 1 | Yes (new field) |
| Privacy | public (default) |
| Legacy aliases | `tayThuan`, `hand` |

### activityRegion

| Attribute | Value |
|-----------|--------|
| Type | `string` \| structured region code \| `null` |
| Required | No |
| Owning module | Player Management |
| Current source | **Missing** on player profile (appears on ranking mocks / club city filters) |
| Future canonical source | Player profile `activityRegion` |
| Writable in Phase 1 | Yes (new field) |
| Privacy | public (default) |
| Legacy aliases | `region`, `city`, `khuVuc` |

### profileStatus

| Attribute | Value |
|-----------|--------|
| Type | enum `active` \| `inactive` \| `archived` |
| Required | Yes |
| Owning module | Player Management |
| Current source | Blob `players[].status`; `athletes.status` (`active`\|`inactive`) |
| Future canonical source | Player profile `profileStatus` |
| Writable in Phase 1 | Yes |
| Privacy | internal |
| Legacy aliases | `status` (blob), athlete `status` |

### accountStatus

| Attribute | Value |
|-----------|--------|
| Type | enum `active` \| `suspended` \| `invited` \| `null` |
| Required | No (null when no auth account) |
| Owning module | **Identity & Authentication** (read-only for Player Management) |
| Current source | `profiles.status` |
| Future canonical source | Identity account status |
| Writable in Phase 1 | **No** (Player Management must not write) |
| Privacy | internal / restricted |
| Legacy aliases | user `status` |

### verificationStatus

| Attribute | Value |
|-----------|--------|
| Type | enum (Phase 1 proposed) `unverified` \| `pending` \| `verified` \| `rejected` |
| Required | Yes (default `unverified`) |
| Owning module | Player Management |
| Current source | **Missing** as identity verification (rating has separate verification) |
| Future canonical source | Player profile `verificationStatus` |
| Writable in Phase 1 | Yes (identity verification only) |
| Privacy | internal |
| Legacy aliases | none for identity; **do not** reuse `rating_status` |

### privacySettings

| Attribute | Value |
|-----------|--------|
| Type | object (see `05_PRIVACY_AND_PROFILE_VISIBILITY.md`) |
| Required | Yes (defaults applied) |
| Owning module | Player Management |
| Current source | **Missing** |
| Future canonical source | Player profile `privacySettings` |
| Writable in Phase 1 | Yes |
| Privacy | system / internal |
| Legacy aliases | none |

### clubMembershipReferences

| Attribute | Value |
|-----------|--------|
| Type | `array` of membership refs `{ clubId, clubMemberId?, status, playerId }` |
| Required | No |
| Owning module | **Club Management** (Player stores references only) |
| Current source | `club_members`, blob members |
| Future canonical source | Club membership SSOT; Player returns refs |
| Writable in Phase 1 | No membership writes from Player Management |
| Privacy | internal (public club badges only if privacy allows) |
| Legacy aliases | `club_id` on profiles (deprecated for membership) |

### ratingReferences

| Attribute | Value |
|-----------|--------|
| Type | `array` of rating refs `{ system, recordId, playerKey, status? }` |
| Required | No |
| Owning module | **Player Rating** |
| Current source | `pick_vn_player_ratings`, `player_ratings`, V5 tables, blob skill fields |
| Future canonical source | Rating modules linked by canonical `playerId` |
| Writable in Phase 1 | No rating algorithm / schema rewrite |
| Privacy | public summary vs internal deviation per rating product rules |
| Legacy aliases | `auth_user_id`, V5 `player_id` (= profiles.id), blob `current_rating` |

### rankingReferences

| Attribute | Value |
|-----------|--------|
| Type | `array` of ranking refs `{ system, vprAthleteId?, playerKey, status? }` |
| Required | No |
| Owning module | **Ranking** |
| Current source | `vpr_athletes`, `vpr_athlete_links` |
| Future canonical source | Ranking modules linked by canonical `playerId` |
| Writable in Phase 1 | No ranking algorithm / schema rewrite |
| Privacy | public standings fields per ranking product; links internal |
| Legacy aliases | `vpr_athlete_id`, link `player_id` text |

### createdAt

| Attribute | Value |
|-----------|--------|
| Type | `datetime` (ISO) |
| Required | Yes |
| Owning module | Player Management |
| Current source | Inconsistent across stores |
| Future canonical source | Player profile `createdAt` |
| Writable in Phase 1 | System-set on create |
| Privacy | system |
| Legacy aliases | `created_at` |

### updatedAt

| Attribute | Value |
|-----------|--------|
| Type | `datetime` (ISO) |
| Required | Yes |
| Owning module | Player Management |
| Current source | Inconsistent across stores |
| Future canonical source | Player profile `updatedAt` |
| Writable in Phase 1 | System-set on update |
| Privacy | system |
| Legacy aliases | `updated_at` |

---

## Phase 1A note

This dictionary is a **contract**. Phase 1A does not persist new columns. Fields marked Missing remain Missing until Phase 1C+ additive work after 1B skeleton approval.
