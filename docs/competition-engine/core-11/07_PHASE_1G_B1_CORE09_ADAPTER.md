# CORE-11 Phase 1G-B1 — CORE-09 MatchPlan Adapter

## Audit decision

Phase 1G-A recommended **Path A — CORE-09 only**.

This phase implements the downstream-owned adapter:

```text
public CORE-09 MatchPlan + explicit SchedulePolicyBundle
        → canonical CORE-11 ScheduleRequest
```

**Not in scope:** CORE-10 optimizer adapter (Phase 1G-B2 deferred), UI, persistence, Production cutover.

### Current CORE-10 status (workspace truth)

`src/features/competition-core/optimizer/` exists as **public-contract substrate** (`CORE_10_PUBLIC_CONTRACT_ONLY`). It does **not** provide schedule-candidate evaluation orchestration. Phase 1A’s earlier “CORE-10 absent” wording reflected a prior repository state and is not rewritten here.

---

## Consumed CORE-09 public surface

Imports **only** from:

`src/features/competition-core/match-generation/index.js`

Used symbols include:

- `assertMatchPlanValid`
- `fingerprintMatchPlan`
- `isMatchGenerationStrategy`
- `MATCH_GENERATOR_IDENTITY`
- `MATCH_GENERATION_SCHEMA_VERSION`
- `MATCH_DEPENDENCY_TYPE`
- `PARTICIPANT_SLOT_KIND`

No private CORE-09 paths are imported.

Schema / identity: `core09.match-generation.v1` / `CORE09_MATCH_GENERATOR`.

---

## Public adapter API

```js
createScheduleRequestFromMatchPlan(matchPlan, schedulePolicyBundle)
```

Result status: `MATCH_PLAN_TO_SCHEDULE_REQUEST_RESULT`

```js
{
  ok: boolean,
  status: "MATCH_PLAN_TO_SCHEDULE_REQUEST_RESULT",
  scheduleRequest: object | null, // null when ok === false
  diagnostics: [],
  mappingSummary: {
    sourceMatchCount,
    mappedMatchCount,
    byeMatchCount,
    dependencyCount,
    concreteParticipantCount,
    placeholderParticipantCount
  },
  replay: {
    sourceEngineId,
    sourceEngineVersion,
    sourceSchemaVersion,
    matchPlanFingerprint,
    scheduleRequestFingerprint? // when ok
  }
}
```

No timestamps in semantic output. No input mutation. No random IDs.

---

## MatchPlan fingerprint (Condition 1)

Public CORE-09 signature:

```js
fingerprintMatchPlan(plan, extras = {})
// returns string
// extras.strategy / extras.generationStrategy optional (default "")
// extras.deterministicOrderingInputs optional (default [])
```

Adapter rules:

1. Calls **only** public `fingerprintMatchPlan` (never private fingerprint helpers).
2. Never uses raw `metadata.phase1c.strategy` as the fingerprint value.
3. When a strategy is present in MatchPlan metadata, validates it with public `isMatchGenerationStrategy` before use; invalid → fail closed.
4. When strategy is absent, omits it so the public contract’s empty-string default applies.
5. Prefer existing `generationFingerprint` **only** when it equals the freshly computed public fingerprint.
6. On mismatch → fail closed with structured `MATCH_PLAN_INVALID` (`path: generationFingerprint`, `details.upstreamCode: GENERATION_FINGERPRINT_MISMATCH`).
7. Replay stores the fingerprint as **replay metadata only** (not identity, request fingerprint, dependency identity, or hard-constraint evidence).
8. Fingerprinting does not mutate the MatchPlan; ordering/label/time/random independence follows CORE-09 canonicalize rules.

---

## SchedulePolicyBundle

Required explicit inputs:

| Field | Rule |
|-------|------|
| `timezone` | Valid IANA |
| `operatingWindows` | Array; non-empty when runnable non-bye matches exist |
| `sessionWindows` | Explicit array (empty allowed) |
| `defaultDurationMinutes` | Positive integer |
| `bufferMinutes` | Non-negative integer — **capacity occupancy** intent |
| `dependencyBufferMinutes` | Non-negative integer — **dependency earliest-start** intent; must equal `bufferMinutes` |
| `minParticipantRestMinutes` | Non-negative integer |
| `maxConcurrentMatches` | Positive integer |

Optional:

- `durationByStage`, `durationByRound`, `minTeamRestMinutes`
- `identityByParticipantId`, `placementIdentityByRef`, `defaultDirectParticipantKind`
- `estimatedDurationByMatchId`, `priorityByMatchId`
- `competitionId` (must match MatchPlan when set)

**No hidden defaults** for timezone, windows, capacity, rest, or resource identity.

### Buffer semantics — Outcome B (shared canonical field)

CORE-11 currently exposes **one** canonical buffer: `policy.duration.bufferMinutes`.

That single field is used for:

- abstract-lane **capacity occupancy** (Phase 1E/1F), and
- dependency **earliest-start** calculations (Phase 1D readiness / baseline).

There is **no** separate canonical `dependencyBufferMinutes` on `ScheduleRequest`.

Therefore the adapter:

1. Requires both `bufferMinutes` and `dependencyBufferMinutes` as explicit inputs.
2. Requires them to be **equal**.
3. Fails closed on divergence with stable `SCHEDULE_POLICY_BUFFER_CONFLICT`.
4. Maps the agreed value once into `policy.duration.bufferMinutes`.
5. Does **not** emit two independent buffer fields on the request.
6. Documents that divergent capacity vs dependency buffer policies **cannot** be represented on the current CORE-11 contract.

---

## Identity enrichment

`DIRECT_PARTICIPANT` kind resolution order:

1. `identityByParticipantId[id].kind`
2. `defaultDirectParticipantKind`

Enrichment may include `teamId` and ASCII-sorted deduped `constraintResourceIds`.

Missing kind or missing participant ID → fail closed (`MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING` / `IDENTITY_ENRICHMENT_INVALID`).

Display names / labels / scores never control identity.

---

## Placement enrichment

`UNRESOLVED_PLACEMENT` / `DRAW_PLACEMENT` resolve only via `placementIdentityByRef`.

Without enrichment → `PLACEMENT_IDENTITY_MISSING`.

Never invent `PREVIOUS_ROUND`, `QUALIFICATION`, or `GROUP_STAGE_COMPLETE`.

---

## Field mapping

| CORE-09 | CORE-11 |
|---------|---------|
| `logicalMatchKey` | `matchId` |
| `competitionId` | `competitionId` |
| `divisionId` | `divisionId` |
| `stageId` / `roundNumber` | same |
| `deterministicOrder` else `matchNumber` | `sequence` |
| `priorityByMatchId` only | `priority` |
| `estimatedDurationByMatchId` only | `estimatedDurationMinutes` |
| `isByeMatch` | `isBye` |
| `WINNER_OF` / `LOSER_OF` slots | PLACEHOLDER token + dependency |
| Direct / placement concrete | PLAYER/TEAM/ENTRY participant |

---

## Dependency orientation

Canonical CORE-11 edge: **source → dependent**, stored on the dependent match.

Built from dependent `participantSlot*` and `dependencyInputs`.

`winnerTo` / `loserTo` are consistency evidence only — never sole synthesis source.

Duplicates normalize; unknown/self/contradictory/outgoing mismatch fail closed.

---

## Validation sequence

1. Resolve optional strategy; validate against public CORE-09 strategy contract when present
2. Public `fingerprintMatchPlan` + existing fingerprint verify/prefer
3. Public CORE-09 `assertMatchPlanValid`
4. Explicit policy / enrichment validation (shared-buffer Outcome B)
5. Canonical match / participant / dependency mapping
6. `createScheduleRequest`
7. `validateScheduleRequest`
8. Deterministic result

Does not invoke Phase 1E repair or Phase 1F as a validation cover. Focused tests may optionally feed mapped requests into 1D/1E/1F as integration assertions.

---

## Diagnostics

Added adapter-owned codes:

- `MATCH_PLAN_INVALID`
- `MATCH_PLAN_FIELD_MISSING`
- `MATCH_PLAN_PARTICIPANT_IDENTITY_MISSING`
- `MATCH_PLAN_DEPENDENCY_UNSUPPORTED`
- `MATCH_PLAN_DEPENDENCY_INCONSISTENT`
- `SCHEDULE_POLICY_MISSING`
- `SCHEDULE_POLICY_BUFFER_CONFLICT`
- `IDENTITY_ENRICHMENT_INVALID`
- `PLACEMENT_IDENTITY_MISSING`

Upstream CORE-09 issues are preserved under `MATCH_PLAN_INVALID` with `details.upstreamCode`.

---

## Determinism

Input-order-independent mapping for matches, identity maps, resources, dependencies, diagnostics, and mapping summary. ASCII/`code-point` ordering only. No `Date.now`, `Math.random`, random UUID, or `localeCompare`.

---

## Boundary exception (Phase 1B–1E tests)

CORE-09 public imports are forbidden everywhere in CORE-11 **except** under:

```text
schedule-engine/adapters/**
```

Adapters may import only `match-generation/index.js`. Private CORE-09 paths remain forbidden. CORE-10 / CORE-12 / CC-09 remain forbidden everywhere. Path checks accept Windows and POSIX separators (`schedule-engine[\\/]+adapters[\\/]`).

---

## Test traceability (scenarios 1–81)

| Scenarios | Test name | Assertion focus |
|-----------|-----------|-----------------|
| 1–4 | `01-04 empty and basic MatchPlan mapping` | empty plan; competition/division mapping |
| 5–12 | `05-12 stage round sequence priority rules` | stage/round; sequence from deterministicOrder then matchNumber; priority only from policy |
| 13–16 | `13-16 duration and bye mapping` | duration enrichment; bye; no bye synthetic identity |
| 17–26 | `17-26 participant kinds and enrichment` | DIRECT kinds; enrichment / default; missing identity fails |
| 27–36 | `27-36 winner loser deps orientation and normalization` | WINNER/LOSER; edges on dependent; duplicate canonicalize |
| 33–37 | `33-37 contradictory unknown self outgoing mismatch` | fail-closed dependency diagnostics |
| 38–44 | `38-44 placement enrichment and no barrier invention` | placement enrichment; no PREVIOUS_ROUND/QUALIFICATION/GROUP_STAGE_COMPLETE |
| 45–54 | `45-54 policy and MatchPlan validation failures` | missing/invalid policy; MatchPlan invalid |
| 45–52 (buffers) | `45-52 shared-buffer Outcome B certification` | capacity+dependency buffers present; missing/negative fail; divergent → BUFFER_CONFLICT; equal maps once; no hidden default/derivation; no mutation |
| 55–58 | `55-58 mapped request validates and can feed 1D/1E/1F` | validateScheduleRequest; 1D graph; 1E baseline; 1F certify |
| 59–66 | `59-66 immutability and order independence` | no mutation; input-order independence; repeatable JSON |
| 67–71 | `67-71 fingerprint metadata and no score/lifecycle` | public fingerprint API; replay metadata; no score/lifecycle |
| 67–71 (cert) | `67-71 MatchPlan fingerprint certification` | public API only; order independence; semantic change; label independence; missing/invalid strategy; preserve/mismatch; no mutate/time/random; deterministic repeat |
| 72–76 | `72-76 import and nondeterminism boundaries` | public barrel only; no private/CORE-10/12/CC-09/UI; no Date.now/random |
| 77–81 | `77-81 prior CORE-11 suites remain present` | 1B–1F suites present |
| 3,4 | `multiple independent matches and competition mapping` | multi-match mapping |

File: `tests/competition-core-schedule-engine-core11-phase1g-b1-match-plan-adapter.test.js`

Every scenario 1–81 has an explicit assertion in the mapped test(s) above (a single test may cover multiple scenarios).

---

## Deferred work

- External roster → `constraintResourceIds`
- Richer placement enrichment producers
- **Phase 1G-B2** optional CORE-10 evaluator adapter (separate Owner authorization)
- CORE-12 physical feasibility
- Legacy CC-09 / TE / TT parity
- Production cutover
- Separate capacity vs dependency buffer fields on the CORE-11 request contract (would unlock Outcome A)

---

## Implemented files

| Path | Role |
|------|------|
| `adapters/createScheduleRequestFromMatchPlan.js` | Adapter |
| `adapters/index.js` | Barrel |
| `scheduleDiagnostics.js` | Adapter codes |
| `scheduleContracts.js` | Result factory |
| `scheduleTypes.js` | Typedefs |
| `index.js` | Public export |
| `07_PHASE_1G_B1_CORE09_ADAPTER.md` | This document |

---

## Next proposed phase

**Phase 1G-B2** — optional CORE-10 public-contract evaluator adapter, only after schedule-capable evaluation orchestration exists and Owner authorizes.
