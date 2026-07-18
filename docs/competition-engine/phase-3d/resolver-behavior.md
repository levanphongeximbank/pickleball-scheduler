# Resolver Behavior — Phase 3D

## TeamResolver sequence

```text
createTeamResolveRequest
  → optional DI resolveParticipant (captain / member refs)
  → select LegacyTeamAdapter
  → adapter.map (pure)
  → normalizeAndValidateTeam
  → identityLookup.register
  → optional persistence stub (enablePersistence === true only)
  → teamResolveOk / teamResolveFail
```

## RosterResolver sequence

```text
createRosterResolveRequest
  → optional DI resolveParticipant (memberRefs)
  → select LegacyRosterAdapter
  → adapter.map (pure)
  → normalizeAndValidateRoster
  → identityLookup.register
  → optional persistence stub (enablePersistence === true only)
  → rosterResolveOk / rosterResolveFail
```

## Guarantees

- Deterministic identity
- Side-effect free w.r.t. source + Production
- No DB / network / global app state / UI
- Typed success / failure (never null for classifiable errors)
- `resolveBatch` preserves input order
- Persistence disabled by default
- No input mutation

## Participant DI

```js
createTeamResolver({
  resolveParticipant: async (player, { competitionId }) => {
    // Inject Participant Runtime result — never import participants/runtime
    return { ok: true, person: { kind, id } };
  },
});

createRosterResolver({
  resolveParticipant: async (player, { competitionId }) => { /* same shape */ },
});
```
