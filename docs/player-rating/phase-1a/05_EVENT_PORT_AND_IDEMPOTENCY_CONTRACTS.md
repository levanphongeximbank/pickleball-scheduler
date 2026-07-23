# 05 — Event, Port, and Idempotency Contracts

**Phase:** 1A — Architecture and Contract Freeze
**Status:** Official documentation freeze
**Runtime producers/consumers/queues/RPCs/handlers:** Forbidden in Phase 1A
**Match-result rating algorithm behind ports:** Forbidden in Phase 1A

---

## 1. Common event envelope fields (logical)

Every event contract below must document, at minimum:

| Envelope field | Requirement |
|----------------|-------------|
| Owning module | Module that owns the event type definition |
| Producer | Intended producing capability (logical) |
| Intended consumers | Logical consumers |
| Required identifiers | e.g. `tenant_id`, `player_id`, `match_id`, `event_id` |
| Tenant / competition scope | Fail-closed resolution |
| Event revision | Monotonic or versioned revision of the event payload contract |
| Idempotency key | Stable key for at-most-once application side effects |
| Privacy classification | Public / internal / restricted |
| Before / after fields | Where the operation mutates rating state |
| Correlation | Link to originating operation / actor / command id |

`player_id` in these contracts is the opaque Player Management canonical id **after** resolution (see `02_…`).

---

## 2. Player Rating–owned event contracts

### 2.1 `PLAYER_RATING_SELF_ASSESSED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Player Rating self-assessment workflow (player-initiated) |
| Intended consumers | Rating current-state writer; history; optional notification |
| Required identifiers | `tenant_id`, `player_id`, `event_id`, `rating_mode` |
| Scope | Tenant-scoped; venue resolution fail-closed when required by policy |
| Event revision | `player-rating.event.self_assessed.v1` (documentation revision label) |
| Idempotency key | Stable per self-assessment submission identity (operation id / assessment id) |
| Privacy | Internal by default; public exposure only via approved display projection |
| Before / after | `before` optional; `after.self_assessed_rating` (+ status transition if any) |
| Correlation | Originating assessment operation id + actor = player |

### 2.2 `PLAYER_RATING_VERIFIED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Authorized server-side verification actor/workflow |
| Intended consumers | Current state; history; audit; display projection refresh |
| Required identifiers | `tenant_id`, `player_id`, `event_id`, `rating_mode`, `actor_id` |
| Scope | Tenant-scoped; fail-closed |
| Event revision | `player-rating.event.verified.v1` |
| Idempotency key | Verification decision id |
| Privacy | Restricted — verification evidence internal |
| Before / after | `before.verified_rating` / status; `after.verified_rating` / status |
| Correlation | Verification case / decision id |
| Trust rule | Must not be produced from untrusted client-supplied verified values |

### 2.3 `PLAYER_RATING_ADJUSTED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Authorized server-side manual adjustment |
| Intended consumers | Current state; history; adjustment audit |
| Required identifiers | `tenant_id`, `player_id`, `event_id`, `rating_mode`, `actor_id`, `reason` |
| Scope | Tenant-scoped; fail-closed |
| Event revision | `player-rating.event.adjusted.v1` |
| Idempotency key | Adjustment command id |
| Privacy | Restricted (reason + internal fields) |
| Before / after | Full before/after rating state fields relevant to adjustment |
| Correlation | Adjustment command id + audit record id |

### 2.4 `PLAYER_RATING_SNAPSHOT_CREATED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Snapshot creation operation |
| Intended consumers | Snapshot store; audit; optional consumers needing immutable views |
| Required identifiers | `tenant_id`, `player_id`, `snapshot_id`, `effective_at`, `rating_mode` |
| Scope | Tenant-scoped |
| Event revision | `player-rating.event.snapshot_created.v1` |
| Idempotency key | `snapshot_id` |
| Privacy | Follows snapshot payload classification (often internal) |
| Before / after | Snapshot payload is immutable copy; no “after mutation” of snapshot |
| Correlation | Originating operation that requested snapshot |

### 2.5 `RATING_UPDATE_REQUESTED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Result-to-rating orchestration after consuming validated match result (logical) |
| Intended consumers | `MatchResultRatingPort` application path |
| Required identifiers | Application identity fields (see §4): `tenant_id`, `match_id`, `result_revision`, `player_id`, `rating_type`, `algorithm_version` |
| Scope | Tenant + competition/match scope |
| Event revision | `player-rating.event.update_requested.v1` |
| Idempotency key | Rating application identity |
| Privacy | Internal |
| Before / after | Request only — before/after appear on applied/reversed |
| Correlation | Upstream `MATCH_RESULT_VALIDATED` event id / result revision |

### 2.6 `RATING_UPDATE_APPLIED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Successful authorized apply path |
| Intended consumers | Current state; history; idempotency ledger |
| Required identifiers | Full application identity + `application_id` |
| Scope | Tenant + match scope |
| Event revision | `player-rating.event.update_applied.v1` |
| Idempotency key | Same application identity — duplicate apply must no-op |
| Privacy | Internal; public only via display projection |
| Before / after | Required rating before/after |
| Correlation | `RATING_UPDATE_REQUESTED` + match result correlation |

### 2.7 `RATING_UPDATE_REVERSED`

| Field | Contract |
|-------|----------|
| Owning module | Player Rating |
| Producer | Separate reversal operation after prior apply (e.g. post-publication invalidation) |
| Intended consumers | Current state; history; idempotency / reversal ledger |
| Required identifiers | Original application identity + `reversal_id` + own reversal idempotency identity |
| Scope | Tenant + match scope |
| Event revision | `player-rating.event.update_reversed.v1` |
| Idempotency key | Reversal idempotency identity (distinct from application identity) |
| Privacy | Internal / restricted |
| Before / after | State before reversal and after reversal |
| Correlation | Original `RATING_UPDATE_APPLIED` + upstream `MATCH_RESULT_INVALIDATED` when applicable |

---

## 3. Competition Engine dependency events (external)

These events are **owned by Competition Engine**. Player Rating is an intended consumer only.

### 3.1 `MATCH_RESULT_VALIDATED`

| Field | Contract |
|-------|----------|
| Owning module | Competition Engine |
| Producer | Competition Engine result validation / finalization capability |
| Intended consumers | Player Rating result-to-rating orchestration; other competition consumers |
| Required identifiers | `tenant_id` (or equivalent competition tenant), `match_id`, `result_revision`, participant references resolvable to `player_id` |
| Scope | Competition / match scope |
| Event revision | To be published by Competition Engine (Player Rating documents dependency on named contract) |
| Idempotency key | Owned by Competition Engine for result validation |
| Privacy | Per Competition Engine policy; Player Rating treats as internal evidence |
| Before / after | Result validation semantics owned by Competition Engine |
| Correlation | Match result command / revision chain |

### 3.2 `MATCH_RESULT_INVALIDATED`

| Field | Contract |
|-------|----------|
| Owning module | Competition Engine |
| Producer | Competition Engine invalidation / supersede capability |
| Intended consumers | Player Rating reversal orchestration |
| Required identifiers | `tenant_id`, `match_id`, `result_revision` (invalidated or superseding revision), reason/code |
| Scope | Competition / match scope |
| Event revision | To be published by Competition Engine |
| Idempotency key | Owned by Competition Engine |
| Privacy | Internal / restricted |
| Before / after | Invalidation semantics owned by Competition Engine |
| Correlation | Prior validated result revision |

### 3.3 Dependency gate (evidence)

| Query | Result | Classification |
|-------|--------|----------------|
| Exact symbols `MATCH_RESULT_VALIDATED` / `MATCH_RESULT_INVALIDATED` in repo | **Not found** as shipped event type constants during Phase 1A audit | Open Competition Engine publication gate |
| Related lifecycle language | `RESULT_FINALIZED` and related codes under `docs/competition-engine/core-07/` | Docs evidence — not the same as the required Player Rating dependency event names |
| Competition Elo apply path | `src/features/competition-core/rating/` (`applyCompetitionEloFromMatchRecord`, idempotency store) | `CODE_PRESENT` + `FLAG_GATED`; Competition Elo signal — **not** Player Rating public SSOT |

Phase 1A freezes the **required dependency names and consumer expectations**. It does **not** invent Competition Engine producer implementations.

---

## 4. Idempotency and reversal contracts

### 4.1 Rating application identity (minimum)

Repeated processing of the same application identity must **not** apply rating more than once.

Required identity fields:

| Field | Purpose |
|-------|---------|
| `tenant_id` | Tenant isolation |
| `match_id` | Match scope |
| `result_revision` | Specific validated result revision |
| `player_id` | Opaque canonical player |
| `rating_type` | Rating dimension / type under Player Rating policy |
| `algorithm_version` | Calculation policy version |

### 4.2 Related evidence (not adopted as Player Rating Production SSOT)

Competition Core CC-02C documents a narrower key `(match_id, player_id, rating_type)` for Competition Elo durability (`docs/competition-core/CC02C_IDEMPOTENCY_DESIGN.md`; `ratingIdempotencyStore.js`) — `DATABASE_DRAFT` / `FLAG_GATED`. Player Rating Phase 1A requires the **richer** identity including `tenant_id`, `result_revision`, and `algorithm_version`.

### 4.3 Reversal rules (frozen)

1. Post-publication match invalidation requires a **separate reversal operation**.
2. A transaction rollback caused by a **failed apply** is **not** equivalent to reversing an already applied rating update.
3. A reversal must reference the **original application identity**.
4. A reversal must have its **own idempotency identity**.
5. Duplicate reversal with the same reversal identity must not reverse twice.

### 4.4 Non-implementation clause

Do not implement database constraints or runtime stores for these identities in Phase 1A.

---

## 5. Port contracts (interfaces only)

| Port | Responsibility | Phase 1A |
|------|----------------|----------|
| `CanonicalPlayerIdResolverPort` | Alias → opaque canonical `player_id` outcomes | Interface docs only |
| `RatingCurrentStatePort` | Read/write authorized current state | Interface docs only |
| `RatingHistoryPort` | Append-only history writes + reads | Interface docs only |
| `RatingSnapshotPort` | Create/read immutable snapshots | Interface docs only |
| `RatingVerificationPort` | Verification workflow operations | Interface docs only |
| `RatingAdjustmentAuditPort` | Persist adjustment audit (actor, reason, before, after, timestamp, scope, correlation id) | Interface docs only |
| `MatchResultRatingPort` | Apply/reverse rating effects from match-result applications | **Interface only** — **no algorithm** behind it in Phase 1A |

### `MatchResultRatingPort` constraints

* May accept application identity + validated result evidence references.
* Must support idempotent apply and separate reverse operations at the contract level.
* Must **not** select or embed a final rating algorithm in Phase 1A.

---

## 6. Freeze statement

Event names, envelope requirements, port interfaces, application identity, and reversal semantics are frozen as documentation contracts. No producers, consumers, adapters, algorithms, or stores are authorized in Phase 1A.
