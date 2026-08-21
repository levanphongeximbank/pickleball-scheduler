# ADR — Canonical Competition Rules & Format / Adapter A

## 1. Why this belongs in Competition Platform

Competition Rules & Format is shared policy/configuration for every tournament mode
(Official / Internal / Team / Daily). It sits under Competition Platform as a
canonical policy capability consumed by existing Competition Core execution
authorities — not as a mode UI feature and not as a new numbered cross-domain
adapter catalog entry.

## 2. Why CORE-01 is reused

CORE-01 (`src/features/competition-core/constraints/**`) already owns:

- `RULE_SOURCE` / `RULE_SOURCE_PRIORITY`
- `RULE_OPERATION`
- deterministic resolution (`resolveRulesDeterministic`)
- applicability, conflict/suppression, resolution trace

This workstream **extends** that foundation via composition
(`composeCore01AuthorityContext`) for authority/operation vocabulary.
It does **not** create a second generic Rules Engine or parallel rule SSOT.

CORE-01 remains the constraint-resolution engine. This module owns the
Competition Rules **Profile** (scoring format, group/qualification, locks, etc.).

## 3. Why not Contract #17

The frozen catalog of **16** Canonical Competition Adapter Contracts remains
unchanged (`OFFICIAL_CONTRACT_COUNT = 16`). Adapter A identity is:

- `competition.rules.policy.gateway.v1`

Internal Competition Platform policy gateway — analogous in *role* to how
mode Adapter B policy translators describe policy without becoming catalog
ordinals for every domain concern. Catalog #07/#08/#01 are untouched.

## 4. Shared vs mode-specific

**Shared:** competition unit, match scoring, win condition, change-end policy,
group stage, qualification (total/direct/wildcard slots), in-group tie-break,
cross-group wildcard ranking policy, knockout policy, walkover/retired/withdrawal
policy, check-in policy, schedule constraints, court/referee *requirements*,
publication policy, lifecycle mutation locks, capability truth.

**Mode-specific (Adapter B later):** public registration/fee (Official), club
membership eligibility (Internal), roster/Dreambreaker/lineup lock (Team),
casual session defaults (Daily).

## 5. Consuming authorities

| Policy | Execution |
|--------|-----------|
| Scoring format | CORE-16 |
| Referee requirement | CORE-13 |
| Court requirement policy | competition-core.competition-rules (this module) |
| Court assignment execution | CORE-12 |
| Physical court SSOT (`physicalCourtId`) | 2.2_COURT_OPERATIONS |
| Adapter A court role | integration/projection — not physical court SSOT |
| Schedule constraints | Schedule engine / CORE-11 |
| Tie-break criteria | CORE-18 |
| Cross-group wildcard ranking | Policy here; execution DEFERRED until CORE-18 composition |
| Qualification plan | CE composition + CORE-18 (selects entries) |
| Publication | CM publication + CORE-17 for accepted results |
| Lifecycle locks (gate) | CORE-15 provides lifecycle evidence only |

Tenant ≠ Venue. Venue / Facility / Court Cluster ≠ Physical Court.

## 6. Mode Adapter B integration (document only)

```
Mode input → Adapter B (translate/constrain/compose)
  → Adapter A policy gateway
  → shared policy services + CORE-01 composition
  → existing execution authorities
```

Adapter B must not redefine shared semantics or become scoring/standings/
referee/court/lifecycle authority.

## 7. Fail-closed unsupported features

Capability matrix separates `POLICY` vs `EXECUTION` axes.

- `CHANGE_END`: policy `SUPPORTED`, execution `PARTIAL` (CE `confirmChangeEnds`
  orientation-swap path exists; referee-v5 remains hint-only — not globally SUPPORTED).
- `CROSS_GROUP_WILDCARD_RANKING`: policy `SUPPORTED`, execution `DEFERRED`.
  Configured only when `groupStageEnabled` and `wildcardSlots > 0` — not merely
  because the profile schema carries a default `crossGroupRanking` object.
  Deferred optional demand must not make unrelated valid profiles globally infeasible.
  Authoritative ranking requests fail closed while execution is unavailable.

Gateway rejects fake operational claims; `enforceExecutionCapability` fails closed
for DEFERRED/UNSUPPORTED configured capabilities.

## 8. Lifecycle locks

`canMutateCompetitionRule` maps rule classes → milestones
(e.g. scoring format locks after `AFTER_MATCH_START`). Returns structured
codes. Does not mutate CORE-15.

## 9. Adapter A = internal policy gateway

Stable mode-agnostic interface: normalize, validate, resolve effective rules,
derive qualification, expose capability truth. No persistence/execution
authority. No Official/Internal/Team/Daily logic.

## 10. No duplicate persistence/execution

No new rules table. No second scoring/standings/referee/court/lifecycle/result
engine. Effective rules are derived.
