# Comparator Registry Contract — Phase 3A.3

## API

```js
createShadowComparatorRegistry()
registerShadowComparator({ capability, modulePath, comparatorId?, metadata? })
resolveShadowComparator(capability)
```

## Behaviors

| Case | reasonCode |
|------|------------|
| Duplicate | `DUPLICATE_REGISTRATION` |
| Unknown | `COMPARATOR_NOT_REGISTERED` |
| Invalid capability | `INVALID_CAPABILITY_ID` |

## Implemented now

Descriptor registry only. Does **not** invoke comparators.  
Lookup miss → callers keep using generic `compareShadowResults`.

## Reserved

Capability-local comparator modules (e.g. Participant in 3B) + Integrator registration.

## Forbidden

Business comparison logic inside the registry layer; changing shadow execution in Wave 0.
