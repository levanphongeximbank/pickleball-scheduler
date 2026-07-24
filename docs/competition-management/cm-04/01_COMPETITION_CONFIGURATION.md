# CM-04 — Competition Configuration

**Phase:** CM-04  
**Status:** Implemented (capability-local / dormant; not production-wired)  
**Module:** `src/features/competition-management/competition-configuration/`  
**Public barrels:**  
- `src/features/competition-management/competition-configuration/index.js`  
- `src/features/competition-management/index.js` (re-export only)  
**Tests:** `tests/cm-04-competition-configuration.test.js`

---

## Purpose

Canonical **Competition Configuration** capability for Competition Management:

- tenant-safe, deterministic, fail-closed configuration aggregate
- explicit section ownership and Competition Core **references** (no engine execution)
- create / update draft configuration with optimistic concurrency
- explicit CM-02 template-proposal application (CM-04-owned fragments only)
- configuration comparison and snapshot projection for future CM-03 capture
- typed field-level errors and deterministic explanations
- capability-local in-memory repository + unimplemented production port
- partial legacy read projector (no full safe mapping)

CM-04 does **not** replace CM-01 `CompetitionDefinition`, CM-02 template selection, or CM-03 immutable versions.

---

## Canonical configuration ownership

| Concept | Owner | Meaning |
|---------|-------|---------|
| `CompetitionConfiguration` / `configurationId` / `revision` | **CM-04** | Mutable management configuration + concurrency revision |
| `CompetitionDefinition` / `definition.revision` | **CM-01** | Identity, planning windows, template/ruleSet refs |
| Template selection / instantiation plan | **CM-02** | Proposal fragments; CM-04 applies only `cm04_configuration` |
| `CompetitionVersion` / `versionNumber` | **CM-03** | Immutable historical snapshot (may later capture CM-04 snapshot) |
| Branding / regulation copy | **CM-05** | Not owned by CM-04 |
| Publication / lock transition | **CM-06** | CM-04 may store external editability constraint reference only |
| Suspension / cancellation | **CM-07** | Not owned |
| Archive | **CM-08** | Not owned |
| Engine execution (eligibility, draw, score, …) | **Competition Core** | References only |

---

## Section ownership

Canonical sections (references + parameters only):

| Section | Notes |
|---------|-------|
| `participant_mode` | individual / team / mixed |
| `format` | opaque `formatBlueprintId` (CM-02 proposal path) |
| `registration_policy` | `registrationDefaults` object — **not** CM-01 registration window |
| `eligibility` | capability reference |
| `division` | capability reference (deferred CORE catalog) |
| `roster` | team-only capability reference |
| `seeding` / `draw` | capability references + cross-section checks |
| `match_format` / `scoring` | capability references + compatibility |
| `scheduling` / `court_assignment` | schedule + venue-scope hint checks |
| `referee` / `conflict_resolution` / `match_lifecycle` | capability references |
| `result_validation` / `standings` | standings + optional tie-break refs |
| `workflow` | definition reference only — rejects runtime state |
| `official_mode` | official_open / official_ai_balance |
| `operational_limits` | management thresholds |

Empty `sections: {}` is an explicit valid empty draft.

---

## CompetitionDefinition boundary (CM-01)

CM-04:

1. Requires explicit definition + `expectedDefinitionRevision`
2. Verifies tenantId / competitionId match
3. Requires editable draft definition for create/update/apply
4. Fail-closed on stale definition revision
5. Does **not** mutate definition or bump CM-01 revision
6. Does **not** duplicate registrationWindow / plannedPeriod ownership
7. Captures `competitionType` / `scope` as derived context for validation
8. If a CM-02 proposal includes CM-01 patches, returns them as `definitionPatchProposals` only

---

## Template instantiation boundary (CM-02)

CM-04:

1. Requires explicit CM-02 instantiation result
2. Requires compatibility PASS + SUCCESS status
3. Verifies tenant / competition / sourceDefinitionRevision
4. Applies **only** `ownershipTarget === cm04_configuration` fragments
5. Rejects unknown ownership targets (no silent discard)
6. Requires `replaceExistingConfiguration=true` when overwriting non-empty config
7. Does not select templates or mutate the proposal
8. Does not update CM-01 template reference

Known CM-04 proposal paths:

- `configuration.formatBlueprintId`
- `configuration.registrationDefaults`

---

## CompetitionVersion boundary (CM-03)

CM-04 provides:

- deterministic `CompetitionConfigurationSnapshot` payload
- `configurationRevision` + content fingerprint (`cm04-fnv1a32-v1`)

CM-04 does **not** create versions, bump version numbers, write lineage, or restore from CM-03.

---

## Competition Core reference boundary

Each reference declares:

- `capabilityOwner`
- `referenceId` (nullable only for `deferred_unsupported`)
- `referenceVersion` (optional)
- `resolutionStatus`: `opaque_proposal` | `deferred_unsupported` | `resolved_identity`

Deferred owners cannot claim `resolved_identity`. CM-04 never imports CORE private implementations to execute rules.

---

## Configuration revision & concurrency

- Create → `revision = 1`
- Successful update → `revision + 1`
- Validation failure / no-op → revision unchanged
- `expectedConfigurationRevision` required on update
- Stale revision → typed conflict
- Distinct from CM-01 definition revision and CM-03 version number

---

## Cross-section validation

Fail-closed checks include:

- competition type ↔ participant mode
- team-only sections on individual mode
- official_mode only for official_tournament
- seeding/draw resolution conflicts
- match_format/scoring resolution conflicts
- court venueScopeHint vs definition venues
- unknown / duplicate sections
- deterministic error ordering
- no silent repair

---

## Comparison & snapshot

- Compare two explicit configurations (same tenant; same competition by default)
- Change types: ADDED / REMOVED / CHANGED
- Snapshot excludes UI state, engine runtime, live scores/standings, payments, local storage

---

## Tenant isolation

All repository lookups require explicit `tenantId` + `competitionId`. Cross-tenant existence is not leaked.

---

## Deterministic guarantees

- Sorted section keys / field errors / diffs
- Stable fingerprint for equal semantic content
- No mutation of command inputs
- Repeated create/apply with same inputs → stable structure

---

## Legacy compatibility

`projectLegacyTournamentToConfigurationSections`:

- read-only partial projection
- maps safe `officialMode` when valid
- records unsupported fields (CM-01 windows, CM-05 copy, runtime artifacts)
- rejects ambiguous team-settings mapping with typed error
- **no safe full legacy configuration mapping**

Legacy tournament runtime remains transitional production source.

---

## Persistence / runtime status

| Flag | Value |
|------|-------|
| `wiredToProductionRuntime` | false |
| `hasPersistence` | false |
| `hasUi` | false |
| `hasMigration` | false |
| `migrationAuthored` | false |
| `migrationApplied` | false |
| `repositoryMode` | capability-local-in-memory |

---

## CM-05..CM-08 boundary

| Workstream | Boundary |
|------------|----------|
| CM-05 Branding | Regulation/copy/messages deferred |
| CM-06 Publication | CM-04 may store external editability constraint reference; does not publish |
| CM-07 Suspension/Cancellation | Not owned |
| CM-08 Archive | Not owned |

---

## Activation conditions

Do **not** activate production wiring until:

1. Durable configuration persistence approved
2. CM-03 snapshot capture of configuration content approved
3. Competition Core blueprint/catalog identities stabilized where referenced
4. Explicit cutover plan from legacy `tournament.settings` (no silent cast)
5. Feature-flagged UI/API integration reviewed

Until then, module remains dormant.
