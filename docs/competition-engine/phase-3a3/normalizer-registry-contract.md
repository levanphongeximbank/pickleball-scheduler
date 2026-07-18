# Normalizer Registry Contract — Phase 3A.3

## API

```js
createShadowNormalizerRegistry()
registerShadowNormalizer({ capability, modulePath, normalizerId?, metadata? })
resolveShadowNormalizer(capability)
```

## Behaviors

| Case | reasonCode |
|------|------------|
| Duplicate | `DUPLICATE_REGISTRATION` |
| Unknown | `NORMALIZER_NOT_REGISTERED` |

## Implemented now

Descriptor registry. **Does not mutate** legacy/canonical payloads.

## Reserved

Per-capability normalization policies registered by Integrator after Owner approval.

## Forbidden

Silent mutation; domain hard-coding in registry layer.
