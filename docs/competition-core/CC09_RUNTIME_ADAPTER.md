# CC-09 — Runtime Adapter

Entry: `evaluateCanonicalSchedulingRuntime()` in `scheduling/adapters/schedulingRuntimeAdapter.js`

## Flow

1. Clone legacy payload (`cloneLegacySchedulingPayload`) — preserves `randomFn`, Map/Set via extensions
2. If `!isSchedulingV2Enabled(env)` → direct `legacyExecutor()`, return unchanged
3. Memoized legacy execution (single side-effect pass)
4. `mapLegacySchedulingPayloadToRequest` → `SchedulingRequest`
5. `calculateCanonicalSchedule(request, legacyResult)` — map + validate + trace (no algorithm rewrite)
6. `buildSchedulingShadowComparison` — membership, round, court, time, bye, override, referee parity
7. Return **legacy result as business output** (`outputPreserved: true` in shadow mode)

## Shadow helper

`runSchedulingShadowComparison(input)` — alias with `executionMode: "shadow"`.

## Integration

`executeCompetitionEngine({ engineType: SCHEDULING, ... })` routes through legacy adapter when flags on.

## Version

`SCHEDULING_RUNTIME_ADAPTER_VERSION = "cc09-v1"`

## Production policy

- Flag OFF → legacy only
- Flag ON + shadow → legacy primary, canonical comparison only
- **No canonical-primary output in Production** (executionMode blocked for prod)
