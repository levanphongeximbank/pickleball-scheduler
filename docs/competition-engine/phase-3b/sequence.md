# Sequence — Phase 3B Participant Resolve

```text
1. createParticipantResolveRequest(input)
2. Validate competitionId + source presence
3. selectAdapter(adapters, source)
   └─ none → UNSUPPORTED_SOURCE
4. adapter.map(source, context)
   └─ failure → INVALID_MAPPING / typed code
5. normalizeAndValidateParticipant(mapped)
   └─ failure → INVALID_PARTICIPANT
   └─ guest missing id → INVALID_PARTICIPANT (no silent loss)
6. Enforce competitionId match
7. identityLookup.register(participant)
   └─ divergent same key → IDENTITY_COLLISION (no merge)
8. Optional persistence stub (enablePersistence === true only)
9. resolveOk({ participant, identity, adapterId })
```

Shadow (opt-in API only):

```text
resolveShadow(request, { compareWith })
  → resolve(request)
  → normalize + compare fingerprints
  → NEVER Production-invoked
```
