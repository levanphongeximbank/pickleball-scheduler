# CC-05A — Score Model

**Phase:** CC-05A | **Reference only**

## FormationScoreBreakdown components

| Field | Role |
|-------|------|
| `skillScore` | Skill proximity / level fit |
| `repeatPenalty` | Repeat partner penalty |
| `opponentPenalty` | Repeat opponent penalty |
| `restPenalty` | Rest time violation penalty |
| `genderBonus` | Gender balance bonus |
| `balanceScore` | Court/team balance score |
| `availabilityScore` | Player availability fit |
| `manualAdjustment` | Operator override |
| `randomComponent` | Random tie component |
| `finalScore` | Weighted aggregate |

## Reference computation

`computeReferenceFormationScoreComponents()` — foundation formula only.

Weights: `DEFAULT_FORMATION_SCORE_WEIGHTS`

Does NOT invoke AI pairing or Daily Play runtime.
