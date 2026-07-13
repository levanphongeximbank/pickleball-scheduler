# CC-09M — Routing Verification

Verified post-merge on `integration/cc09-final-merge`.

## Flag matrix

| CORE | SCHEDULING_V2 | Behavior | Verified |
|---|---|---|---|
| false | any | All scheduling paths legacy | PASS (test 1, 2) |
| true | false | Legacy | PASS (test 2) |
| true | true | Shadow adapter on wired paths only | PASS (tests 3–8) |

Gate: `isSchedulingV2Enabled()` requires `coreEnabled && schedulingV2Enabled`.

## Explicitly wired (shadow)

| Path | Consumer | Status |
|---|---|---|
| Group-stage | `buildGroupStageSchedule` | WIRED |
| Round-robin | `buildRoundRobinRounds` | WIRED |
| Team Tournament matchups | team_tournament consumer | WIRED |
| TE 4.0 base | `generateSchedule` | WIRED |

## Explicitly legacy-only / excluded

| Path | Mode | Intercepted? |
|---|---|---|
| Session/Daily Play (`runAI`) | LEGACY_ONLY | No |
| Director live court assignment | LEGACY_ONLY | No |
| Manual drag/drop | BLOCKED | No |
| Reschedule writes | BLOCKED | No |
| Knockout / Swiss / DE | OUT_OF_SCOPE (contract-only) | No |

## Production env

Production env files **unchanged**. No production flags enabled.

## Scheduling verification (16 cases)

All covered in `tests/competition-core-scheduling-cc09.test.js` — **204/204 PASS** post-merge.
