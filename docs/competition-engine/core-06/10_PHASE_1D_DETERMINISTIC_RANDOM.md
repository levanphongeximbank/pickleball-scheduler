# CORE-06 Phase 1D — Deterministic Random & Missing-Lineup Policy

**Status:** Implemented (capability-local, dormant)  
**Prerequisite:** Phase 1C `READY_FOR_PHASE_1C` / merged  
**Production impact:** NONE

## Delivered

- Deterministic algorithm `CORE06_LINEUP_SEEDED_FISHER_YATES` v`1.0.0`
- Seed normalization + canonical composition helpers
- Candidate / slot-template normalization (order-independent)
- Input / seed / selection fingerprints
- `LineupRandomPort.selectLineup` + in-memory deterministic port
- Missing-lineup outcomes: `RANDOMIZED` | `MANUAL_PENDING` | `FORFEIT_PENDING` | `BLOCKED`
- Format-agnostic `LineupRandomPolicy` injection
- Idempotency (same key + payload → replay; same key + different payload → fail closed)
- Unit tests: `tests/competition-core-lineup-core06-phase1d.test.js`

## Canonical seed composition

Field order (joined by U+001F unit separator), then NFC + trim:

1. `tenantId`
2. `competitionId`
3. `contextId`
4. `teamId`
5. `rosterVersion` (stringified)
6. `lineupIdentityKey`
7. `revisionOrCommandId` (may be empty string)
8. `ownerSeed` (**required**, non-empty)

Helpers: `composeCanonicalSeed`, `normalizeSeed`.  
**Never invent a seed.** Missing/empty → `MISSING_SEED`.

## Algorithm

1. Normalize seed (NFC, reject empty / NUL).
2. Normalize roster candidates: reject invalid/duplicates; sort by opaque `kind:id` token (code-unit order).
3. Normalize slot template: reject invalid/duplicates; sort by `disciplineOrSideKey` then `index`.
4. Fail closed on scope / roster-version mismatch.
5. For each slot in sorted order:
   - Filter via injected policy (`filterEligible`, `validateCandidateUse`, reuse rules).
   - Seeded Mulberry32 Fisher–Yates shuffle of remaining pool (sub-seed = seed + inputFingerprint + slot key).
   - Pick first candidate that passes `validateSlotAssignment`.
6. Emit selected slots + fingerprints + `MissingLineupResolution` with `outcome=RANDOMIZED`.
7. **No** auto publish / reveal / score / forfeit. Caller must use Phase 1C lifecycle commands.

Behavior changes require bumping `LINEUP_RANDOM_ALGORITHM.version`.

## Candidate normalization

- Do not trust roster array order or object key order.
- Opaque participant ids are not locale-cased.
- Duplicate identity tokens → `DUPLICATE_ROSTER_MEMBER`.
- Empty members → `EMPTY_ROSTER`.
- Inputs are never mutated.

## Fingerprints

| Fingerprint | Purpose |
|-------------|---------|
| `seedFingerprint` | Normalized seed identity |
| `inputFingerprint` | Scope + candidate tokens + slots + policy id + algorithm version |
| `selectionFingerprint` | Canonical selected slots |

Rules: no clock; no secrets/tokens; no personal profile fields beyond identity tokens; semantically identical input (reordered arrays/keys) → same fingerprint after normalization.

## LineupRandomPort

```text
selectLineup(request) → LineupRandomSelectResult
```

Request: `seed`, `lineupIdentityKey`, `rosterSnapshot`, `slotTemplate`, `policy`, `scope`, `actor`, `source`, optional idempotency / version fields.

Result: `selectedSlots`, `normalizedSeed`, fingerprints, `algorithmId` / `algorithmVersion`, `resolution`, `deterministic: true`.

`fillMissing` retained as Phase 1C compatibility shim.  
`createDeterministicLineupRandomPort` — tests / isolated domain only. **No Production adapter.**

## Missing-lineup outcomes

| Outcome | Meaning |
|---------|---------|
| `RANDOMIZED` | Deterministic selection succeeded (no auto lifecycle transition) |
| `MANUAL_PENDING` | Human action required |
| `FORFEIT_PENDING` | Format may forfeit; CORE-06 records only |
| `BLOCKED` | Cannot / must not randomize; reason codes attached |

Injected policy `decideMissingStrategy()` chooses `random` | `manual_pending` | `forfeit_pending` | `blocked`.

## Reason codes (Phase 1D)

`MISSING_SEED`, `INVALID_SEED`, `EMPTY_ROSTER`, `INVALID_ROSTER_SNAPSHOT`, `DUPLICATE_ROSTER_MEMBER`, `INSUFFICIENT_ELIGIBLE_PARTICIPANTS`, `INVALID_SLOT_TEMPLATE`, `UNSATISFIABLE_POLICY`, `ROSTER_VERSION_MISMATCH`, `RANDOMIZATION_NOT_ALLOWED`, `MANUAL_RESOLUTION_REQUIRED`, `FORFEIT_REVIEW_REQUIRED`, `INVALID_SCOPE`, `NON_DETERMINISTIC_INPUT`  
(plus existing `LINEUP_IDEMPOTENCY_CONFLICT`)

## Policy boundary

CORE-06 does **not** hard-code gender, MLP, discipline names, ratings, partner rules, or reuse. Format injects `LineupRandomPolicy`. CORE-05 owns roster SoT; CORE-03 owns eligibility adjudication.

## Team Tournament V6 parity (reference only — TT unchanged)

| Topic | TT V6 today | CORE-06 Phase 1D |
|-------|-------------|------------------|
| RNG | `Math.random` in `lineupRandomEngine.shuffle` | Seeded Mulberry32 — **intentional improvement** |
| Missing lineup | Settings policy RANDOM / FORFEIT / MANUAL; RANDOM auto-locks lineup | Same four outcomes; **no** auto lock/publish |
| Locale | `localeCompare` / `toLocaleTimeString` in TT random path | Code-unit ordering only |
| Composition | Gender / mixed-pair / appearance ranking in TT engine | Injected policy only |
| Seed | None | Required canonical seed |

Preserved intent: missing-lineup may randomize, wait for manual, or flag forfeit review.  
Requires future Owner-approved adapter/cutover: TT writer replacement, RPC parity, Production wiring.

## Security / privacy

- No opponent visibility / pre-publish reveal changes
- Fingerprints use identity tokens only
- Audit metadata omits secrets
- Scope fail-closed; selections must belong to roster snapshot
- Actor / source / idempotency preserved
- No browser timezone / system clock dependency

## Deferred

- Production adapter / dual-write / feature flag
- SQL / RPC / UI
- Root `competition-core/index.js` Integrator re-exports
- Official CI allowlist updates (not owned by this branch)
- TT cutover adapter
