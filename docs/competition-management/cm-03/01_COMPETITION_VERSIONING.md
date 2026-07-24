# CM-03 — Competition Versioning

**Phase:** CM-03  
**Status:** Implemented (capability-local / dormant; not production-wired)  
**Module:** `src/features/competition-management/competition-versioning/`  
**Public barrels:**  
- `src/features/competition-management/competition-versioning/index.js`  
- `src/features/competition-management/index.js` (re-export only)  
**Tests:** `tests/cm-03-competition-versioning.test.js`

---

## Purpose

Canonical **Competition Versioning** capability for Competition Management:

- immutable competition version snapshots
- stable version identity and linear lineage
- deterministic snapshot creation + content fingerprint
- tenant/competition scoped lookup and listing
- typed version comparison / field differences
- optimistic concurrency via expected definition revision + expected parent/latest
- deterministic restore / rollback **proposal** (not executed)
- capability-local in-memory repository + unimplemented production port

CM-03 does **not** replace CM-01 `CompetitionDefinition`. It snapshots management-owned definition state at an explicit point in time.

---

## Canonical version ownership

| Concept | Owner | Meaning |
|---------|-------|---------|
| `CompetitionDefinition.revision` | **CM-01** | Mutable edit / concurrency revision of the **current** definition |
| `CompetitionVersion` / `versionNumber` / `versionId` | **CM-03** | Immutable historical snapshot identity |
| `templateVersion` | **CM-02** | Versioned template catalog identity (may be **captured** in a snapshot) |
| `definitionVersion` / workflow `revision` | **CORE-19** | Workflow definition / instance concurrency |
| Replay fingerprints | **CORE-21** | Deterministic seed/replay evidence |
| Recovery checkpoints | **CORE-23** | Operational resume checkpoints |
| Audit events | **CORE-20** | Append-only operational audit stream |

---

## Distinction: definition revision vs competition version

- **CM-01 revision** increments when the mutable draft definition is updated.
- **CM-03 version** is created only when an explicit create-version command succeeds.
- Creating a version **does not** mutate the definition and **does not** bump CM-01 revision.
- Each version stores `sourceDefinitionRevision` in metadata for provenance.

---

## Distinction: template version vs competition version

- CM-01 definition stores opaque `{ templateId }` only.
- CM-02 uses `{ templateId, templateVersion }`.
- CM-03 may optionally capture `templateVersioned` and/or `instantiationPlanChecksum` inside the snapshot.
- Capturing template metadata is **not** template selection or instantiation.

---

## Snapshot content

Management-owned fields captured from a validated CM-01 definition:

- identity: `competitionId`, `tenantId`, `owner`
- planning: `name`, `description`, `competitionType`, `scope`, `visibility`, `status`
- associations: `venues`, `clubs` (set-like; canonicalized by id sort)
- windows: `registrationWindow`, `plannedPeriod`
- references: `template`, `ruleSet`
- optional CM-02 capture: `templateVersioned`, `instantiationPlanChecksum`

**Excluded:** UI wizard state, browser/local storage, live match/score/standings/schedule, payment/notification state, audit internals, replay seeds, recovery checkpoints, implicit tenant context.

---

## Immutable fields

Version aggregates are created in state `frozen` only.

Restore proposals preserve immutable definition identity fields:

- `competitionId`
- `tenantId`
- `owner`
- `createdAt` (target remains authoritative for create timestamp)

Lifecycle states `published` / `suspended` / `cancelled` / `archived` are **not** owned by CM-03 (CM-06..CM-08).

---

## Lineage

- Linear lineage only (no branch/fork in CM-03).
- Root: `versionNumber=1`, `parentVersionId=null`, `expectedLatestVersionNumber=0`.
- Next: `expectedParentVersionId` must equal current latest `versionId`, and `expectedLatestVersionNumber` must equal current latest number.
- Parent must belong to the same tenant and competition.
- Stale parent/latest expectations fail closed.

---

## Concurrency

Optimistic concurrency gates:

1. `expectedDefinitionRevision` must equal `definition.revision`.
2. `expectedParentVersionId` / `expectedLatestVersionNumber` must match repository latest.
3. Duplicate `versionId` rejected.
4. No silent repair or inference.

---

## Idempotency

- Optional explicit `idempotencyKey` (not derived from wall-clock).
- Same key + same content fingerprint → return existing version.
- Same key + different fingerprint → `CM03_IDEMPOTENCY_CONFLICT`.

---

## Comparison

- Requires explicit tenant scope.
- Same competition by default; cross-competition rejected unless `allowCrossCompetition=true`.
- Typed differences: `ADDED` / `REMOVED` / `CHANGED`.
- Deterministic path ordering.
- Content vs semantic metadata differences separated; volatile actor/timestamps excluded from equality.

---

## Restore proposal

`createCompetitionRestoreProposal` / `createCompetitionRestoreProposalCommand`:

- builds a deterministic CM-01-compatible field replacement proposal
- lists field differences and immutable fields preserved
- sets `executesPersistence=false`, `executesRuntimeRecovery=false`, `mutatesTarget=false`, `publishes=false`
- does **not** call CM-01 update, write DB, or run CORE-23 recovery

This is a management-level restore proposal only — not recovery execution.

---

## Tenant boundary

- Every create / get / list / compare / restore path requires explicit `tenantId` + `competitionId`.
- Lookup by `versionId` without matching tenant/competition returns `CM03_VERSION_NOT_FOUND` (no cross-tenant existence leak).
- No first-tenant fallback.

---

## Deterministic guarantees

- Stable key ordering for fingerprint canonicalization.
- Set-like venue/club refs sorted by id; domain order not invented for other arrays.
- Fingerprint algorithm: `cm03-fnv1a32-v1` (`cm03-<8hex>`). Not a security signature; not CORE-21 ownership.
- Caller-supplied `createdAt` (no ambient clock).
- Deterministic error ordering and explanations.

---

## Persistence / runtime status

| Concern | Status |
|---------|--------|
| Production runtime wiring | **OFF** (`wiredToProductionRuntime: false`) |
| SQL / migration | **None** (`hasMigration: false`) |
| Production repository | Unimplemented port only |
| Capability-local repository | In-memory (`createInMemoryCompetitionVersionRepository`) |
| UI | None |
| Legacy version graph mapping | **No safe legacy history mapping** (CM-01 projector forces `revision=1`; no update history graph) |

---

## Legacy compatibility

Audit conclusion: **no safe legacy version mapping**.

- Legacy tournament blobs do not provide a trustworthy version lineage graph.
- CM-01 legacy projector always sets `revision=1`.
- CM-03 therefore does **not** ship a fake legacy → CompetitionVersion adapter.
- Future adapters must be explicit, read-only, fail-closed on ambiguous history.

---

## Boundary with CORE-19 / 20 / 21 / 23

| Capability | CM-03 relationship |
|------------|--------------------|
| CORE-19 workflow | Different aggregate; CM-03 does not drive workflow transitions |
| CORE-20 audit | CM-03 does not persist audit events |
| CORE-21 replay | CM-03 fingerprint is local; not replay seed ownership |
| CORE-23 recovery | Restore proposal ≠ operational recovery/resume |

Opaque `competitionVersionId` reserved by CORE-07 seeding may later reference CM-03 `versionId` via Integrator wiring — not activated in CM-03.

---

## Boundary with CM-04 to CM-08

| Phase | Ownership |
|-------|-----------|
| CM-04 Configuration | Detailed configuration editing — deferred |
| CM-05 Branding | Branding assets — deferred |
| CM-06 Publication | Publication process / published state — deferred |
| CM-07 Suspension / Cancellation | Lifecycle transitions — deferred |
| CM-08 Archive | Archive process — deferred |

CM-03 may snapshot management status metadata present on the definition, but does not own those lifecycle processes.

---

## Activation conditions

CM-03 remains dormant until an explicit Integrator phase enables:

1. durable tenant-scoped persistence (migration + RLS)
2. production repository adapter
3. optional audit event emission via CORE-20 ports
4. optional mapping of `versionId` → CORE-07 `competitionVersionId`
5. UI/API wiring for version history / restore proposal application through CM-01 commands

Until then: capability-local contracts + tests only. No production tournament runtime cutover.
