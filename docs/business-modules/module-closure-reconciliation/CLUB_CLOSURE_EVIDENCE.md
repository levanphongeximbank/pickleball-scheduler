# Club Management — Closure Evidence

**Module:** Club Management  
**Classification:** `STRUCTURAL_FOUNDATION_COMPLETE`  
**Gap type:** structural/roadmap residual (not active implementation gap for locked 2E–2G governance track)

## Canonical surfaces

| Dimension | Path / authority |
|-----------|------------------|
| Canonical source | `src/features/club/` |
| Public facade | `src/features/club/index.js` |
| Ownership | Club entity, members, membership requests, governance assignments |
| Forbidden writers | Player / Competition / Venue / Ranking must not own club membership writes |
| Persistence | Production SoT: `public.clubs`, `club_members`, membership/governance tables; V2 flag gates cloud |
| Authorization | Governance `can*` + permissions; Phase 2D authz matrix |
| Platform Core | `src/features/club/platform/` |
| External ports | Tournament/notification bridges; venue-owner bind; player picker (read) |

## Implementation scope status

| Track | Status |
|-------|--------|
| Phase 2C–2G governance UI / writers | Closed-with-note in `docs/club-phase2/` |
| Phase 2H Owner GO | **Open** (roadmap) |
| Legacy retirement | **Open** (roadmap) |
| V2 storage flag Production enablement | Deferred |

Because Phase 2H / legacy retirement remain explicitly open in Club phase status docs, module-level classification stays **`STRUCTURAL_FOUNDATION_COMPLETE`**, not `FULLY_COMPLETED_CLOSED`.

## Tests (targeted)

- `tests/club-management.test.js`
- `tests/club-governance.test.js`
- `tests/club-phase-2c-membership-parity.test.js`
- `tests/club-phase-2d-governance-writer.test.js`
- `tests/club-phase-2e-governance-read-model.test.js`
- `tests/club-phase-2f-governance-ui-certification.test.js`

## localStorage / mock

Dual-stack: V2 OFF allows local writers for development. Production authority is cloud tables when V2 enabled — local is not Production SoT.

## Deferred gates (registered)

- `CLUB_PHASE_2H_OWNER_GO`
- `CLUB_LEGACY_RETIREMENT`
- `CLUB_V2_PRODUCTION_ENABLEMENT`

## Verdict

No active domain implementation gap requiring BM-FINAL-GAPS-02 source edits.  
Structural residuals are formally deferred. Do not force `FULLY_COMPLETED_CLOSED`.
