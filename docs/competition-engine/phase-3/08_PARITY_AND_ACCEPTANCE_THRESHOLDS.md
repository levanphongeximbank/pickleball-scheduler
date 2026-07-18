# 08 — Parity and Acceptance Thresholds

**Status:** Design only  
**Rule:** One deep-equal for the whole system is forbidden. Comparators are **per capability**.

---

## Classification levels

| Level | Meaning |
|-------|---------|
| EXACT | Stable hashes equal after normalization |
| SEMANTIC_MATCH | Business-equivalent (order-independent where allowed) |
| EXPECTED_DIFFERENCE | Documented format extension / policy difference |
| WARNING | Unexpected but non-blocking drift |
| FAILURE | Material mismatch |
| BLOCKER | Safety/integrity violation (identity collision, duplicate entry, data loss) |
| NOT_COMPARABLE | Missing context / non-deterministic without seed |

Compatible with Phase 2B.3 labels (`EXPECTED_FORMAT_EXTENSION`, `MAPPING_WARNING`, etc.) — Phase 3 normalizes naming above.

---

## Parity record schema

```text
requestId
tenantId
competitionId
format
capability
legacyVersion
canonicalVersion
adapterVersion
comparatorVersion
inputHash
legacyOutputHash
canonicalOutputHash
classification
differences[]          # field paths + codes; redacted
diagnostics
durationLegacyMs
durationCanonicalMs
createdAt
```

Prefer hashes and stable IDs. Do not store unnecessary PII.

---

## Capability thresholds (proposal)

### Participant resolution

```text
100% identity equivalence on active participants
0 unresolved active participant when legacy resolved
0 collision (players.id ↔ athletes.id ↔ profiles.player_id)
0 guest loss
Blocker rate: 0 over gate window
```

### Registration and Entry

```text
100% competitionId preserved
100% waitlist behavior preserved
0 duplicate active Entry
0 status downgrade (approved → pending etc.)
EXACT on status machine transitions for sampled set
```

### Roster and Lineup

```text
100% member identity parity
100% captain parity
100% lock parity
100% revision parity
0 hidden-lineup exposure to unauthorized actors
```

### Seeding

```text
Deterministic modes: EXACT seed order given same seed context
Policy modes: SEMANTIC_MATCH on seed ranks
Blocker: seed drift after lock
```

### Draw, Pairing, Schedule

| Subtype | Comparator |
|---------|------------|
| Exact deterministic | EXACT structure after normalization |
| Semantically equivalent | Same participants/groups/edges; order may differ |
| Policy-equivalent structurally different | EXPECTED_DIFFERENCE with documented policy id |

Non-deterministic schedules without shared seed → NOT_COMPARABLE (must inject seed).

### Match lifecycle / Scoring

```text
EXACT score tuples and lifecycle state
0 illegal transitions
Result validation decisions SEMANTIC_MATCH
```

### Standings / Tie-break

```text
EXACT ordered standings for locked policy profile
Mini-table / H2H steps SEMANTIC_MATCH
WARNING allowed only for documented display-only fields
```

### Publication

```text
EXACT publish/lock flags
Snapshot hash match for published artifacts
```

---

## Minimum gate windows (before cutover)

| Capability | Min executions | Min competitions | Min tenants | Min days | Blockers | Warning rate | Fallback rate |
|------------|----------------|------------------|-------------|----------|----------|--------------|---------------|
| Participant | 500 | 10 | 2 | 7 | 0 | <1% | n/a |
| Registration/Entry | 200 | 5 | 2 | 7 | 0 | <2% | n/a |
| Roster/Lineup | 200 | 5 | 1 TT | 7 | 0 | <1% | n/a |
| Seed/Draw | 100 | 5 | 2 | 14 | 0 | <3% | n/a |
| Pairing/Match gen | 100 | 5 | 2 | 14 | 0 | <5% semantic | n/a |
| Schedule | 100 | 5 | 2 | 14 | 0 | <5% | n/a |
| Lifecycle/Scoring | 300 | 5 | 2 | 14 | 0 | <1% | <0.5% |
| Standings | 300 | 8 | 2 | 14 | 0 | <2% | n/a |
| Publication | 50 | 5 | 2 | 7 | 0 | <1% | n/a |

CI green alone is **not** sufficient.

---

## Cutover gates (every capability)

```text
Canonical implementation complete
Public contract stable
Repository implementation tested
Architecture lock PASS
Unit tests PASS
Integration tests PASS
Shadow parity threshold reached
Performance threshold reached (p95 canonical ≤ budget)
Security review PASS
Rollback tested
Kill switch tested
Pilot approved
Owner GO
```
