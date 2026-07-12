# CC-05A — Domain Model

**Phase:** CC-05A | **Runtime:** NOT changed

## Core contracts

| Contract | Factory |
|----------|---------|
| FormationRequest | `createFormationRequest()` |
| FormationPolicy | `createFormationPolicy()` |
| FormationStrategy | `createFormationStrategyDefinition()` |
| FormationConstraint | `createFormationConstraint()` |
| FormationCandidate | `createFormationCandidate()` |
| FormationPair | `createFormationPair()` |
| FormationCourt | `createFormationCourt()` |
| FormationRound | `createFormationRound()` |
| FormationResult | `createFormationResult()` |
| FormationExplanation | `createFormationExplanation()` |
| FormationAudit | `createFormationAudit()` |
| FormationDecisionTrace | `createFormationDecisionTrace()` |

Module: `src/features/competition-core/formation/`

Engine version: `FORMATION_ENGINE_VERSION = "cc05a-v1"`

## FormationRequest fields

`sessionId`, `clubId`, `eventId`, `policy`, `players[]`, `constraints[]`, `lockedPairs[]`, `courts[]`, `randomSeed`, `options`

## Foundation builder

`buildFoundationFormationResult()` — metadata envelope only, empty pairs/courts/rounds.
