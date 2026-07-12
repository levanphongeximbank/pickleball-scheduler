# CC-04E — Draw Shadow Parity

**Phase:** CC-04E | **Primary output:** Direct legacy

## Paths verified

1. Internal skill-controlled (`assignGroupsWithConstraints`)
2. Official open (`assignEntriesOpenConditional`)
3. Official AI balance (`assignGroupsWithConstraints`)
4. Team draw (`assignSeededTeamsToGroups`)

## Helpers

- `compareDrawShadowParity()` — membership/order/warnings comparison
- `runDrawShadowComparison()` — runs direct + adapter, returns `primary` legacy output
- `extractDrawGroupMembership()` — entry/team ID based parity (not object reference)

## Comparison fields

`strategy`, `entryCount`, `groupCount`, `legacyMembership`, `adapterMembership`, `membershipParity`, `groupOrderParity`, `seedOrderParity`, `warningsParity`, `metadataDifference`, `traceSummary`

## Shadow rule

Direct legacy result is always the business output. Adapter path is comparison-only.

## Note on random paths

`runDrawShadowComparison()` invokes legacy executor twice (direct + adapter). Random call count doubles in shadow runs — adapter single-path tests verify no extra calls within one adapter invocation.
