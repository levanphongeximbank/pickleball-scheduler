# Resolver Behavior — Phase 3C

## Sequence

```text
createRegistrationResolveRequest
  → select LegacyRegistrationAdapter
  → optional DI resolveParticipant for memberRefs
  → adapter.map (pure)
  → normalizeAndValidateRegistration
  → assertGuestPreserved
  → duplicate player detection (batch)
  → identityLookup.register
  → optional persistence stub (enablePersistence === true only)
  → resolveOk / resolveFail
```

## Guarantees

- Deterministic
- Side-effect free w.r.t. source + Production
- No DB / network / global app state / UI
- Typed success / failure (never null for classifiable errors)
- `resolveBatch` preserves input order
- Persistence disabled by default

## Participant DI

```js
createRegistrationResolver({
  resolveParticipant: async (player, { competitionId }) => { /* Participant Runtime */ }
})
```
