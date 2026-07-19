# 02 — Canonical Player ID Contract

**Phase:** 1A — Contract Freeze  
**Status:** Official  
**Baseline:** Phase 1 Read-Only Audit + PR-4.25 identity mapping policy

---

## 1. Purpose

Define the **one** official player person key for PICK_VN, how it is minted, how aliases resolve, and how linking accounts must behave.

---

## 2. Official decision

| Item | Contract |
|------|----------|
| Canonical key name | `player_id` |
| Type | `string` (text), never confused with bare auth UUID without prefix rules |
| Auth-linked preferred convention | `player-auth-{authUserId}` |
| Non-auth convention | `player-{uuid}` |
| Cardinality intent | One person → one canonical `player_id` |
| Multi-club presence | Same `player_id` referenced from many membership edges |

**Do not create another independent player identity store.**

---

## 3. Minting rules

### 3.1 Auth-linked player (preferred)

When a login account exists and a player profile is created or linked for that account:

```text
player_id = "player-auth-" + authUserId
```

Where `authUserId` is `auth.users.id` / `profiles.id` (UUID string).

Implementation reference (existing convention, not Phase 1A code change):

- `buildDerivedAuthPlayerId(authUserId)` in `src/features/club/repositories/canonicalRepositoryTypes.js`

### 3.2 Non-auth player

When a person exists without a login account (guest / imported / club-only athlete):

```text
player_id = "player-" + uuid
```

Later account linking **updates aliases / links only** — it must **not** mint a second person profile.

### 3.3 Linking rule (critical)

| Action | Required behavior |
|--------|-------------------|
| Link account to existing non-auth player | Keep existing `player_id`; set `authUserId`; add alias; optionally set `profiles.player_id` to the **existing** id |
| Create auth user first, then player | Prefer mint `player-auth-{authUserId}` once |
| Discover duplicate candidates | Resolve to **AMBIGUOUS** until Owner/tooling merges — never silently create a second profile |

---

## 4. Alias and legacy reference rule

The following are **aliases or legacy references to the same person**, not separate people:

| Identifier | Classification |
|------------|----------------|
| `profiles.player_id` | Explicit alias / bridge (preferred mapped link) |
| `athletes.id` | Cloud person UUID alias (Phase 42) |
| `club_data_v3.data.players[].id` | Legacy operational roster id |
| Rating keys (`auth_user_id`, V5 `player_id`→profiles.id, CC-02 text `player_id`) | Rating references / legacy keys |
| Ranking `vpr_athletes.id` + `vpr_athlete_links.player_id` | Ranking references / aliases |
| Route ids `profile-{authUserId}`, `athlete-{athleteId}` | UI/route aliases — **not** canonical `player_id` |

---

## 5. Resolution outcomes

Official outcomes for profile / directory resolution:

| Outcome | Meaning | Selectable as mapped player? |
|---------|---------|------------------------------|
| **MAPPED** | Explicit accepted link exists (typically `profiles.player_id` set and valid) | Yes |
| **DERIVED** | No explicit map, but `player-auth-{authUserId}` convention resolves to an existing directory/profile row | Yes (with warning context) |
| **UNMAPPED** | Membership/account exists without resolvable player id | No |
| **INVALID** | Explicit map points to a missing / rejected player when existence is required | No |
| **AMBIGUOUS** | Multiple conflicting candidate `player_id` values for one person/account (e.g. distinct blob ids + conflicting maps) | No until resolved |

### Policy priority (auth member → player)

1. If `profiles.player_id` present and accepted → **MAPPED**  
2. Else if `player-auth-{authUserId}` exists in directory → **DERIVED**  
3. Else if ≥2 conflicting candidates → **AMBIGUOUS**  
4. Else if explicit map is broken → **INVALID**  
5. Else → **UNMAPPED**

Notes:

- Current runtime (`MAPPING_STATUS`) implements MAPPED / DERIVED / UNMAPPED / INVALID.  
- **AMBIGUOUS** is added officially in Phase 1A for contract completeness; Phase 1B+ must surface it in resolution APIs/tests.  
- Cloud-only clubs may trust `profiles.player_id` as MAPPED without a blob row (synthetic directory hit) — **no silent create**.

---

## 6. Non-interchangeable ID spaces

Never treat these as the same string space without an adapter:

| Space | Example |
|-------|---------|
| Auth / profile UUID | `4cf24ed0-...` |
| Canonical player id | `player-auth-4cf24ed0-...` |
| Route profile id | `profile-4cf24ed0-...` |
| Route athlete id | `athlete-{athletes.id}` |
| Athlete UUID | bare `athletes.id` |
| Blob player id | unprefixed club blob id |
| VPR athlete UUID | `vpr_athletes.id` |
| Competition participant id | competition-scoped id |

Competition Engine continues to use discriminated `ParticipantReference.kind` — Player Management does not collapse those kinds in Phase 1A.

---

## 7. Supported personas

| Persona | Has login? | Canonical `player_id` | Notes |
|---------|------------|------------------------|-------|
| Auth-linked athlete | Yes | Prefer `player-auth-{authUserId}` | May also have `athletes.id` alias |
| Club-only blob athlete | No (or unlinked) | Existing blob id **or** migrate to `player-{uuid}` under later rules | Alias until migration |
| Guest competitor | No | `player-{uuid}` or competition `guest` kind | Competition may use guest reference without full profile |
| Account without player | Yes | None yet → **UNMAPPED** | Do not invent silently |

---

## 8. Forbidden behaviors

1. Creating a second player profile when linking an account to an existing player  
2. Storing auth UUID into competition `primary_player_id` / domain player slots without adapter  
3. Treating venue `customer.id` as `player_id`  
4. Treating RBAC role `CUSTOMER` as a player entity  
5. Silent auto-create of blob/player rows solely to clear UNMAPPED during Phase 1A/1B  
6. Equating Rating V5 `player_id` (= `profiles.id` today) with canonical `player_id` without an adapter  

---

## 9. Phase 1A freeze statement

This contract is **documentation-only**. Runtime continues to use existing repositories until Phase 1B introduces the Player Management facade that implements these rules behind a single API surface.
