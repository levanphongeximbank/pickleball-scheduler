# Knockout Admission Policy Extension

**Module:** `src/features/competition-core/competition-rules/`  
**Versions:** domain / contract / Adapter A `1.1.0` (schema IDs remain `*.v1`)  
**NEW_BYE_ENGINE=DENY** · **FAKE_BYE_WINNER=DENY** · **PHANTOM_RESULT=DENY**

## Distinctions (hard lock)

| Concept | Meaning |
|---------|---------|
| GROUP_STAGE_BYPASS | Unit excluded from group-stage participation |
| DIRECT_KNOCKOUT_ENTRY | Unit admitted to knockout without group standings qualification |
| KNOCKOUT_BYE | Admitted unit skips one knockout round via bracket BYE |
| SEEDING | Ordering/placement only — never implies direct admission |

## Qualification formula

```
totalKnockoutSlots
  = directKnockoutEntrySlots
  + groupDirectQualifierSlots
  + wildcardSlots

groupDirectQualifierSlots = groupCount × directQualifiersPerGroup
```

Backward-compatible: `totalQualifiers` aliases `totalKnockoutSlots`;
`directSlots` aliases `groupDirectQualifierSlots`.

## Profile shape (additive)

```js
qualification: {
  totalKnockoutSlots,      // preferred
  totalQualifiers,         // alias
  directQualifiersPerGroup,
  directKnockoutEntryCount,
}

knockoutAdmission: {
  groupStageBypass: { enabled, entrants: [{ entryId }] },
  directKnockoutEntry: {
    enabled, count, sourceCategory, targetStage,
    entrants: [{ entryId, sourceCategory?, targetStage?, seedNumber? }],
  },
  bye: {
    byePolicy,             // CORE-09 default NONE; EXPLICIT_PLACEMENTS|… when active
    allocationShape,       // null when bye disabled (dormant); certified shape when active
  },
}
```

Canonical identity: `entryId` (seeding/standings vocabulary).  
`participantId` accepted as synonym. `displayName` forbidden as identity.

`directKnockoutEntry.targetStage` uses `KNOCKOUT_ENTRY_ROUND` vocabulary and is
**not** the same field as bracket-wide `knockout.entryRound`.

**Distinctions (hard lock):**

- `DIRECT_ENTRY_IMPLIES_BYPASS=NO` — direct entrants are NOT auto-merged into bypass.
- `EXPLICIT_DIRECT_AND_BYPASS_OVERLAP_ALLOWED=YES` — same `entryId` may appear in both lists only when explicitly listed in both.
- Group-participant conflict applies to **explicit bypass** only.

**Direct-entry target stage:**

- Required (via policy default or per-entrant) when direct entry is configured.
- Must be compatible with bracket-wide entry round (same or later stage).
- Example: `totalKnockoutSlots=8` → `QUARTERFINAL` bracket; allow `QUARTERFINAL|SEMIFINAL|FINAL`; reject `ROUND_OF_16|ROUND_OF_32`.
- First-playable execution (`effectiveTargetStage == bracketWideEntryRound`) is
  supported on certified group-stage and no-group paths. Later-stage DIRECT
  remains `DEFERRED`.

## Later-stage DIRECT slot accounting

Canonical Competition Rules derives immutable admission constraints only.
Placement remains CORE-08 authority and match dependencies remain CORE-09
authority.

```text
FINAL_REQUIRED_SLOTS = 2

PREVIOUS_STAGE_REQUIRED_SLOTS
  = 2 × (
      NEXT_STAGE_REQUIRED_SLOTS
      - NEXT_STAGE_DIRECT_RESERVATIONS
    )
```

The calculation walks backward from `FINAL` through the existing
`KNOCKOUT_ENTRY_ROUND_ORDER` to `bracketWideEntryRound`.

The derived admission plan exposes:

```js
laterStageDirect: {
  enabled,
  bracketWideEntryRound,
  accountingDirection: "BACKWARD_FROM_FINAL",
  finalRequiredSlots: 2,
  reservationsByStage,
  requiredEntrantsByStage,
  firstPlayableRequiredEntrants,
  firstPlayableDirectEntryCount,
  firstPlayableDirectSlotCount,
  laterStageDirectEntryCount,
  laterStageDirectSlotCount,
  resolvedDirectEntryCount,
  unresolvedDirectSlotCount,
  configuredDirectSlotCount,
  reservationAccountingComplete: true,
  topologyValid,
  admissionOnly: true,
  placementIncluded: false,
}
```

`reservationsByStage` contains all configured DIRECT slots targeting a stage
strictly later than `bracketWideEntryRound`. Resolved entrants use their
`effectiveTargetStage`; unresolved slots use the required unambiguous policy
`targetStage` without inventing an `entryId`. A DIRECT slot targeting the
bracket-wide round remains first-playable and is counted by
`firstPlayableDirectSlotCount`.

The accounting invariant is:

```text
sum(later-stage reservationsByStage)
  + firstPlayableDirectSlotCount
  = configuredDirectSlotCount

configuredDirectSlotCount
  = resolvedDirectEntryCount + unresolvedDirectSlotCount
```

Execution continues to deny unresolved DIRECT identities.

Fail-closed constraints:

- At every stage, `DIRECT_RESERVATIONS(stage) <= REQUIRED_SLOTS(stage)`.
- Duplicate `entryId`, invalid/unknown target stage, or a target earlier than
  `bracketWideEntryRound` is rejected.
- Negative, non-integer, over-capacity, or otherwise impossible backward
  topology is rejected without repair.
- Overflow is never converted to BYE, wildcard, earlier-stage participation,
  fake match, or fake winner.
- DIRECT defines admission stage only. It does not imply seed, BYE, slot
  number, bracket half, side, match ID, or dependency.
- The formula is mode-neutral for group-stage and no-group competitions.

Examples:

```text
A. bracketWideEntryRound=QUARTERFINAL, reservations SEMIFINAL=2, FINAL=0
   FINAL=2 → SEMIFINAL=4 → QUARTERFINAL=4

B. bracketWideEntryRound=SEMIFINAL, reservations FINAL=1
   FINAL=2 → SEMIFINAL=2

C. bracketWideEntryRound=ROUND_OF_16,
   reservations QUARTERFINAL=2, SEMIFINAL=1, FINAL=0
   FINAL=2 → SEMIFINAL=4 → QUARTERFINAL=6 → ROUND_OF_16=8
```

Capability after this policy phase:

- Later-stage DIRECT policy: `SUPPORTED`
- Later-stage DIRECT slot accounting: `SUPPORTED`
- Later-stage DIRECT execution: `DEFERRED`
- CORE-08 stage-aware placement: `DEFERRED`
- CORE-09 stage-aware match generation: `DEFERRED`
- `DIRECT_KNOCKOUT_ENTRY` overall execution: `PARTIAL`

**No-group slot accounting (`groupStageEnabled=false`):**

- Common invariants apply first: `totalKnockoutSlots >= 1`,
  `directKnockoutEntrySlots >= 0`, `directKnockoutEntrySlots <= totalKnockoutSlots`
- `wildcardSlots=0`, `requiresCrossGroupWildcardRanking=false`
- `remainingSlots = totalKnockoutSlots - directKnockoutEntrySlots` — base knockout population slots, **not** cross-group wildcards
- Base population is every eligible canonical `competitionPopulationEntryIds`
  member except resolved DIRECT entry IDs and entries removed by the certified
  explicit/status exclusions (`WITHDRAWN`, `DISQUALIFIED`, `DQ`, `VOID`,
  `INVALID`, `UNACCEPTED`).
- Exact fill is mandatory:
  `resolvedDirect.length == directKnockoutEntrySlots`,
  `eligibleBasePopulation.length == remainingSlots`, and
  `finalAdmitted.length == totalKnockoutSlots`.
- Base underfill and overpopulation both fail closed. CE does not truncate,
  rank, seed, randomize, or otherwise select a subset for admission.
- `remainingSlots` is not `WILDCARD`, `GROUP_DIRECT`, or `BYE`.
  `DIRECT` is not `BYE` and does not create a seed.

**Raw input integrity (fail-closed):**

- Omitted fields may receive canonical defaults
- Explicit invalid enums / numbers / booleans / entrant identities MUST reject
- `enumOr` must not hide `sourceCategory="BOGUS"`, `targetStage="BOGUS"`, `byePolicy="BOGUS"`, etc.
- Per-entrant omitted `targetStage` / `sourceCategory` may inherit policy defaults
- Explicit per-entrant invalid values reject
- `displayName` alone is never identity
- Explicit `directQualifiersPerGroup: 0` is preserved (does not become 2)
- Conflicting explicit `totalKnockoutSlots` vs `totalQualifiers` reject
- `enabled: false` with active count/entrants reject (disabled policies do not affect derivation)
- Malformed `entrants` shapes (`{}`, number, string) return validation issues — never throw

## Capability truth

| ID | Policy | Execution |
|----|--------|-----------|
| GROUP_STAGE_BYPASS | SUPPORTED | PARTIAL |
| DIRECT_KNOCKOUT_ENTRY | SUPPORTED | PARTIAL — first-playable group-stage and exact-fill no-group paths; later-stage deferred |
| KNOCKOUT_BYE | SUPPORTED | SUPPORTED (SE first-round power-of-two only; configured only when `byePolicy !== NONE`) |
| CROSS_GROUP_WILDCARD_RANKING | SUPPORTED | DEFERRED (preserved) |

## Gateway APIs (additive)

- `resolveKnockoutAdmissionPolicy`
- `deriveKnockoutAdmissionPlan`
- `deriveQualificationPlan` (extended outputs)
- `canMutateKnockoutAdmissionPolicy`
- `validateCompetitionRulesProfile` (extended)

## Lifecycle (no new RULE_CLASS)

Composes `GROUP_ALLOCATION` @ `AFTER_GROUP_DRAW` and `KNOCKOUT` @
`AFTER_MATCH_CREATION`. No-group DIRECT and its final population reuse
`KNOCKOUT` @ `AFTER_MATCH_CREATION` as bracket-creation evidence; post-bracket
DIRECT/population mutation is denied. Existing group-stage locks are unchanged.

Mandatory admission ceilings cannot be loosened by profile lockMap.
Profile may tighten earlier only:

`effectiveLockAt = earlierOf(mandatoryAdmissionLock, configuredRuleClassLock)`

## Expected mode persistence shape (document only)

Modes may later persist under tournament/event settings:

```json
{
  "knockoutAdmission": {
    "groupStageBypass": { "enabled": true, "entrants": [{ "entryId": "…" }] },
    "directKnockoutEntry": {
      "enabled": true,
      "count": 2,
      "sourceCategory": "MANUAL_BY_AUTHORIZED_ORGANIZER",
      "targetStage": "QUARTERFINAL",
      "entrants": [{ "entryId": "…" }]
    },
    "bye": { "byePolicy": "EXPLICIT_PLACEMENTS" }
  },
  "qualification": {
    "totalKnockoutSlots": 8,
    "directQualifiersPerGroup": 1,
    "directKnockoutEntryCount": 2
  }
}
```

`RULES_TABLE_CREATED=NO` · `SQL=NO` · Mode Adapter B unchanged in this workstream.
