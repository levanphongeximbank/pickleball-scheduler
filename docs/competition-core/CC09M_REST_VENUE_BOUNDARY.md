# CC-09M — Rest / Venue Boundary

CC-09 merge phase does **not** expand scheduling engine computation.

## Asserted boundaries

| Constraint | CC-09 status | Post-merge behavior |
|---|---|---|
| `INSUFFICIENT_REST` | Modeled, not fully computed | Not claimed as production-enforced; no hard reject from rest rules alone |
| `VENUE_TIME_CONFLICT` | Modeled, partial | Soft severity; no silent hard-pass |
| `VENUE_UNAVAILABLE` | Modeled, partial | Soft severity; strategy capability declared, runtime not wired |
| `INVALID_ROUND_ORDER` | Contract only | No false hard enforcement |

## Decision Trace

Trace records conflicts detected but does **not** mark rest/venue as `parityStatus: ok` when only modeled. Warnings and `unsupportedLegacyBehavior` / `contextMissing` used when applicable.

## Feature flag routing

`SCHEDULING_V2` ON → shadow validation only. Rest/venue constraints do **not** become production-enforced behavior. Legacy scheduling output remains primary.

## CC-10 scope (not started)

Full rest-time and venue conflict computation deferred to CC-10 owner GO.
