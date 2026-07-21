# CORE-06 Phase 1F — Adapter, Integration Readiness & Certification

**Status:** Capability-local certification (dormant)  
**Prerequisite:** Phase 1E merged  
**Production impact:** NONE — no TT V6 changes, SQL, RPC, UI, flags, dual-write, or cutover

## Important distinction

**CORE-06 capability completion does not mean Team Tournament V6 has been replaced.**

Certification axes are independent:

| Axis | Meaning | Current Phase 1F |
|------|---------|------------------|
| `capabilityReadiness` | CORE-06 contracts/services are sound | PASS |
| `adapterImplementationReadiness` | Ready for a future format adapter to be built | PASS |
| `shadowReadiness` | Shadow compare + known differences governed | PASS_WITH_KNOWN_DIFFERENCES |
| `writerCutoverReadiness` | Canonical writer may replace TT writes | **BLOCKED_PENDING_RNG_DECISION** |
| `legacyRetirementReadiness` | TT lineup core may be retired | **BLOCKED** |
| `productionWiring` | App/SQL/RPC/flags wired | **NOT_PERFORMED** |

`CERTIFIED_FOR_ADAPTER_IMPLEMENTATION` is **not** `READY_FOR_CANONICAL_WRITER_CUTOVER`.

## Objective

Certify CORE-06 as ready for future format adapters and controlled integration by defining:

- canonical `LineupFormatAdapter` boundary
- Team Tournament V6 compatibility mapping (documentary + fixture mappers)
- persistence transaction contract (no Production storage)
- shadow comparison contract (test/docs only)
- parity scenarios + certification report
- cutover / rollback plans (documentary)

## Scope

**In scope:** `src/features/competition-core/lineups/**`, Phase 1F tests, this document.  
**Out of scope:** Production wiring, TT runtime modification, SQL/migrations/RPC/UI/flags/deploy.

## Adapter boundary

```text
Competition Format Adapter (future)
        ↓
CORE-06 canonical public API (contracts / services)
        ↓
CORE-06 ports
        ↓
future infrastructure implementation
```

Forbidden: CORE-06 canonical API → Team Tournament fixture or runtime.

Port: `LineupFormatAdapter` (`LINEUP_FORMAT_ADAPTER_KIND`)

Methods: `resolveAggregateIdentity`, `mapCreate/Submit/Lock/Publish/Correction/RandomFallbackCommand`, `mapVisibility/Deadline/Hardening/Actor/Idempotency/ExpectedVersion`, `mapCanonicalResultToFormat`.

## Public vs internal API

### CANONICAL_PUBLIC_API (`lineups/index.js`)

- Generic format-adapter contract (`isLineupFormatAdapter`, mapping result helpers)
- Generic persistence **transaction contract** (`matchesLineupPersistenceTransactionPort`, guarantees)
- Generic shadow classification + `compareLineupShadowResults`
- Certification report contract + `certifyCore06Phase1F`
- Accepted-difference allowlist (`LINEUP_ACCEPTED_DIFFERENCE_*`)
- Phase 1C–1E domain surfaces (visibility, deadline, concurrency, random, etc.)
- Legacy resolve adapter (Phase 3E)

### FORMAT_INTEGRATION_API (`lineups/integration/index.js`)

- `TT_CORE06_COMPATIBILITY_MATRIX` / `findCompatibilityRow`
- `mapTeamTournamentLineupInputToCanonical`
- `mapCanonicalLineupResultToTeamTournament`

### TEST_ONLY (`lineups/integration/index.js`)

- `createFixtureLineupFormatAdapter` — fixture double, **not** Production adapter
- `createInMemoryLineupPersistenceTransactionPort` (`LINEUP_PERSISTENCE_TX_IMPL_KIND = TEST_ONLY_IN_MEMORY`)
- `LINEUP_PARITY_SCENARIOS` / `summarizeParityCatalog` / `validateParityCatalog`

Production code must not import fixture doubles as the canonical implementation.

## Team Tournament compatibility matrix

See `adapters/teamTournamentCompatibility.js` (`TT_CORE06_COMPATIBILITY_MATRIX`).

Classifications used: `exact_match` | `transform_required` | `missing_legacy_field` | `legacy_only_field` | `canonical_only_field` | `deferred_persistence`.

Notable:

| Concept | Classification |
|---------|----------------|
| teamId | exact_match |
| tournamentId → competitionId | transform_required |
| matchupId → contextId | transform_required |
| publish vs visibilityState | transform / canonical_only |
| canSaveDraft flags | legacy_only |
| commandFingerprint | canonical_only |
| audit persistence | deferred_persistence |

## Input mapping

`mapTeamTournamentLineupInputToCanonical(fixture)` via **integration** path:

- Requires explicit `tenantId` (never first tenant/venue/club; never from role alone)
- Requires competitionId/tournamentId, teamId, contextId/matchupId, evaluatedAt
- Deterministic identity; rejects conflicting identityKey
- Maps status via frozen `LEGACY_LINEUP_STATUS_MAP`
- Does **not** infer reveal from SUBMITTED/LOCKED
- Does **not** infer correction authorization
- Does **not** synthesize expectedVersion
- Typed mapping failure when tenant/scope absent

## Output mapping

`mapCanonicalLineupResultToTeamTournament(result)` via **integration** path:

- Preserves revision, lifecycle, visibilityState, revealEligible, mutationPhase, revealPhase separately
- `revealEligible` never auto-changes visibility
- Selections omitted unless explicitly authorized
- Fingerprints omitted unless `exposeFingerprints`
- Documents `CANONICAL_FIELDS_NOT_IN_LEGACY`

## Accepted-difference governance

Only allowlisted codes in `LINEUP_ACCEPTED_DIFFERENCE_CODE` may produce `ACCEPTED_DIFFERENCE`.

Caller free-text labels → `BLOCKING_DIFFERENCE`.  
Unknown codes on catalog rows → catalog validation failure / blocking.  
Missing observations → `INSUFFICIENT_DATA`.

Eight allowlisted codes (see `contracts/acceptedDifferences.js` registry for full governance metadata):

1. `DIFF_GRACE_POLICY_INJECTION`
2. `DIFF_REVEAL_VS_PUBLISH_DIMENSIONS`
3. `DIFF_OFFICIALS_VISIBILITY_MATRIX`
4. `DIFF_PUBLIC_VISIBILITY_ENUM`
5. `DIFF_CORRECTION_DEFAULT_DENY`
6. `DIFF_RNG_SEMANTIC_ONLY` — **blocks writer cutover**
7. `DIFF_TENANT_EXPLICIT_REQUIRED`
8. `DIFF_CANONICAL_FINGERPRINT_ABSENT`

## RNG parity classification

| Question | Answer |
|----------|--------|
| Parity class | **SEMANTIC_ONLY** (not exact bit-parity) |
| Same seed → same assignments across engines? | **Not guaranteed** |
| Legacy algorithm id/version represented? | **No** (null in cert details) |
| Canonical algorithm id/version? | Yes (`LINEUP_RANDOM_ALGORITHM`) |
| Replay across engines? | **No** without a compatibility adapter |
| Existing published lineups reproducible on cutover? | **Not guaranteed** without Owner decision |
| Compatibility RNG adapter required for cutover? | **Owner decision** (likely yes for assignment continuity) |
| Owner approval to change assignments? | **Required** |

`writerCutoverReadiness: BLOCKED_PENDING_RNG_DECISION` while this remains unresolved.

## Persistence transaction contract

Port methods: `loadForUpdate`, `lookupIdempotency`, `claimIdempotency`, `completeIdempotency`, `releaseIdempotency`, `commitCommand`.

Guarantees (`LINEUP_PERSISTENCE_GUARANTEES`): unique idempotency identity; CAS/row lock; no partial audit; no version bump without result; no idempotency completion without aggregate commit; replay-safe retrieval.

In-memory double: `createInMemoryLineupPersistenceTransactionPort()` — **TEST_ONLY** (integration path).

## Shadow readiness

`compareLineupShadowResults({ legacy, canonical, accepted, unauthorizedViewer })`  
Classifications: MATCH | ACCEPTED_DIFFERENCE | BLOCKING_DIFFERENCE | INSUFFICIENT_DATA  

- No writes / no Production services / no tenant fetch / no RNG
- Unauthorized viewer skips hidden selection dimensions
- Deterministic comparison reports

## Parity scenarios

25 catalog scenarios in `certification/parityScenarios.js` (P1–P25).  
`validateParityCatalog` rejects empty catalogs, duplicate IDs, and unknown accepted codes.  
`certifyCore06Phase1F` totals come from `summarizeParityCatalog` (not hard-coded).

## Cutover stages (documentary — none activated)

| Stage | Name | Entry | Exit | Rollback |
|-------|------|-------|------|----------|
| 0 | Core-only certification | Phase 1F PASS | Owner approval | N/A |
| 1 | TT adapter implementation | Stage 0 | Adapter tests green | Discard adapter branch |
| 2 | Test fixture parity | Stage 1 | No blocking diffs | Revert fixtures |
| 3 | Staging read-only shadow | Stage 2 | Shadow MATCH/ACCEPTED only | Disable shadow job |
| 4 | Staging controlled write pilot | Stage 3 + RNG decision | Pilot tenants OK | Flag off; restore TT writer |
| 5 | Production tenant-scoped shadow | Stage 4 | Observability green | Disable shadow |
| 6 | Feature-flagged canonical writer | Stage 5 + RNG decision | Canary OK | Flag off immediately |
| 7 | Canonical SoT | Stage 6 | Owner cutover approval | Dual-read fallback |
| 8 | Legacy writer retirement | Stage 7 | No TT writes | Re-enable TT writer |
| 9 | Legacy core logic removal | Stage 8 | Dead code gone | Restore from tag |

Every stage requires: observability, data consistency check, **owner approval**, frozen cutover window for write stages.

## Rollback requirements

- No irreversible schema dependency before cutover approval
- Legacy read compatibility maintained through Stage 7
- Canonical→legacy result reconstruction via output mapper
- Version + idempotency reconciliation procedures
- Audit continuity (append-only; no rewrite)
- Feature-flag rollback; tenant-scoped rollback
- No mixed writer ownership
- Post-rollback verification checklist

## Security boundaries

- Adapter cannot authorize by role name alone
- Tenant + competition scopes mandatory
- Team relationship scope-validated
- Hidden projection fail closed
- Deadlines use injected timestamps
- Correction denied by default
- expectedVersion never silently synthesized
- Idempotency context requires aggregate identity
- Audit excludes secrets / hidden lineup contents
- No Production credentials / TT deep imports

## Known gaps / deferred Production work

- Real TT adapter implementation (Stage 1)
- SQL schema / RPC for atomic persistence
- Shadow job / feature flags / dual-write
- Production audit table mapping
- Exact TT RNG bit-parity / compatibility RNG adapter (Owner decision before writer cutover)

## Final certification criteria

`certifyCore06Phase1F()` returns `CERTIFIED_FOR_ADAPTER_IMPLEMENTATION` when:

- capability axes PASS
- parity catalog has **zero blocking** differences
- catalog validation OK (non-empty, unique IDs, allowlisted accepted codes)
- **and** writer/legacy retirement remain explicitly BLOCKED until Owner decisions
