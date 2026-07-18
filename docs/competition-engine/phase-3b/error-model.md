# Error Model — Phase 3B

## Codes

| Code | When |
|------|------|
| `PARTICIPANT_NOT_FOUND` | Source missing / null |
| `IDENTITY_COLLISION` | Same identity key, divergent payload |
| `INVALID_PARTICIPANT` | Validation / guest loss / competition mismatch |
| `UNSUPPORTED_SOURCE` | No adapter supports source |
| `INVALID_MAPPING` | Mapper cannot build participant |

## Types

- `ParticipantRuntimeError` — thrown inside map/normalize/lookup internals
- Resolve API converts typed errors into `resolveFail` result envelopes
- Generic `Error` is not used for business failures on the resolve path

## Result envelope

```text
{ ok: true, participant, identity, adapterId, sourceType, diagnostics }
{ ok: false, error: { code, message, details }, diagnostics }
```
