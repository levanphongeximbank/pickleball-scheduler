# Branch Strategy — Phase 3P

## Naming convention (official)

```text
feature/competition-engine-phase-3b-participant-runtime
feature/competition-engine-phase-3c-registration-runtime
feature/competition-engine-phase-3d-team-runtime
feature/competition-engine-phase-3e-lineup-runtime
feature/competition-engine-phase-3f-seeding-runtime
feature/competition-engine-phase-3g-draw-runtime
feature/competition-engine-phase-3h-match-runtime
feature/competition-engine-phase-3i-schedule-runtime
feature/competition-engine-phase-3j-lifecycle-runtime
feature/competition-engine-phase-3k-standings-runtime
feature/competition-engine-phase-3l-publication-runtime
feature/competition-engine-phase-3m-production-cutover
feature/competition-engine-phase-3n-legacy-retirement
feature/competition-engine-integrator-wave-<N>
```

Audit branch (this phase):

```text
audit/competition-engine-phase-3p-parallelization
```

## Common rules

| Field | Value |
|-------|-------|
| Base branch | `origin/main` at start of wave (or Integrator wave branch if Owner requires stacked integration) |
| Forbidden | Force-push to main; Production flag flips; DB migrations; edits to protected files |
| Expected tests | Capability-local + architecture tests; Integrator merges official manifest |
| Integration dependency | Must list HARD upstream phases merged or fixture strategy |
| Merge prerequisite | Arch lock green; unit tests green; build green; Owner GO for Production-touching waves |

---

## Per-phase branch definitions

### 3B Participant

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3b-participant-runtime` |
| Base | `origin/main` |
| Allowed | `participants/runtime/**`, `identity.js`, `competitionParticipant.js`, participant validators/mappings/ports **modules** (not barrels), format participant adapters (map-only), `tests/competition-core-participant*-3b*.test.js`, `scripts/ci/unit-test-files.phase-3b.json`, `docs/competition-engine/phase-3b/**` |
| Forbidden | Root index, runtime-control barrels, `unit-test-files.json`, `entryRegistration.js`, `teamRosterLineup.js`, Production wiring, flags |
| Expected tests | Participant resolve/shadow unit + arch boundaries |
| Integration dependency | Wave-0 registry stubs recommended |
| Merge prerequisite | Owner GO after Integrator export |

### 3C Registration

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3c-registration-runtime` |
| Base | `origin/main` **after 3B merged** (3B∥3C NOT ALLOWED initially) |
| Allowed | `entryRegistration.js`, registration runtime modules, IND registration adapters (map-only), 3c tests + sub-manifest, phase-3c docs |
| Forbidden | Protected files; `identity.js` mutations; Production registration path cutover |
| Integration dependency | 3B Participant |
| Merge prerequisite | 3B on main |

### 3D Team

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3d-team-runtime` |
| Base | `origin/main` (after 3B preferred) |
| Allowed | TT team/roster engines adapters/ports/shadow; team sections of contracts **if sequential lock**; 3d tests |
| Forbidden | Lineup engines rewrite; core public index; V6 rewrite; DB schema |
| Integration dependency | Participant refs (CONTRACT_ONLY) |
| Merge prerequisite | Identity freeze |

### 3E Lineup

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3e-lineup-runtime` |
| Base | `origin/main` **after 3D** |
| Allowed | TT lineup* engines, lineup validators modules, rules bridge touch only if owned |
| Forbidden | Roster identity redesign; protected files |
| Integration dependency | 3D |
| Merge prerequisite | 3D on main |

### 3F Seeding

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3f-seeding-runtime` |
| Base | `origin/main` after 3C (entries) preferred |
| Allowed | `seed/**`, seed tests, sub-manifest |
| Forbidden | `draw/**` contract changes; Production seed path cutover |
| Integration dependency | Participant/Entry contracts |
| Merge prerequisite | Entry identity stable |

### 3G Draw

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3g-draw-runtime` |
| Base | after 3F preferred |
| Allowed | `draw/**` |
| Forbidden | `seed/**` contract edits |
| Integration dependency | 3F |
| Merge prerequisite | Seed result contract freeze |

### 3H Match

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3h-match-runtime` |
| Base | after 3G preferred |
| Allowed | `matchmaking/**`, `formation/**` |
| Forbidden | Lifecycle Elo wiring; Daily Production cutover without Owner |
| Integration dependency | 3G (fixtures OK for early work) |
| Merge prerequisite | Draw group contract freeze for Production-facing parity |

### 3I Schedule

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3i-schedule-runtime` |
| Base | after 3H preferred |
| Allowed | `scheduling/**` |
| Forbidden | Page-logic reverse deps expansion; protected files |
| Integration dependency | Match graph |
| Merge prerequisite | Match fixture/contract available |

### 3J Lifecycle

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3j-lifecycle-runtime` |
| Base | after 3H (match identity) |
| Allowed | **new** `lifecycle/**`, result DTOs |
| Forbidden | Elo Production enable; live RPC changes; DB migration |
| Integration dependency | Match |
| Merge prerequisite | Owner awareness of side-effect risk |

### 3K Standings

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3k-standings-runtime` |
| Base | after result DTO freeze (3J or Integrator) |
| Allowed | `standings/**` |
| Forbidden | TT standings rewrite without Owner; flag ON |
| Integration dependency | Match results (HARD for prod parity) |
| Merge prerequisite | Result contract |

### 3L Publication

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-phase-3l-publication-runtime` |
| Base | after 3G + 3I |
| Allowed | **new** `publication/**` |
| Forbidden | Public projection full unify if still DEFER; protected files |
| Integration dependency | Draw + Schedule |
| Merge prerequisite | Publish gate parity plan |

### Integrator wave

| Field | Value |
|-------|-------|
| Branch | `feature/competition-engine-integrator-wave-<N>` |
| Base | `origin/main` + merged capability branches |
| Allowed | **All protected files**; registry registration; official manifest; root exports; integration tests |
| Forbidden | New capability business logic (delegate back) |
| Merge prerequisite | Capability PRs reviewed; Owner GO for wave |
