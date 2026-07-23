# 04 — Current State, History, and Snapshot Contracts

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official documentation freeze
**Implementation:** None in Phase 1A

---

## 1. Conceptual fields (logical current-state contract)

These definitions are documentation contracts. They do not invent a Production table schema.

| Field | Definition | Rules |
|-------|------------|-------|
| `self_assessed_rating` | Rating value claimed or produced via player-initiated self-assessment input | May be initiated by the player; not automatically `verified_rating` |
| `provisional_rating` | Rating accepted at provisional trust level pending further evidence/verification | Mutable via authorized domain ops; not public verification by itself |
| `verified_rating` | Rating accepted after authorized server-side verification workflow | Must **not** be trusted directly from a client payload |
| `calculated_rating` | System-derived rating after authorized calculation / result processing | Algorithm selection deferred; Competition Elo is **not** automatically this public value |
| `display_rating` | Projection prepared for presentation | **Not** an independent SSOT; derived from authorized state |
| `confidence` | Internal quality / reliability signal | **Not** a rating value; not publicly exposed by default |
| `rating_mode` | Mode dimension for rating state | Supported documentation modes: `overall`, `singles`, `doubles` |
| `status` | Lifecycle / trust status of current state (e.g. draft / provisional / verified / under_review — exact enum freeze deferred) | Mutable only via authorized ops |
| `effective_at` | Instant from which a state or snapshot is considered effective | Required on snapshots; meaningful for history correlation |
| `source` | Provenance classification of the latest authoritative transition | Must correlate to originating operation / event |
| `algorithm_version` | Version identity of calculation/verification policy used when calculated | Required for calculated applications and reversals |
| `last_event_id` | Correlation to the last applied domain event affecting current state | Supports audit and idempotent replay detection |

---

## 2. Mutability rules (frozen)

| Store class | Mutability | Rule |
|-------------|------------|------|
| Current state | **Mutable** | Only through authorized domain operations |
| History | **Append-only** | Never rewrite past history rows in place |
| Snapshot | **Immutable** | A snapshot does not change when current rating changes |
| Display rating | Projection | Recalculated/projected from current state; not separately authoritative |

### Snapshot-specific rules

1. A snapshot records `effective_at`.
2. A snapshot is immutable after creation.
3. Current-state mutation must not mutate prior snapshots.
4. Snapshot creation is a distinct domain operation (see event `PLAYER_RATING_SNAPSHOT_CREATED`).

### Display and confidence rules

1. `display_rating` is a projection, not an independent source of truth.
2. `confidence` is not a rating value and must not be treated as one in public APIs by default.
3. Competition Elo (~1500 scale) is not automatically the public Player Rating.

### Trust rules

1. Verified values cannot be trusted directly from a client.
2. Client-provided verified / calculated / confidence fields must be rejected as authoritative inputs.
3. Evidence: V5 `FORBIDDEN_CLIENT_RATING_FIELDS` in `src/features/pick-vn-rating-v5/security/forbiddenClientFields.js` (`CODE_PRESENT`); ADR-001 server-authoritative rating (`docs/v5/rating-v5/adr/ADR-001-server-authoritative-rating.md`). Legacy V2 `pick_vn_sync_rating` client-trust risk remains classified `LEGACY_FALLBACK` / open hardening gate.

---

## 3. Supported rating modes (documentation)

| Mode | Phase 1A status |
|------|-----------------|
| `overall` | Supported for documentation of current-state contracts |
| `singles` | Supported for documentation of current-state contracts |
| `doubles` | Supported for documentation of current-state contracts |
| Mixed doubles | **Open design gate** — do not invent calculation semantics |
| Team rating | **Open design gate** — do not invent calculation semantics |

Evidence note: V5 assessment surfaces historically emphasize doubles assessment paths (`src/features/pick-vn-rating-v5/` — e.g. access service selecting `"doubles"`). That is `CODE_PRESENT` behavior for an existing gated feature, not a Phase 1A claim that all modes are Production-complete (`PRODUCTION_STATUS_UNVERIFIED` / `FLAG_GATED`).

---

## 4. Logical relationships

```text
authorized operation
        │
        ├─► mutate current state (self_assessed / provisional / verified / calculated / status / …)
        ├─► append history row (immutable ledger entry)
        └─► optionally create snapshot (immutable, effective_at frozen)

display_rating  ◄── projection ──  current state
confidence      ◄── internal signal (not public by default)
```

---

## 5. Non-goals for this document

* Physical SQL schema design or migration
* Exact status enum freeze beyond conceptual requirements
* Match-result algorithm that produces `calculated_rating`
* Mixed doubles / team calculation rules

---

## 6. Freeze statement

Current-state, history, and snapshot semantics above are frozen as documentation contracts. Runtime stores and algorithms remain out of Phase 1A scope.
