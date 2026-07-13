# CC-10 — Legacy Dependency Matrix

| Canonical module | Legacy engines still authoritative | Adapter wraps | Can disable via flag |
|---|---|---|---|
| Rating V2 | `eloEngine`, `eloService`, `clubEloService`, Supabase RPC | mapping + idempotency | yes |
| Rules V2 | `constraintEvaluator`, `ai/scoring`, daily play filters | orchestrator bridge | yes |
| Draw V2 | `seededGroupEngine`, `openConditionalRandomEngine`, `officialTournamentEngine` | drawRuntimeAdapter | yes |
| Seed | `tournament.seeding.logic`, draw seed pipeline | seed mappers | yes (via draw) |
| Formation V2 | `ai/engine`, `teamPairingEngine` | formationRuntimeAdapter | yes |
| Matchmaking V2 | `ai/engine.runAI` | matchmakingRuntimeAdapter | yes |
| Standings V2 | `rankingEngine`, `teamStandingsEngine`, TE ranking | standingsRuntimeAdapter | yes |
| Scheduling V2 | `scheduleEngine`, `fixtures.logic`, TE schedule | schedulingRuntimeAdapter | yes |

**Rule:** Disabling `VITE_COMPETITION_CORE_ENABLED=false` returns 100% legacy behavior with zero adapter interception.

**Rule:** Sub-flags without master flag have no effect (verified CC-10 tests).

No legacy engine deleted in CC-10.
