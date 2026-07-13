# CC-09 — Scheduling Runtime Inventory

Base: `4df0a529e0d56b08e00cae28983cb785481c0935`

| Path | Caller | Input | Algorithm | Court | Time | BYE | Rest | Validation | Manual | Persistence | Output | Bridge |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `src/tournament/engines/scheduleEngine.js` → `buildGroupStageSchedule` | Tournament setup, TE 4.0 | groups[], entryIds | round-robin pairing per group | none at fixture stage | none | implicit odd count | none | entry count | none | computed | matches[] + groups[] | **WIRED / SHADOW** |
| `src/pages/tournament.fixtures.logic.js` → `buildRoundRobinRounds` | Tournament.jsx fixtures | teams[] | circle RR rounds | none | none | rotating bye | none | team count | none | computed | rounds[] | **WIRED / SHADOW** |
| `src/features/tournament-engine/engines/scheduleEngine.js` → `generateSchedule` | TE orchestrator | context.matches, courts, scheduleConfig | slot/court greedy assign | courtId rotation | scheduledStart/End, slot | from upstream fixtures | participant slot conflict skip | validateScheduleInput | manualScheduleLock | engineRunLog | `{ ok, data: { matches } }` | **WIRED / SHADOW** |
| `src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js` | TT publish flow | teams, rounds | structured RR matchups | courtLabel optional | scheduledAt | none | none | roster checks | manual lock | blob/cloud | matchups[] | **WIRED / SHADOW** |
| `src/features/team-tournament/engines/publishScheduleEngine.js` | TT director | teamData | publish wrapper | inherited | inherited | inherited | inherited | publish guards | yes | cloud upsert | published schedule | **SHADOW_ONLY** |
| `src/tournament/engines/courtEngine.js` | Director runtime | live matches | court assign | assignMatchToCourt | optional | n/a | n/a | court availability | drag/drop | live state | court map | **LEGACY_ONLY** |
| `src/ai/engine.js` → `runAI` | Session Xếp sân | players, courts | AI pairing | court pick | session slot | waiting queue | wait time | policy guards | manual tick | local blob | session pairings | **OUT_OF_SCOPE** |
| UI manual schedule editors | Tournament pages | drag/drop state | user ordering | manual | manual | user | n/a | UI validators | yes | write path | updated rows | **BLOCKED** (no intercept) |
| Reschedule / forfeit writes | tournament services | match mutations | status transitions | may clear court | may shift time | advancement | n/a | workflow rules | yes | DB/blob | updated match | **BLOCKED** |

Canonical adapter: `evaluateCanonicalSchedulingRuntime()` — maps legacy payload, executes legacy once, validates canonical conflicts, compares shadow parity. Legacy output remains business truth.

Flag: `VITE_COMPETITION_CORE_SCHEDULING_V2_ENABLED` (requires `VITE_COMPETITION_CORE_ENABLED=true`).
