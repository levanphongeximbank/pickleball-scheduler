# CORE-04 — Division & Category Foundation (Phase 1)

**Status:** Phase 1 implemented (capability branch)
**Module:** `src/features/competition-core/classification/`
**OD-07:** Division and Category remain separate definition entities.

---

## 1. Canonical three-entity model

| Entity | Kind | Purpose |
|--------|------|---------|
| **CompetitionCategory** | Definition | Condition classification (gender, access, eligibility descriptors, applicability) |
| **CompetitionDivision** | Definition | Progression / pool branch (standings, draw zone, group bảng) |
| **CompetitionDivisionCategory** | Runtime lane | Explicit association of **exactly one** Division + **exactly one** Category |

`CompetitionDivisionCategory.id` (and deterministic `key`) is the stable **divisionCategoryId** consumed by registration, entries, draw, match generation, schedule, court assignment, scoring, standings, awards, publication, and audit.

OD-07 is preserved: Division and Category are never merged into one polymorphic classification field. DivisionCategory is their explicit runtime join.

---

## 2. Glossary

| Term | Meaning |
|------|---------|
| Category | What kind of contest / condition class |
| Division | Competitive subdivision / pool / progression branch |
| DivisionCategory | The operable competition lane (Division × Category) |
| Eligibility descriptor | Configuration data only (bands, refs) — not an evaluator |
| Capacity (authoritative) | Owned by DivisionCategory |

---

## 3. Module ownership

```text
src/features/competition-core/classification/
  categories/
  divisions/
  division-categories/
  contracts/
  enums/
  errors/
  keys/
  validators/
  mappers/
  ports/
  index.js          ← capability-local public surface ONLY
```

**Core-04 owns** this tree.

**Does not own:** Participant identity, Entry/Registration persistence, Rule evaluation, Team/Roster, UI, SQL.

**Must not edit in this capability PR:** protected barrels (`competition-core/index.js`, `participants/*/index.js`, `unit-test-files.json`, architecture-lock scripts, `package.json`).

`participants/contracts/divisionCategory.js` is left unchanged. Integrator relocates/re-exports later.

---

## 4. Lifecycle state machines

### Definition (Category / Division)

```text
DRAFT → ACTIVE → ARCHIVED
```

- ARCHIVED is read-only.
- No hard-delete when references exist (archive instead).

### DivisionCategory (lane)

```text
DRAFT → OPEN
OPEN  → LOCKED | CLOSED | DRAFT*
LOCKED → CLOSED
CLOSED → ARCHIVED
ARCHIVED → ∅
```

\* `OPEN → DRAFT` only when an injected reference checker reports no blocking refs **and** an audit reason is provided.

Forbidden: `LOCKED → OPEN`, any transition from `ARCHIVED`, silent skip transitions.

| Status | Registration | Config mutation |
|--------|--------------|-----------------|
| DRAFT | Reject (`NOT_OPEN`) | Allowed |
| OPEN | Accept | Allowed |
| LOCKED | Reject (`LOCKED`) | Structural / capacity / eligibility rejected |
| CLOSED | Reject (`CLOSED`) | Config rejected |
| ARCHIVED | Reject (`ARCHIVED`) | Fully read-only |

---

## 5. Deterministic keys

Codes are normalized by `normalizeClassificationCode` (shared by all key builders and duplicate detection):

1. Reject non-strings.
2. Unicode NFC normalize.
3. Trim leading/trailing whitespace.
4. Lowercase with `toLowerCase()` (never locale-dependent).
5. Map runs of whitespace / `_` / `-` / `.` to a single `_`.
6. Strip leading/trailing `_`.
7. Accept only `[a-z0-9_]+`.

Semantically equivalent codes collide within a competition, e.g.
`MEN_DOUBLE`, `men-double`, `" men double "`, `men__double`, `men---double` → `men_double`.

```text
categoryKey         = `${competitionId}|category|${normalizedCategoryCode}`
divisionKey         = `${competitionId}|division|${normalizedDivisionCode}`
divisionCategoryKey = `${competitionId}|division-category|${normalizedDivisionCode}|${normalizedCategoryCode}`
```

No timestamps, UUIDs, locale sorts, labels, or ordinal fallbacks. Duplicate normalized codes fail closed.

---

## 6. Capacity ownership

| Entity | Capacity role |
|--------|----------------|
| DivisionCategory | **Authoritative** `maxEntries`, `maxWaitlist`, `minEntriesToRun`, hard `quotaByParticipantType` |
| Category | Recommended / default only |
| Division | Pool-size / progression metadata only |

Rules:

- Negative / non-integer counts → `CLASSIFICATION_INVALID_CAPACITY`
- `minEntriesToRun` must not exceed `maxEntries`
- `quotaByParticipantType` is **hard** capacity metadata
- Sum of hard quotas must not exceed `maxEntries` when `maxEntries` is defined
- Registration acceptance uses DivisionCategory capacity exclusively (no allocation engine in Phase 1)

---

## 7. Eligibility ownership boundary

Core-04 may declare descriptors:

- `participantType`, `genderClass`, `ageBand`, `ratingBand`, `skillBand`
- `teamSize`, `rosterSize`, `access`
- `eligibilityPolicyRef`, `restrictionPolicyRef`

Core-04 **must not** evaluate player/pair/team eligibility.

### Core-01 contract (port)

Public method name: **`evaluateEligibility(request)`** (not `evaluateEvaluation`).

```text
EligibilityEvaluationPort.evaluateEligibility({
  tenantId, competitionId, divisionCategoryId,
  eligibilityDescriptor | eligibilityPolicyRef,
  participantOrEntryRef, context?
}) → {
  decision: 'accepted' | 'rejected',
  rejectionCodes[], ruleEvaluationRefs[], audit?, details?
}
```

Rejected results map to `CLASSIFICATION_ELIGIBILITY_REJECTED`.

---

## 8. OPEN → DRAFT fail-closed rule

Requires:

1. Non-empty audit reason
2. Injected `referenceChecker.getReferenceSnapshot()`
3. Snapshot fields (all required non-negative integers):
   - `entryCount`
   - `reservationCount`
   - `drawCount`
   - `matchCount`
4. All counts must be `0`

Missing checker, thrown checker, `undefined`/incomplete snapshot, or any count `> 0` rejects the transition. An unavailable checker is **never** treated as zero references.

---

## 9. Core-02 Entry contract (identifiers only)

Entries / registrations should reference:

- `divisionCategoryId` (stable lane id) — preferred for runtime
- Optional legacy mirrors: `divisionId`, `categoryId` during strangler

Core-04 does not create entries or migrate them silently (`CLASSIFICATION_SILENT_MIGRATION_FORBIDDEN`).

---

## 10. Tenant and competition isolation

All three entities require `tenantId` + `competitionId`.

Reject: missing ids, cross-tenant joins, cross-competition joins, Category/Division from different competitions, first-tenant/competition fallbacks.

---

## 11. Legacy compatibility mapping (pure, no writes)

| Legacy | Mapper |
|--------|--------|
| `EVENT_TYPE` | `mapEventTypeToCategory` |
| Individual `group` | `mapGroupToDivision` |
| TT `categoryType` + `genderRequirement` | `mapTtDisciplineToCategory` |
| TT team group | `mapTtTeamGroupToDivision` |

Adapters use **local** canonical mapping tables. They do not import UI, eligibility engines, draw/schedule/scoring runtimes, or team-tournament engines. Unknown values yield structured warnings.

No Production cutover in Phase 1. No persistence adapter in Phase 1.

---

## 12. Protected-file restrictions & Integrator follow-ups

Capability branch must not touch Integrator-protected files.

**Later Integrator PR should:**

1. Export selected classification symbols from `competition-core/index.js` (or a dedicated public path).
2. Add `tests/competition-core-classification-core04.test.js` to `scripts/ci/unit-test-files.json`.
3. Optionally deprecate / shim `participants/contracts/divisionCategory.js` toward classification factories.
4. Wire Core-02 Entry to prefer `divisionCategoryId`.
5. Register Core-01 eligibility port implementation (`evaluateEligibility`).

---

## 13. Phase 2 persistence recommendations

- Port methods already listed: Category / Division / DivisionCategory repositories (`getById`, `listByCompetition`, `save`, `archive`, `findByDivisionAndCategory`).
- Prefer soft-archive; never hard-delete referenced rows.
- Unique indexes: `(tenant_id, competition_id, normalized_code)` for definitions; `(tenant_id, competition_id, division_id, category_id)` for lanes.
- List queries must apply deterministic order: `display_order`, `code`, `key`, `id`.
- No Production SQL apply in Phase 1.

---

## 14. Hierarchy

Phase 1 is **flat**. No `parentCategoryId` / `parentDivisionId`.
