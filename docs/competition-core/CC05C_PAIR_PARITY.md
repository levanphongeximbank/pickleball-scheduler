# CC-05C Pair Parity

## Checks

| Field | Description |
|-------|-------------|
| `pairMembershipParity` | Same player sets per team/pair (order-independent) |
| `teamCompositionParity` | No duplicate/missing players |
| `pairOrderDiffers` | Reported separately, not a failure |

## Normalization

`normalizeFormationPairs()` → stable `pairKey` from sorted player IDs.

## Fixtures tested

4/5/8/12/20 players, mixed gender, skill spread, missing rating, check-in/busy variants.

## Source

`formationParityModel.js`
