# CC-04C — Distribution Model

**Phase:** CC-04C | **Runtime algorithms:** NOT changed

## DISTRIBUTION_TYPE enum

| Value | Meaning | Legacy reference |
|-------|---------|------------------|
| `snake` | Serpentine seed placement | `seededGroupEngine`, team snake |
| `sequential` | Fill groups in order | Foundation taxonomy |
| `random` | Unseeded random placement | Open / pure random |
| `balanced` | Level-balanced groups | Official AI balance |
| `hybrid` | Heuristic + repair | AI draw engine |
| `manual` | Operator placement | Manual draw UI |
| `round_robin` | Group-stage scheduling | Schedule engine |
| `swiss_ready` | Swiss pairing contract | Placeholder |
| `knockout_prep` | Bracket seeding prep | Knockout bracket |
| `custom` | Legacy custom flows | Constraint repair |
| `unknown` | Unmapped input | Fallback |

Helpers: `isDistributionType()`, `DISTRIBUTION_TYPE_VALUES`

## DistributionPolicy contract

```javascript
{
  type: "snake",
  deterministic: true,
  maxRetries: null,
  params: {}
}
```

Factory: `createDistributionPolicy()`

Derived defaults: `deriveDefaultPoliciesFromStrategy()` — foundation metadata only.

## Note

This model names and classifies distribution behavior. It does **not** replace or invoke snake, random, or balancing implementations.
