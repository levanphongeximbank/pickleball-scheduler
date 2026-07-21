# CORE-07 — Deterministic Ordering Contract

**Phase:** 1B Architecture Freeze
**Comparison contract version:** `core07-compare-v1`
**Status:** Contract design only — no production implementation

---

## 1. Purpose

Define a **deterministic total-order** algorithm for competition seed assignment such that:

> Same normalized deterministic inputs ⇒ same ordered assignments and same deterministic fingerprint.

If deterministic randomization is needed later for **unseeded draw placement**, it belongs to the **downstream Draw module**, not CORE-07.

---

## 2. Prohibited inside canonical assignment

| Prohibited | Reason |
|------------|--------|
| `Math.random()` | Non-reproducible |
| `Date.now()` | Wall-clock |
| `new Date()` without explicit caller input | Wall-clock |
| `localeCompare` without frozen comparison contract | Locale/runtime drift |
| Database default ordering | Non-portable |
| Mutable global state | Hidden inputs |
| Implicit array order as final tie-break | Order-dependent output |
| Asynchronous completion order | Race-dependent |

Input array order **must not** affect results when all required tie-break fields (including `stableCanonicalId`) are supplied.

---

## 3. Algorithm overview

```text
1. Normalize & validate inputs
2. Detect duplicate candidates → fail closed
3. Partition: excluded / override-locked / auto-order pool
4. Apply validated manual overrides (no silent conflicts)
5. Total-order the auto-order pool
6. Assign remaining free seed numbers in order
7. Build result + deterministic fingerprint
```

---

## 4. Step detail

### 4.1 Input normalization

1. Freeze request copy; reject unknown critical fields per contract version.
2. Normalize each candidate (doc 08 §4.2).
3. Normalize policy (`tieBreakSequence`, directions, missing-value mode).
4. Bind snapshot subject values onto candidates **by identity** (not by array index).
5. Confirm `deterministicContext.comparisonContractVersion === "core07-compare-v1"` (or supported alias list).
6. Confirm `effectiveAt` present and caller-supplied.

Any use of unspecified time or unstable identity → `NON_DETERMINISTIC_INPUT`.

### 4.2 Manual override precedence

1. Validate all overrides first (doc 12). Any hard conflict → reject override and/or fail per policy; **never silently pick a winner**.
2. Applied `ASSIGN` / `PROTECT` overrides reserve their `requestedSeedNumber`.
3. Overridden entries are **removed** from the auto-order pool.
4. Auto-order fills **remaining free** seed numbers from `seedNumberStart` upward (skipping reserved numbers), up to `maximumSeededEntries` if set.

Override precedence is **not** “sort overrides into the ranking”; it is **slot reservation** then auto-fill.

### 4.3 Primary ranking/rating ordering

Using `SeedingPolicy.primaryOrderingSource` and `sortDirection`:

| Source | Typical default direction | Notes |
|--------|---------------------------|-------|
| `RANKING_POSITION` | ASC (1 is better) | Lower position wins when ASC |
| `RATING_VALUE` | DESC | Higher rating wins when DESC |
| `RANKING_SCORE` | DESC | Higher score wins when DESC |
| `REGISTRATION_TIMESTAMP` | ASC | Earlier registration wins when ASC |

Primary compare uses only snapshot-backed (or explicitly provided) values — never recalculated ratings.

### 4.4 Configured tie-break sequence

After primary equality, apply `tieBreakSequence` in order. Each entry names a field + optional direction override; default directions follow policy table for that field type.

Unsupported field name → `INVALID_TIE_BREAK`.

### 4.5 Missing-value ordering

Per `missingValueBehaviour`:

| Mode | Behaviour |
|------|-----------|
| `SORT_LAST` | Missing sorts after all present values (regardless of ASC/DESC of present values’ magnitude compare) |
| `SORT_FIRST` | Missing sorts before all present values |
| `EXCLUDE` | Candidate moved to eligible-unseeded or excluded per policy detail |
| `FAIL` | Fail closed (`SNAPSHOT_INCOMPLETE` or candidate-level failure) |

**CORE-07 default recommendation (frozen preference):** `SORT_LAST` for ranking/rating misses — aligned with Phase 3G nulls-last; **do not** adopt TE synthetic defaults (700) inside CORE-07.

### 4.6 Final stable canonical ID tie-break

If all configured fields equal, compare `stableCanonicalId` with **`core07-compare-v1` string rules** (below). This step is **mandatory**.

#### Comparator zero semantics (Owner freeze)

| Case | Required result |
|------|-----------------|
| Same canonical candidate identity (reflexive: `compare(A, A)`) | May / must return **`0`** |
| Two **distinct** valid candidates (different `stableCanonicalId`) | Must produce a **non-zero** result after the final `stableCanonicalId` comparison |
| Duplicate `stableCanonicalId` in the candidate set | **Must be rejected** during candidate validation **before** sorting → `DUPLICATE_CANDIDATE` |

The comparator is therefore a total order over the **validated distinct-identity** candidate set. It is **not** required to return non-zero for identical operands.

#### Algebraic properties (required)

Over the set of validated candidates with unique `stableCanonicalId`:

1. **Reflexive:** `compare(A, A) === 0`
2. **Antisymmetric:** if `compare(A, B) < 0` then `compare(B, A) > 0`; if `compare(A, B) === 0` then A and B are the same canonical identity
3. **Transitive:** if `compare(A, B) <= 0` and `compare(B, C) <= 0` then `compare(A, C) <= 0` (and likewise for the strict order induced on distinct identities)

Returning `0` for two distinct validated candidates is a **contract violation** (should be unreachable if duplicate IDs were rejected).

### 4.7 Stable comparison rules (`core07-compare-v1`)

#### Numbers

- Only finite IEEE numbers participate as numbers.
- `NaN` / `Infinity` treated as **missing** at normalization time.
- Numeric compare: standard `<` / `>` on finite values.
- No locale, no stringifying numbers for primary numeric fields.

#### Strings

- Compare UTF-16 code unit order (ECMAScript `<` / `>` on strings) after normalization:
  - Reject or fail if string contains unpaired surrogate when policy requires strict Unicode (default: compare as JS string code units for stability across engines that share ES string semantics).
  - **Do not** use `localeCompare`.
  - **Do not** case-fold unless policy explicitly adds a `CASEFOLD_ASCII` pre-step (opt-in, documented).
- Empty string is a present value, not missing (unless field marked optional-null only).

#### Timestamps

- Caller must supply comparable form: integer epoch milliseconds **or** canonical ISO-8601 UTC string with `Z`.
- Mixed forms in one field → `NON_DETERMINISTIC_INPUT` / `INVALID_CANDIDATE`.
- Compare numerically when epoch ms; lexicographically when both canonical ISO UTC.

#### Booleans / enums

- Fixed ordinal maps defined on the contract version (e.g. eligibility enums are **not** ordering keys by default).

### 4.8 Duplicate candidate detection

Before ordering:

- Duplicate `entryId` → `DUPLICATE_CANDIDATE` (fail closed).
- Duplicate `stableCanonicalId` → `DUPLICATE_CANDIDATE` (fail closed).
- Duplicate subjectRef within same entryType scope when policy requires unique subjects → fail closed.

### 4.9 Fingerprint calculation inputs

**Included in `deterministicFingerprint` (assignment fingerprint):**

- Contract version ids (`core07-seeding-contracts-v1`, `core07-compare-v1`)
- Full `SeedingScope`
- Normalized candidate identity + ordering-relevant fields + eligibility status
- Policy id/version + normalized policy ordering fields
- Snapshot id + snapshot checksum/fingerprint + completeness state
- Applied overrides (ids, entryIds, seed numbers, actions) that affected assignments
- Ordered `SeedAssignment` list (entryId, seedNumber, assignmentSource, orderedTieBreakValues, reasonCodes)

**Excluded by default:**

- `generatedAt`
- Actor display names
- Warning message text (codes may be included if they affect acceptance — prefer excluding soft warnings)
- Non-ordering `sourceMetadata` blobs

Fingerprint algorithm (Phase 1C): canonical JSON serialization of the included object with sorted keys + stable hash (e.g. SHA-256 hex). Exact hash function fixed in Phase 1C implementation plan; must be identical across platforms for the same canonical bytes.

### 4.10 Re-run equivalence requirements

Two runs are equivalent when:

1. Normalized inputs (per above included set) are byte-identical under canonical serialization, and
2. `orderedAssignments` are identical (entryId ↔ seedNumber ↔ sources), and
3. `deterministicFingerprint` is identical.

Equivalence **does not** require identical `generatedAt` or identical non-fingerprint audit wrappers.

---

## 5. Seed number assignment after order

Given total order `C1, C2, …` of auto-order pool and reserved seed set `R` from overrides:

```text
next = seedNumberStart
for each candidate in order:
  while next in R: next += 1
  if maximumSeededEntries reached: place remaining in eligibleUnseeded; break
  assign seedNumber = next; R.add(next); next += 1
```

Invariants:

- `seedNumber >= 1` (and `>= seedNumberStart`)
- Unique within scope/result
- Ineligible never assigned

---

## 6. Relationship to Phase 3G tie-break

Phase 3G today: ranking ASC → rating DESC → sourcePriority → optional deterministic PRNG key → identity ASC.

CORE-07 freeze:

- Keep **total order + identity final tie-break**.
- Make primary source and tie-break sequence **policy-driven**.
- Prefer **no PRNG** in competition seeding; optional `deterministicTieSeed` only if Owner later enables and Draw does not own the shuffle.
- Adapt Phase 3G `compareCandidatesForSeed` to this contract rather than copying blindly.

---

## 7. Non-goals

- Open shuffle / `seed: 0` pools → Draw
- Random-in-band placement → Draw
- Locale-aware name sorting for display → UI only, never assignment
