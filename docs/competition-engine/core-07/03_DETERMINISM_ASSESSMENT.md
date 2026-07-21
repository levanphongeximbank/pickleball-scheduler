# CORE-07 — Determinism Assessment

**Phase:** 1A
**Baseline:** `fb9f482434639621d465cbc35b80e085fb82f383`

---

## 1. Definitions

| Concept | Determinism requirement |
|---------|-------------------------|
| **Competition seeding** | Same candidate snapshots + policy + optional `deterministicSeed` ⇒ same seed numbers |
| **Deterministic random seed** | Explicit PRNG seed for reproducible shuffle/ties — **not** a competition seed number |
| **Draw / grouping** | May use competition seeds as input; open/random modes need injected RNG, never bare `Math.random` in core |

---

## 2. Surface-by-surface assessment

| Surface | Deterministic? | Risks | Notes |
|---------|----------------|-------|-------|
| Phase 3G `seeding/**` | **Yes** (by design) | Low | No `Math.random`; Mulberry32 only if `deterministicSeed` set; fixed default clock; identity-key total order |
| CC-04B `seed/**` | **Mostly** | Medium | No `Math.random`; equal scores with no distinguishing tie key → comparator `0` (engine-sort unstable relative order) |
| TE `seedEngine` | **Yes** for sort | Low–Med | Stable compare with `"vi"` locale; audit IDs elsewhere use `Date.now` (metadata only) |
| `assignSeedsToEntries` | **Yes** if ratings unique | Medium | Equal ratings → unstable relative order (no secondary key) |
| `teamGroupSeedEngine` sort | **Yes** | Low | Tie → `localeCompare` on id (no locale — OK for ids) |
| `shuffleTeamsForOpenDraw` | **No** (default) | **High** | Default `randomFn = Math.random`; sets `seed: 0` |
| `tournament.seeding.logic` open | **No** (default) | **High** | `shuffleArray(..., Math.random)` |
| `seededGroupEngine` | Partial | Medium | Placement via C4; group ids `Date.now()` |
| `aiDrawSeedAudit` | N/A | High if treated as SSOT | Generates draw RNG seeds via crypto/`Math.random`/`Date.now` |
| Draw-runtime pot merge | **Yes** | Low | Lexicographic tier keys; consumes opaque assignments |

---

## 3. Forbidden / unstable patterns found (adjacent to seeding)

### 3.1 `Math.random` / shuffle

| Location | Pattern | Impact on competition seeding |
|----------|---------|-------------------------------|
| `tournament.seeding.logic.js` | `shuffleArray` default `Math.random` | Open pairing/groups non-reproducible |
| `teamGroupSeedEngine.shuffleTeamsForOpenDraw` | Fisher–Yates with `Math.random` | Open team order non-reproducible; clears meaningful seed numbers (`seed: 0`) |
| `aiDrawSeedAudit.createAiDrawRandomSeed` | crypto or `Math.random` | Creates **deterministic-random seed** for draw engines — separate concept |

**CORE-07 rule:** Competition seeding core must never call `Math.random`. Open shuffle belongs to Format/draw with injected seeded RNG.

### 3.2 `Date.now`

| Location | Use | Impact |
|----------|-----|--------|
| `seededGroupEngine` group ids | Timestamp ids | Non-stable identifiers across runs |
| `ratingV5SeedAdapter` / AI audit | Audit / metadata ids | Does not change seed numbers if excluded from assignment input |

### 3.3 Unstable ordering

| Risk | Where | Mitigation for CORE-07 |
|------|-------|------------------------|
| Equal comparator returns 0 | CC-04B score ties; `assignSeedsToEntries` equal ratings | Require total order: identity key / explicit `deterministicTieKey` |
| Locale-sensitive names | TE uses `"vi"` for display names | Prefer opaque identity keys in CORE-07 (3G already does) |
| `Object.keys` / Map insertion order | Not observed as primary seed sort key in 3G | Keep sorting on explicit arrays |

---

## 4. Phase 3G deterministic design (reference)

From `seeding/services/`:

- `tieBreak.js` — documented: never `Math.random`.
- `deterministicRandom.js` — Mulberry32 / FNV when seed provided; core must never call `Math.random`.
- `deterministicOrdering.js` — delegates to tie-break.
- Default clock: fixed epoch ISO (not wall clock).

This matches CORE-06 Phase 1D deterministic-random **pattern** (seeded PRNG, fail-closed on missing seed for random paths) but must remain a **separate** utility from competition seed numbers. Do not merge lineup RNG and seeding engines.

---

## 5. Missing-score and unseeded semantics (determinism-adjacent)

| Policy | TE `seedEngine` | Phase 3G | CC-04B |
|--------|-----------------|----------|--------|
| Missing rating | Defaults (700 / winRate 0.5) | Nulls sort last | Component = 0 |
| New / low-data | May leave `seed: null` (unseeded pool) | Always assigns among eligible | Always ranks |
| Equal metrics | `"vi"` name | Identity key | May be unstable if no tie key |

**Migration risk:** Switching production TE → 3G changes published brackets if defaults vs nulls-last vs unseeded pools differ. Phase 1B must freeze the policy; Phase later needs shadow parity (CC-04E pattern).

---

## 6. Withdrawn / DQ / ineligible (ordering population)

Determinism of seed lists also depends on **who is admitted**:

| Surface | Filter |
|---------|--------|
| TE | Local status set |
| 3G | `eligible` flag + noop policy |
| CC-04B | None |
| CORE-03 / CORE-01 | Canonical eligibility — **not wired** |

If admission filters diverge, identical rating inputs still produce different seed maps. See `04_RULE_ENGINE_DEPENDENCY_AUDIT.md`.

---

## 7. Determinism verdict for CORE-07

| Question | Answer |
|----------|--------|
| Is Phase 3G suitable as deterministic CORE-07 core? | **Yes**, with eligibility ports still missing |
| Is production seeding fully deterministic today? | **No** — open modes and some equal-rating sorts |
| May CORE-07 own open shuffle? | **No** — draw/Format with injected RNG |
| May CORE-07 use wall-clock in assignment? | **No** |
| Recommended Phase 1B stance | Freeze 3G total-order + optional `deterministicSeed` for ties; forbid `Math.random` / `Date.now` in CORE-07 assignment path |
