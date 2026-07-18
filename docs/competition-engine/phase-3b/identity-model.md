# Identity Model — Phase 3B

## ParticipantIdentity

```text
{
  schemaVersion: "1",
  competitionId: string,
  kind: PARTICIPANT_REFERENCE_KIND,
  id: string,          // within kind space
  key: string          // competitionId::kind::id
}
```

## Rules

| Rule | Enforcement |
|------|-------------|
| Deterministic | `buildParticipantIdentityKey` |
| Stable | Same inputs → same key |
| Immutable | `Object.freeze` on create |
| Distinct kind spaces | PLAYER_PROFILE `100` ≠ ATHLETE `100` |
| Collision | Same key + divergent payload → `IDENTITY_COLLISION` |
| No merge | Lookup refuses auto-merge |
| Guest | Missing guest id → hard error |

## CompetitionParticipant id

Canonical participant id for mapped legacy sources:

```text
cp:{identity.key}
```
