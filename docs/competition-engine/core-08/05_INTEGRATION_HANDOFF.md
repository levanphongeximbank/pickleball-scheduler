# CORE-08 — Integration Handoff

**Phase:** 1E (documentation only)
**Prerequisite:** Phase 1E final certification (`04_PHASE_1E_FINAL_CERTIFICATION.md`)
**Canonical API:** `createDrawResolver(options).resolve(drawResolveRequest)`
**Capability path:** `src/features/competition-core/draw-runtime/**`

## Purpose

Hand off integration responsibilities to the Integrator. Phase 1E must **not** perform these actions.

## Integrator responsibilities

| # | Responsibility | Owner | Phase 1E |
|---|----------------|-------|----------|
| 1 | Decide root capability export (`competition-core/index.js` re-exports) | Integrator | Do not |
| 2 | Merge capability-local test manifests into official CI (`unit-test-files.json`) | Integrator | Do not |
| 3 | Build application adapters for real production callers | Integrator / Application Layer | Do not |
| 4 | Select feature-flag and shadow-comparison strategy | Integrator | Do not |
| 5 | Run legacy-versus-canonical production-fixture parity | Integrator | Do not |
| 6 | Retain rollback path (flag off → legacy engines) | Integrator | Do not |
| 7 | Wire CORE-03 persistence implementation if required | Integrator + CORE-03 | Do not |
| 8 | Wire CORE-01 rule/constraint providers into `constraintResolver` | Integrator + CORE-01 / Competition Format | Do not |
| 9 | Wire CORE-02 eligible-entry providers | Integrator + CORE-02 | Do not |
| 10 | Wire CORE-07 seed references (immutable; no recalculation in CORE-08) | Integrator + CORE-07 | Do not |
| 11 | Run Preview/Staging certification | Integrator | Do not |
| 12 | Obtain Owner approval before Production cutover | Owner + Integrator | Do not |

## Recommended integration sequence

1. Keep capability-local manifests green (3H → 1B → 1C → 1D → 1E).
2. Add application-layer adapters that map production payloads → certification/canonical request shapes.
3. Enable shadow comparison behind flags (legacy primary; canonical observe-only).
4. Prove fixture parity on Staging with rollback rehearsed.
5. Merge root export + official CI only when Owner approves.
6. Production cutover only after Owner approval; keep legacy path available.

## Capability-local CI manifests (not official)

| Manifest | Coverage |
|----------|----------|
| `scripts/ci/unit-test-files.phase-3h.json` | Phase 3H |
| `scripts/ci/unit-test-files.phase-core08-1b.json` | + 1B |
| `scripts/ci/unit-test-files.phase-core08-1c.json` | + 1C |
| `scripts/ci/unit-test-files.phase-core08-1d.json` | + 1D |
| `scripts/ci/unit-test-files.phase-core08-1e.json` | + 1E certification |

Official `scripts/ci/unit-test-files.json` remains unchanged until Integrator merge.

## Ownership reminders for wiring

| Concern | Owner |
|---------|-------|
| Seed calculation | CORE-07 |
| Rating calculation | Competition Format / rating owners |
| Participant eligibility | CORE-02 |
| Format-specific constraints (club/unit/host, private pairing) | Competition Format / CORE-01 providers |
| Persistence implementation | CORE-03 |
| Fixture / match / schedule / court / referee / scoring | Downstream capabilities |
| UI orchestration | UI Layer |
| Production cutover decision | Owner |

## Rollback expectations

- Feature flag defaults remain off (`DRAW_V2` / runtime control LEGACY_ONLY).
- Legacy production engines remain present and callable.
- CC-04 `evaluateCanonicalDraw` remains unre-wired until Integrator explicitly delegates.
- Shadow failures must not auto-cutover.

## Explicit non-goals of Phase 1E

- No runtime, adapter, contract, port, enum, or service edits
- No root export
- No official CI merge
- No production caller switch
- No SQL / deploy / feature-flag enablement
- No commit / push / PR / cutover in this phase
