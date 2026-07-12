# CC-05B Runtime Adapter

## Purpose

Integrate CC-05A Canonical Team Formation foundation into runtime via adapter shell.

**Legacy pairing remains source of truth.** No algorithm changes.

## Flow

```
Legacy payload
    ↓
FormationRequest + FormationPolicy
    ↓
Legacy executor (unchanged)
    ↓
FormationResult (metadata envelope)
    ↓
Legacy consumer output (preserved)
```

## Entry points

| Module | Function |
|--------|----------|
| `formation/adapters/formationRuntimeAdapter.js` | `evaluateCanonicalFormation()` |
| `formation/adapters/teamFormationAdapter.js` | `runTeamFormationWithCanonicalAdapter()` |
| `adapters/legacyAdapter.js` | `executeCompetitionEngine()` TEAM_FORMATION branch |

## Feature flag

| CORE | FORMATION_V2 | Path |
|------|--------------|------|
| `false` | any | Legacy direct |
| `true` | `false` | Legacy direct |
| `true` | `true` | Canonical adapter → legacy executor |

Env key: `VITE_COMPETITION_CORE_FORMATION_V2_ENABLED`

## Wired consumers (CC-05B)

- `TeamAiPairingDialog.jsx` → `runTeamFormationWithCanonicalAdapter()`

## Out of scope

- Daily Play `runAI` wiring (inventory only)
- Court engine rotation/KOC
- Algorithm rewrite
