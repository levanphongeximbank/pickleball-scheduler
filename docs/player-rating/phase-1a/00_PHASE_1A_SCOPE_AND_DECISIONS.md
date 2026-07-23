# 00 — Phase 1A Scope and Owner Architecture Decisions

**Workstream:** Player Rating
**Phase:** 1A — Architecture and Contract Freeze
**Authorization:** `AUTHORIZE_PLAYER_RATING_PHASE_1A_ARCHITECTURE_CONTRACT_FREEZE`
**Status:** Documentation freeze only — no runtime implementation
**Baseline HEAD (workstream):** `90b0691c97c2ce0451c358979e89fce4658fa488`
**Branch:** `feature/player-rating-phase-1-foundation`

---

## 1. Phase objective

Freeze documentation-level contracts for Player Rating ownership, identity, scale, SSOT matrix, current-state / history / snapshot semantics, events, ports, idempotency, reversal, security/privacy, legacy classifications, Competition Engine dependency gates, and explicit non-goals.

This phase does **not**:

* Implement runtime code, adapters, facades, producers, consumers, queues, or RPCs
* Create or edit SQL / migrations / Supabase configuration
* Select or implement a final match-result rating algorithm
* Convert, migrate, backfill, or change Production data
* Change any UI display scale
* Modify any neighboring module

---

## 2. Owner-approved architecture decisions (frozen)

### 2.1 Canonical player identity

| Decision | Contract |
|----------|----------|
| Canonical foreign key for Player Rating | `player_id` owned by **Player Management** |
| Identifier treatment | Opaque string — do **not** infer canonical identity from prefix or string format |
| Alias rule | Aliases must not independently become the Player Rating canonical FK |
| Resolver | Document `CanonicalPlayerIdResolverPort` only — **do not implement** in Phase 1A |

**Aliases (not independent Player Rating FKs):**

* `auth_user_id`
* `profiles.id`
* Club player ID (blob / roster)
* Competition participant ID
* Legacy blob player ID
* VPR athlete ID

**Format honesty (Owner):** Do **not** state that both `player-auth-{authUserId}` and `player-{uuid}` are simultaneous canonical formats for Player Rating foreign keys. Mint conventions remain owned and documented by Player Management; Player Rating consumes an opaque `player_id` after successful resolution.

Where repository evidence shows historical dual conventions or homonymous `player_id` columns, record an **open gate** rather than guessing. See `02_CANONICAL_PLAYER_ID_AND_ALIAS_RESOLUTION.md` and `08_EVIDENCE_INDEX_AND_OPEN_GATES.md`.

### 2.2 Canonical target rating scale

| Decision | Contract |
|----------|----------|
| Target public Player Rating scale | **1.5 to 6.0** |
| Scope of this decision | Documentation-level target contract only |
| Data / UI | No migration, conversion, backfill, Production change, or UI scale change in Phase 1A |
| Conversion formula | **Forbidden** in Phase 1A |

Scale classifications are frozen in `03_RATING_SCALE_AND_SSOT_MATRIX.md`.

### 2.3 Player Rating source of truth (target ownership)

There is currently **no single runtime Player Rating SSOT** proven by Production evidence.

**Target ownership — Player Rating domain owns:**

* Current rating state
* Self-assessed rating
* Provisional rating
* Verified rating
* Calculated rating
* Display rating projection
* Rating confidence
* Rating history
* Rating snapshots
* Verification workflow
* Manual adjustment
* Adjustment audit
* Result-to-rating processing
* Idempotency
* Rating update reversal

**Neighbor ownership (do not absorb):**

| Module | Owns |
|--------|------|
| Player Management | Canonical player identity and profile data |
| Competition Engine | Validated and invalidated match results |
| Ranking | Ranking points and standings (including VPR) |
| Club Management | Membership and club roles |

Do **not** declare an existing SQL table authoritative for Player Rating unless evidence proves it. Existing stores are classified under evidence-safe labels in `03_RATING_SCALE_AND_SSOT_MATRIX.md` and `06_LEGACY_MIRROR_AND_MIGRATION_NON_GOALS.md`.

---

## 3. Production-status language (mandatory)

Do **not** claim `PRODUCTION_ACTIVE` based only on source presence, SQL files, flags, tests, docs, or historical rollout notes without direct Production verification.

Allowed evidence-safe classifications:

* `CODE_PRESENT`
* `FLAG_GATED`
* `LEGACY_FALLBACK`
* `MOCK_ONLY`
* `LOCAL_ONLY`
* `DATABASE_DRAFT`
* `STAGING_EVIDENCE_PRESENT`
* `PRODUCTION_STATUS_UNVERIFIED`

Every significant repository conclusion in this phase set must cite exact path, symbol/table/RPC/flag, supporting reason, and remaining uncertainty (`08_EVIDENCE_INDEX_AND_OPEN_GATES.md`).

---

## 4. Explicit non-goals (Phase 1A)

1. Runtime Player Rating module cutover or rename
2. Final match-result rating algorithm selection
3. Scale conversion formulas or dual-write cutover
4. Implementing `CanonicalPlayerIdResolverPort` or any port adapter
5. Implementing event producers/consumers for rating events
6. Declaring Competition Engine event symbols as already shipped without evidence
7. Mixed doubles or team rating calculation semantics (open design gates only)
8. Staging or Production writes of any kind
9. Staging/committing/pushing/PRs (separate Owner authorization)

---

## 5. Document set

| File | Purpose |
|------|---------|
| `00_PHASE_1A_SCOPE_AND_DECISIONS.md` | Scope and Owner decisions |
| `01_MODULE_OWNERSHIP_AND_BOUNDARIES.md` | Ownership boundaries |
| `02_CANONICAL_PLAYER_ID_AND_ALIAS_RESOLUTION.md` | Identity + resolver contract |
| `03_RATING_SCALE_AND_SSOT_MATRIX.md` | Scales + SSOT matrix |
| `04_CURRENT_STATE_HISTORY_AND_SNAPSHOT_CONTRACTS.md` | State semantics |
| `05_EVENT_PORT_AND_IDEMPOTENCY_CONTRACTS.md` | Events, ports, idempotency |
| `06_LEGACY_MIRROR_AND_MIGRATION_NON_GOALS.md` | Legacy / mirror / shadow / mock |
| `07_SECURITY_PERMISSIONS_AND_PRIVACY_REQUIREMENTS.md` | Security requirements |
| `08_EVIDENCE_INDEX_AND_OPEN_GATES.md` | Evidence index + open gates |

---

## 6. Freeze statement

Phase 1A freezes **contracts and classifications** only. Implementation, algorithm selection, data migration, and Production claims require separate Owner authorization and evidence.
