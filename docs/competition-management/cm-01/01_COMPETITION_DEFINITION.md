# CM-01 — Competition Definition

**Phase:** CM-01  
**Status:** Implemented (capability-local / dormant; not production-wired)  
**Module:** `src/features/competition-management/competition-definition/`  
**Public barrels:**  
- `src/features/competition-management/competition-definition/index.js`  
- `src/features/competition-management/index.js` (re-export only)  
**Tests:** `tests/cm-01-competition-definition.test.js`

---

## Purpose

Canonical **Competition Definition** aggregate for Competition Management:

- identity (`competitionId`, `tenantId`)
- ownership / organizer reference
- planning metadata (registration window, planned period)
- draft definition fields (name, description, type, scope, visibility, associations, template/rule-set refs)
- revision baseline for CM-03
- create/update draft commands with typed field-level validation

CM-01 is the **management-level** source of truth for definition. It does **not** replace Competition Core engine ownership or legacy blob tournament runtime.

---

## Canonical source of truth

| Layer | Status |
|-------|--------|
| **Canonical (CM-01)** | `CompetitionDefinition` contract + commands (this module) |
| **Transitional (production today)** | `club_data_v3.tournaments[]` via `tournamentService` / format modules |
| **Legacy model** | `src/models/tournament/tournament.js` |
| **Read compatibility** | `projectLegacyTournamentToCompetitionDefinition` |
| **Write compatibility** | Deferred — CM-01 does not write legacy blobs |

---

## Ownership boundary

### CM-01 owns

- `CompetitionDefinition` aggregate
- `competitionId`, `tenantId` (as definition identity fields)
- owner/organizer **reference**
- competition type, scope, visibility baseline
- registration window, planned competition period
- venue/club **association references**
- template / rule-set **references** (opaque)
- management lifecycle classification baseline (`draft` / `published`; reserved statuses documented)
- immutable identity protection
- revision baseline (`1`, increment on draft update)
- definition validation, create/update draft commands
- typed errors, field-level errors, deterministic explanations
- legacy → canonical read projector

### CM-01 does not own

- CORE-01 rule evaluation; CORE-02 participants/entries; CORE-03 eligibility
- CORE-04 divisions; roster/lineup; seeding; draw; match generation; schedule
- court/referee assignment; resource conflicts
- CORE-15..18 match/scoring/results/standings
- CORE-19 workflow transitions; CORE-20 audit persistence; CORE-21 replay
- CORE-22 import/export execution; CORE-23 recovery/resume
- CM-02 template implementation; CM-03 version history implementation
- CM-04 detailed configuration; CM-05 branding; CM-06 publication process
- CM-07 suspension/cancellation process; CM-08 archive process
- payment transactions; venue/court inventory; player profiles; club membership; notification delivery

---

## Field ownership

| Field | Required | Optional | Immutable | Draft-editable | Reference-only | Deferred |
|-------|----------|----------|-----------|----------------|----------------|----------|
| `competitionId` | ✓ | | ✓ | | | |
| `tenantId` | ✓ | | ✓ | | | |
| `owner` | ✓ | | ✓ (after create) | | ✓ | |
| `name` | ✓ | | | ✓ | | |
| `description` | | ✓ (default `""`) | | ✓ | | |
| `competitionType` | ✓ | | | ✓ | | |
| `scope` | ✓ | | | ✓ | | |
| `visibility` | ✓ | | | ✓ | | |
| `status` | ✓ (create→draft) | | | draft only via update-draft | | CM-06/07/08 transitions |
| `revision` | ✓ | | managed | auto-increment | | CM-03 history |
| `venues[]` | | ✓ | | ✓ | ✓ | |
| `clubs[]` | scope-dependent | | | ✓ | ✓ | |
| `registrationWindow` | | ✓ | | ✓ | | |
| `plannedPeriod` | | ✓ | | ✓ | | |
| `template` | | ✓ | | ✓ | ✓ | CM-02 |
| `ruleSet` | | ✓ | | ✓ | ✓ | CORE-01 eval |
| `createdAt` | ✓ | | ✓ | | | |
| `updatedAt` | ✓ | | | set by commands | | |

**Timezone:** not owned by CM-01. Timestamps are absolute instants (ISO-8601 or epoch ms). Product timezone policy remains a dependency outside this module.

---

## Tenant boundary

- Explicit `tenantId` required on create and update.
- No implicit global context, first-tenant, first-club, or first-venue fallback.
- Cross-tenant update/read rejected (`CM01_CROSS_TENANT_DENIED`).
- Repository port (unimplemented) is tenant-scoped by contract.

---

## Compatibility strategy

- Legacy `tournamentId` / `id` maps to `competitionId` only when unambiguous.
- Dual differing `id` + `competitionId` → `CM01_LEGACY_INCOMPATIBLE`.
- Missing legacy `tenantId` → reject (no DEFAULT_TENANT inference).
- Owner must be supplied in projector options (legacy blob has no canonical owner).
- Default projector visibility `private` only when option omitted — documented as adapter assumption, not domain silent repair of invalid input.
- No write path to legacy blobs in CM-01.

---

## Persistence / runtime status

| Concern | Status |
|---------|--------|
| Production wiring | **OFF** (`wiredToProductionRuntime: false`) |
| Persistence | **None** (`hasPersistence: false`) |
| UI | **None** |
| Migration | **Not required / not authored** |
| Repository port | Stub only — throws `CM01_PORT_OPERATION_UNIMPLEMENTED` |

---

## Deferred integrations

- UI/API create flows continue to use `tournamentService` until Integrator cutover.
- Persistence + SQL migration when CM-01 becomes durable SoT.
- CM-02 template selection/instantiation consumes `template` reference + draft capability.
- CM-03 version history extends `revision` baseline.
- CM-04..CM-08 own configuration, branding, publication, suspension/cancel, archive.
- CORE modules continue to accept opaque `competitionId` without depending on this module in CM-01.

### Conditions to activate

1. Owner-approved Integrator phase.
2. Persistence + tenant RLS design.
3. Explicit dual-write or cutover plan from blob tournaments.
4. Regression coverage for UI/API paths.
5. No silent replacement of production `tournamentService` without approval.

---

## Dependencies for CM-02 / CM-03

**CM-02 ready inputs from CM-01:** `competitionId`, `tenantId`, `owner`, `competitionType`, `scope`, `template` ref contract, `ruleSet` ref contract, `status=draft`, `revision`, validation result, create/update draft commands.

**CM-03:** stable `revision` integer baseline; full version history graph deferred.

---

## Migration status

**No migration authored. No migration applied.** Capability-local module only.
