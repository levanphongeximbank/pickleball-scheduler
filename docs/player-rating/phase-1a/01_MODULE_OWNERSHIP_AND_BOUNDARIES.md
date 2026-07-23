# 01 — Module Ownership and Boundaries

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official documentation freeze
**Neighbor read baseline:** `docs/player-management/phase-1a/01_MODULE_BOUNDARIES.md` (read-only reference)

---

## 1. Principle

Each concern has **one owner**. Neighbor modules may **read** or **reference** Player Rating projections. They must not redefine Player Rating current state, history, snapshots, verification, adjustments, or result-to-rating application as a second source of truth.

```text
Player Management  = canonical person identity + profile
Player Rating      = skill rating domain (target ownership below)
Competition Engine = validated / invalidated match results
Ranking            = ranking points / standings (VPR)
Club Management    = membership + club roles
Identity           = login / RBAC / session
```

---

## 2. Player Rating (this workstream)

**Workstream home:** `C:\Users\Le Phong\PICK_VN-Workstreams\player-rating`
**Target documentation ownership:** `docs/player-rating/`
**Existing related code surfaces (not declared Production SSOT):**

| Surface | Path | Classification |
|---------|------|----------------|
| Rating V5 feature | `src/features/pick-vn-rating-v5/` | `CODE_PRESENT` + `FLAG_GATED` |
| Pick_VN V2 feature | `src/features/pick-vn-rating/` | `CODE_PRESENT` + `LEGACY_FALLBACK` |
| Local assessment | `src/features/player-rating/` | `LOCAL_ONLY` |
| Competition Elo | `src/features/competition-core/rating/` | `CODE_PRESENT` + `FLAG_GATED` (Competition-owned calculation signal) |
| V5 docs / SQL artifacts | `docs/v5/rating-v5/` | `DATABASE_DRAFT` / `STAGING_EVIDENCE_PRESENT` / `PRODUCTION_STATUS_UNVERIFIED` |

### 2.1 Target owns

| Concern | Notes |
|---------|--------|
| Current rating state | Mutable through authorized domain operations only |
| Self-assessed rating | Player-initiated input path |
| Provisional rating | Intermediate trust level |
| Verified rating | Server-authoritative after authorized verification |
| Calculated rating | System-derived value after authorized processing |
| Display rating projection | Projection only — not independent SSOT |
| Rating confidence | Internal quality signal — not a rating value |
| Rating history | Append-only ledger |
| Rating snapshots | Immutable point-in-time records |
| Verification workflow | Authorized server-side actors |
| Manual adjustment + audit | Authorized server-side actors |
| Result-to-rating processing | Via ports; algorithm not selected in Phase 1A |
| Idempotency + reversal | Application identity contracts |

### 2.2 Must not own

| Concern | Owner |
|---------|-------|
| Canonical `player_id` minting / person SSOT | Player Management |
| Auth credentials / RBAC | Identity |
| Club membership edges / club roles | Club Management |
| Validated / invalidated match results | Competition Engine |
| Ranking points / standings / VPR awards | Ranking |
| Venue customer identity | Venue & Court / CRM |

### 2.3 Boundary rules

1. Player Rating stores **references** to opaque `player_id` after resolution — never invents person identity.
2. Ranking must **not** write Player Rating values.
3. Player Management must **not** write Player Rating values.
4. Competition Engine supplies match-result contracts; it does not become Player Rating SSOT.
5. Club Management may display rating projections; it does not own rating SSOT.
6. No client RPC becomes authoritative merely because it can upsert fields.

---

## 3. Neighbor modules (reference only)

### 3.1 Player Management

**Evidence home:** `src/features/player/`, `docs/player-management/phase-1a/`

Owns canonical player identity and profile data. Exposes resolution outcomes via `resolveCanonicalPlayerId` (`src/features/player/services/resolveCanonicalPlayerId.js`) — **CODE_PRESENT**. Player Rating Phase 1A documents a port contract that will consume this ownership; Phase 1A does not implement the port.

### 3.2 Competition Engine

**Evidence homes:** `src/features/competition-core/`, `docs/competition-engine/`, `docs/competition-core/`

Owns validated and invalidated match results. Required dependency event contracts for Player Rating:

* `MATCH_RESULT_VALIDATED`
* `MATCH_RESULT_INVALIDATED`

**Open gate:** Exact symbols `MATCH_RESULT_VALIDATED` / `MATCH_RESULT_INVALIDATED` are **not** present as shipped event type constants in the audited repository surfaces. Closest evidence includes competition result lifecycle terminology (`RESULT_FINALIZED`, etc. under `docs/competition-engine/core-07/`) and Competition Elo apply paths under `src/features/competition-core/rating/`. Player Rating Phase 1A freezes the **required dependency contract names**; Competition Engine publication of producers remains a dependency gate (`08_EVIDENCE_INDEX_AND_OPEN_GATES.md`).

### 3.3 Ranking

**Evidence home:** `src/features/vpr-ranking/`

Owns VPR points and standings. VPR is **not** Player Rating. Flags: `VITE_VPR_RANKING_ENABLED`, `VITE_VPR_CLOUD_SYNC` (`src/features/vpr-ranking/config/vprFlags.js`) — `FLAG_GATED`.

### 3.4 Club Management

**Evidence home:** `src/features/club/`

Owns membership and club roles. Club Elo (`clubEloService.js`, `DEFAULT_CLUB_ELO`) is club-scoped legacy/mirror calculation — not public Player Rating SSOT. Club Phase 2 docs treat Rating SoT as pending / excluded from Club ownership (`docs/club-phase2/READ_WRITE_OWNERSHIP.md`, `docs/club-phase2/CLUB_PHASE2_DOMAIN_FREEZE.md`).

### 3.5 Identity

Owns login, session, RBAC. `profiles.id` / `auth.users.id` are aliases relative to Player Rating FK — not the Player Rating canonical key.

---

## 4. Cross-module write matrix (target)

| Writer → Target | Player Rating current/history/snapshot | Allowed? |
|-----------------|----------------------------------------|----------|
| Player Rating domain (authorized server ops) | Yes | Required |
| Player (self-assessment initiation only) | Self-assessed input only | Yes (limited) |
| Player Management | No | Forbidden |
| Ranking | No | Forbidden |
| Club Management | No | Forbidden |
| Competition Engine | No direct rating write | Emits match-result events only |
| Client upsert of verified/calculated fields | No | Forbidden as authoritative |

---

## 5. Freeze statement

Module ownership in this document is the Player Rating Phase 1A boundary freeze. Neighbor module behavior must not change under this phase. Reading neighbors for interface verification is permitted; modifying them is forbidden.
