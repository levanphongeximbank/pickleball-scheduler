# 02 — Canonical Player ID and Alias Resolution

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official documentation freeze
**Implementation in this phase:** None

---

## 1. Owner decision (frozen)

| Item | Contract |
|------|----------|
| Canonical FK for Player Rating | `player_id` owned by **Player Management** |
| Treatment | **Opaque** identifier |
| Inference rule | Do **not** infer canonical identity from prefix or string format |
| Dual-format claim | Do **not** state that both `player-auth-{authUserId}` and `player-{uuid}` are simultaneous canonical formats for Player Rating FKs |

Player Management remains the sole owner of person minting conventions. Player Rating consumes a resolved opaque `player_id` and must not mint person IDs.

---

## 2. Alias inventory (must not become independent Player Rating FKs)

| Alias / legacy key | Evidence (path / symbol) | Classification vs Player Rating FK |
|--------------------|--------------------------|------------------------------------|
| `auth_user_id` | `docs/v5/PHASE_30_PICK_VN_PLAYER_RATING.sql` (`pick_vn_player_ratings`); Pick_VN V2 sync paths | Alias / legacy rating key |
| `profiles.id` / auth UUID | `docs/player-management/phase-1a/02_CANONICAL_PLAYER_ID_CONTRACT.md` §6 | Auth/profile UUID space — not Player Rating FK |
| `profiles.player_id` | Same contract §4; resolver uses as map | Bridge alias |
| Club player ID / blob `players[].id` | `docs/player-management/phase-1a/06_LEGACY_ID_AND_DATA_SOURCE_INVENTORY.md` | Legacy operational roster id |
| Competition participant ID | Competition `ParticipantReference` / competition-scoped ids | Competition-scoped — out of Player Rating FK |
| Legacy blob player ID | Club blob inventory | Legacy alias |
| VPR athlete ID | `vpr_athletes` / `vpr_athlete_links.player_id` (Ranking) | Ranking alias |
| Route aliases `profile-*`, `athlete-*` | `src/features/player/utils/playerId.js` (`isRouteAliasId`) | Not canonical |

### Homonym warning (open gate)

Rating V5 SQL historically keys a column named `player_id` to `profiles(id)` (see `docs/v5/rating-v5/PHASE_V5A_RATING_FOUNDATION.sql` and Player Management inventory notes). That column name is a **homonym** — not proof that Rating V5 already uses Player Management canonical `player_id`. Adapter alignment remains an open gate.

---

## 3. Evidence of Player Management ownership

| Finding | Path | Symbol | Classification | Why |
|---------|------|--------|----------------|-----|
| Boundary: Player owns person key | `docs/player-management/phase-1a/01_MODULE_BOUNDARIES.md` §2 | contract text | Docs + `CODE_PRESENT` module | Explicit ownership table |
| Canonical ID contract | `docs/player-management/phase-1a/02_CANONICAL_PLAYER_ID_CONTRACT.md` | `player_id` | Official PM Phase 1A | Mint + alias + outcomes |
| Public resolver | `src/features/player/services/resolveCanonicalPlayerId.js` | `resolveCanonicalPlayerId`, `parsePlayerReference` | `CODE_PRESENT` | Heterogeneous refs → outcomes |
| Outcomes | `src/features/player/constants/resolutionOutcomes.js` | `RESOLUTION_OUTCOME` | `CODE_PRESENT` | MAPPED / DERIVED / UNMAPPED / INVALID / AMBIGUOUS |
| ID helpers | `src/features/player/utils/playerId.js` | `buildAuthLinkedPlayerId`, `isAuthLinkedPlayerId`, … | `CODE_PRESENT` | Prefix helpers exist; Player Rating must still treat FK as opaque |
| Export surface | `src/features/player/index.js` | exports resolver | `CODE_PRESENT` | Public PM API |

**Uncertainty:** PM docs describe preferred mint conventions (`player-auth-…`, `player-…`). Player Rating Phase 1A **does not** elevate those string shapes into Rating FK format rules. Opacity wins.

---

## 4. Alias-to-canonical resolver contract (documentation only)

### 4.1 Port name

`CanonicalPlayerIdResolverPort`

### 4.2 Responsibility

Accept a heterogeneous player reference and return a resolution outcome with at most one selectable canonical `player_id` when mapped/derived unambiguously.

### 4.3 Required inputs (logical)

| Field | Notes |
|-------|-------|
| `reference` | Discriminated or loosely typed reference (`player_id`, `auth_user`, `athlete`, club/blob id, competition participant id, etc.) |
| `tenant_id` / scope | Fail closed if tenant cannot be resolved |
| Optional link loaders | Athlete→player, profile map, directory existence checks |

### 4.4 Required outcomes (align with PM contract)

| Outcome | Meaning | Usable as Player Rating FK? |
|---------|---------|------------------------------|
| `MAPPED` | Explicit accepted link to canonical `player_id` | Yes |
| `DERIVED` | Convention-based derivation accepted by PM policy | Yes only if PM policy accepts; Rating still stores opaque id |
| `UNMAPPED` | No resolvable canonical id | No |
| `INVALID` | Broken / malformed reference | No |
| `AMBIGUOUS` | Conflicting candidates | No until Owner/tooling merge |

### 4.5 Forbidden behaviors

1. Inventing a new person when UNMAPPED
2. Treating auth UUID, profiles.id, club blob id, participant id, or VPR athlete id as Player Rating FK without resolution
3. Inferring canonicity solely from string prefix inside Player Rating writes
4. Implementing this port in Phase 1A

### 4.6 Implementation status

| Item | Status |
|------|--------|
| PM runtime resolver | `CODE_PRESENT` (`resolveCanonicalPlayerId`) |
| Player Rating port adapter wrapping PM | **Not implemented** (Phase 1A docs only) |
| End-to-end Rating store keyed by opaque PM `player_id` | **Open gate** |

---

## 5. Open gates (identity)

1. **Adapter alignment:** Rating V5 (`profiles.id` homonym), Pick_VN V2 (`auth_user_id`), CC-02 text `player_id`, Club Elo blob ids, VPR athlete links — no single proven runtime FK alignment.
2. **Mint convention vs opacity:** PM documents preferred string conventions; Player Rating Owner decision requires opaque treatment for Rating FKs.
3. **Competition participant → player_id:** Must use Competition Engine reference contracts + resolver; do not invent collapse rules in Phase 1A.
4. **Production identity cutover completeness:** `PRODUCTION_STATUS_UNVERIFIED` for claiming all live rating rows already use PM canonical `player_id`.

---

## 6. Freeze statement

Canonical Player Rating identity is **opaque `player_id` owned by Player Management**. Alias resolution is a documented port contract only. No resolver implementation, backfill, or FK migration occurs in Phase 1A.
