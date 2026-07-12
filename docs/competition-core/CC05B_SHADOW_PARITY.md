# CC-05B Shadow Parity

## Model

Shadow compare runs **direct legacy** and **canonical adapter** paths on the same payload.

Primary output is always **direct legacy** — adapter output must match.

## Checks

| Check | Description |
|-------|-------------|
| `membershipParity` | Team player IDs match per team |
| `waitingParity` | Waiting player list identical |
| `warningsParity` | Warning messages identical |
| `randomFnPreserved` | Adapter did not replace `randomFn` reference |

## API

- `compareFormationShadowParity(input)`
- `runFormationShadowComparison(input)`

## Usage

Shadow-only — does not affect production output when flag is ON (adapter returns same legacy result).

## Source

`src/features/competition-core/formation/adapters/formationShadowParity.js`
