# CM-02 — Template Selection & Instantiation

**Phase:** CM-02  
**Status:** Implemented (capability-local / dormant; not production-wired)  
**Module:** `src/features/competition-management/template-instantiation/`  
**Public barrels:**  
- `src/features/competition-management/template-instantiation/index.js`  
- `src/features/competition-management/index.js` (re-export)  
**Tests:** `tests/cm-02-template-instantiation.test.js`

---

## Purpose

Canonical **Template Selection & Instantiation** capability for Competition Management:

1. Discover and select a valid competition template in the correct tenant/context.
2. Verify compatibility between template and CM-01 `CompetitionDefinition`.
3. Build a deterministic template instantiation plan.
4. Instantiate into canonical draft patch/proposal artifacts (not runtime writes).
5. Attach an explicit template reference to the proposal for CM-01 (after compatibility PASS).

CM-02 **consumes** CM-01; it does **not** replace Competition Definition ownership.

---

## Canonical template ownership

| Concept | Owner |
|---------|-------|
| `CompetitionTemplateDefinition` / `templateId` / `templateVersion` | **CM-02** |
| Template scope (`global` / `tenant`) + availability | **CM-02** |
| Selection / compatibility / instantiation plan + result | **CM-02** |
| Capability-local catalog contract | **CM-02** |
| Legacy mode/preset → template candidate adapter | **CM-02** |
| `CompetitionDefinition.template` opaque `{ templateId }` field | **CM-01** |
| Competition identity / tenant / owner / draft / revision | **CM-01** |

---

## Selection behavior

- Requires explicit `tenantId`, `templateId`, and `CompetitionDefinition`.
- Optional explicit `templateVersion` (defaults to version `1` only when omitted on lookup — never auto-picks another template).
- Fail-closed if missing, unavailable, or tenant-denied.
- **No** first-template fallback.
- **No** inferred tenant / owner / venue / club.
- **No** inferred template from tournament type or UI route.
- Recommendation queries (if added later) must not mutate definition.

---

## Compatibility behavior

Evaluates at minimum:

- tenant ownership / template global|tenant scope
- competition type & scope
- venue/club requirements
- owner class (when declared)
- registration window / planned period requirements
- visibility allowlist
- existing template reference (+ replace intent)
- existing rule-set conflict (warning)
- draft status + expected revision
- availability / version identity

Result: `PASS` or `FAIL`, field/path issues, stable codes, deterministic sort, no mutation, no silent repair.

---

## Instantiation behavior

1. Compatibility must PASS.
2. Build deterministic plan (`planId` checksum, patches, ownership targets, revision baseline).
3. Return `definitionPatch` + `proposedFragments` only.
4. Does **not** call CM-01 `updateDraft`, does **not** write DB, publish, notify, or run CORE.

CM-01 definition field patches are limited to ownership target `cm01_definition` (e.g. `template`, optional proposed `ruleSet` / `visibility`). Other fragments target CM-04 / CORE as **proposals**.

---

## CM-01 boundary

CM-02 reads `CompetitionDefinition` and returns proposals. It must not:

- change immutable fields (`competitionId`, `tenantId`, `owner`, `createdAt`)
- invent identity
- publish
- mutate the input definition object
- attach template reference without compatibility PASS
- operate on non-draft definitions
- silently overwrite an existing different template reference

---

## CM-03 boundary

- `templateVersion` ≠ competition version history.
- `expectedRevision` / `expectedOutputRevision` are optimistic concurrency baselines only.
- No history store, rollback, branch, or snapshot management in CM-02.

---

## CM-04 … CM-08 boundary

| Workstream | Boundary |
|------------|----------|
| CM-04 Configuration | Owns detailed editable config; CM-02 only proposes blueprint refs / defaults |
| CM-05 Branding | Not owned; regulation copy presets are not competition templates |
| CM-06 Publication | Not owned; draft-only |
| CM-07 Suspension/Cancellation | Not owned |
| CM-08 Archive | Not owned |

---

## Competition Core dependency

CM-02 may propose opaque refs / capability tags (`ruleSet`, division/format/schedule/scoring/standings blueprints).  
It does **not** execute Rule Engine, registration, draw, match generation, schedule, scoring, or standings.

---

## Tenant boundary

- Explicit `tenantId` required on list/get/select/evaluate/instantiate.
- Global templates available to any explicit tenant context.
- Tenant templates require exact `tenantId` match.
- Cross-tenant access → `CM02_CROSS_TENANT_DENIED` / `CM02_TENANT_TEMPLATE_DENIED`.

---

## Deterministic guarantees

- Stable error/issue ordering.
- Stable plan checksum for equal inputs.
- No wall-clock dependency (no injected clock required in this phase).
- No input mutation.

---

## Legacy compatibility

| Source | Status |
|--------|--------|
| Canonical | CM-02 capability-local static catalog |
| Transitional | Legacy `TOURNAMENT_MODE` / `FORMAT_PRESET.mlp_4` |
| Read | `projectLegacyPresetToCompetitionTemplateCandidate` |
| Write | Deferred — no dual-write, no `tournamentService` mutation |
| Unsupported | `official_open` alone, `official_ai_balance` alone, `custom` preset, regulation/session/CRM templates |

---

## Catalog / persistence status

| Concern | Status |
|---------|--------|
| Catalog | Capability-local static / in-memory |
| Production DB catalog | **None** |
| Migration | **Not required / not authored** |
| Catalog port | Stub — `CM02_PORT_OPERATION_UNIMPLEMENTED` |

---

## Dormant / runtime status

| Concern | Status |
|---------|--------|
| Production wiring | **OFF** |
| UI | **None** |
| Persistence | **None** |

---

## Deferred integrations

- UI/API template pickers continue on legacy setup flows until Integrator cutover.
- Production catalog + RLS when templates become durable SoT.
- Apply instantiation proposals via CM-01 `updateDraftCompetitionDefinition` in a later wiring phase.
- CM-03 version history; CM-04 deep configuration; CM-05..CM-08 lifecycle.

### Activation conditions

1. Owner-approved Integrator phase.
2. Persistence + tenant RLS design for template catalog (if durable).
3. Explicit dual-write or cutover plan from legacy modes/presets.
4. Regression coverage for UI/API paths.
5. No silent replacement of production `tournamentService` without approval.
