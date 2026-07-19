# Error Model — Phase 3D

Capability-local codes in `teams/errors/runtimeErrorCodes.js`:

| Code | When |
|------|------|
| `TEAM_NOT_FOUND` | Missing team source |
| `INVALID_TEAM` | Missing competition / invalid shape / identity mismatch |
| `INVALID_TEAM_SOURCE` | Non-object / missing team id |
| `INVALID_TEAM_MAPPING` | Mapper failure / missing competitionId on map |
| `UNSUPPORTED_TEAM_SOURCE` | No TeamAdapter supports source |
| `UNSUPPORTED_TEAM_STATUS` | Unknown legacy/canonical team status |
| `TEAM_IDENTITY_COLLISION` | Same key, different payload |
| `ROSTER_NOT_FOUND` | Missing roster source |
| `INVALID_ROSTER` | Invalid roster shape / identity mismatch |
| `INVALID_ROSTER_SOURCE` | Non-object / missing teamId |
| `INVALID_ROSTER_MAPPING` | Mapper failure / missing competitionId on map |
| `UNSUPPORTED_ROSTER_SOURCE` | No RosterAdapter supports source |
| `UNSUPPORTED_ROSTER_STATUS` | Unknown roster status |
| `ROSTER_IDENTITY_COLLISION` | Same roster key, different payload |
| `ROSTER_MEMBER_IDENTITY_COLLISION` | Duplicate member identity in roster |
| `MISSING_PARTICIPANT_REF` | Captain/member missing kind+id |
| `INVALID_PARTICIPANT_REFERENCE` | Injected participant resolve failed |
| `ROSTER_LOCKED_DIRECT_MUTATION` | Reserved (OD-04/05 guard code; workflow not enabled) |

Errors surface as `TeamRuntimeError` or typed resolve failure envelopes.  
Shared error-registry export → Integrator handoff (not edited in capability PR).
