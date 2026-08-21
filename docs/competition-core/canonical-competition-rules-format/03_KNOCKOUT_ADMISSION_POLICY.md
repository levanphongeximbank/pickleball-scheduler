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
- Execution remains DEFERRED.

**No-group slot accounting (`groupStageEnabled=false`):**

- Common invariants apply first: `totalKnockoutSlots >= 1`,
  `directKnockoutEntrySlots >= 0`, `directKnockoutEntrySlots <= totalKnockoutSlots`
- `wildcardSlots=0`, `requiresCrossGroupWildcardRanking=false`
- `remainingSlots = totalKnockoutSlots - directKnockoutEntrySlots` — base knockout population slots, **not** cross-group wildcards

**Raw input integrity (fail-closed):**

- Omitted fields may receive canonical defaults
- Explicit invalid enums / numbers / booleans / entrant identities MUST reject
- `enumOr` must not hide `sourceCategory="BOGUS"`, `targetStage="BOGUS"`, `byePolicy="BOGUS"`, etc.
- Per-entrant omitted `targetStage` / `sourceCategory` may inherit policy defaults
- Explicit per-entrant invalid values reject
- `displayName` alone is never identity

## Capability truth

| ID | Policy | Execution |
|----|--------|-----------|
| GROUP_STAGE_BYPASS | SUPPORTED | PARTIAL |
| DIRECT_KNOCKOUT_ENTRY | SUPPORTED | DEFERRED |
| KNOCKOUT_BYE | SUPPORTED | SUPPORTED (SE first-round power-of-two only; configured only when `byePolicy !== NONE`) |
| CROSS_GROUP_WILDCARD_RANKING | SUPPORTED | DEFERRED (preserved) |

## Gateway APIs (additive)

- `resolveKnockoutAdmissionPolicy`
- `deriveKnockoutAdmissionPlan`
- `deriveQualificationPlan` (extended outputs)
- `canMutateKnockoutAdmissionPolicy`
- `validateCompetitionRulesProfile` (extended)

## Lifecycle (no new RULE_CLASS)

Composes `GROUP_ALLOCATION` @ `AFTER_GROUP_DRAW` and `KNOCKOUT` @ `AFTER_MATCH_CREATION`.

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
