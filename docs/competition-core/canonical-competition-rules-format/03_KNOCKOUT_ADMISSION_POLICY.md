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
    byePolicy,             // CORE-09 BYE_POLICY vocabulary
    allocationShape,       // SINGLE_ELIMINATION_POWER_OF_TWO_FIRST_ROUND
  },
}
```

Canonical identity: `entryId` (seeding/standings vocabulary).  
`participantId` accepted as synonym. `displayName` forbidden as identity.

`directKnockoutEntry.targetStage` uses `KNOCKOUT_ENTRY_ROUND` vocabulary and is
**not** the same field as bracket-wide `knockout.entryRound`.

## Capability truth

| ID | Policy | Execution |
|----|--------|-----------|
| GROUP_STAGE_BYPASS | SUPPORTED | PARTIAL |
| DIRECT_KNOCKOUT_ENTRY | SUPPORTED | DEFERRED |
| KNOCKOUT_BYE | SUPPORTED | SUPPORTED (SE first-round power-of-two only) |
| CROSS_GROUP_WILDCARD_RANKING | SUPPORTED | DEFERRED (preserved) |

## Gateway APIs (additive)

- `resolveKnockoutAdmissionPolicy`
- `deriveKnockoutAdmissionPlan`
- `deriveQualificationPlan` (extended outputs)
- `canMutateKnockoutAdmissionPolicy`
- `validateCompetitionRulesProfile` (extended)

## Lifecycle (no new RULE_CLASS)

Composes `GROUP_ALLOCATION` @ `AFTER_GROUP_DRAW` and `KNOCKOUT` @ `AFTER_MATCH_CREATION`.

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
