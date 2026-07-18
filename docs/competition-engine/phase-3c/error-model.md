# Error Model — Phase 3C

Capability-local codes in `registrations/errors/runtimeErrorCodes.js`:

| Code | When |
|------|------|
| `REGISTRATION_NOT_FOUND` | Missing source |
| `INVALID_REGISTRATION` | Missing competition / invalid shape / OD-10 |
| `UNSUPPORTED_REGISTRATION_SOURCE` | No adapter / unknown sourceType |
| `UNSUPPORTED_REGISTRATION_KIND` | Not INDIVIDUAL/TEAM |
| `UNSUPPORTED_REGISTRATION_STATUS` | Unknown legacy status |
| `REGISTRATION_IDENTITY_COLLISION` | Same key, different payload |
| `INVALID_PARTICIPANT_REFERENCE` | Empty / failed participant ref |
| `DUPLICATE_REGISTRATION` | Same participant in batch countable regs |
| `INVALID_REGISTRATION_MAPPING` | Mapper failure |

Shared error-registry export → Integrator handoff (not edited in capability PR).
