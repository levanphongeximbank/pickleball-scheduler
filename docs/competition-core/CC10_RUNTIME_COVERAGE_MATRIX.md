# CC-10 — Runtime Coverage Matrix

| Module | Consumer | Canonical engine | Adapter | Flag | Mode | Output owner | Shadow | Trace | Limitations | Readiness | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Draw | Internal tournament | strategy draw | drawRuntimeAdapter | DRAW_V2 | SHADOW | legacy | yes | yes | TE heuristic partial | SHADOW_READY | flag off |
| Draw | Official open | strategy_open | drawRuntimeAdapter | DRAW_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Draw | AI balance | strategy_ai_heuristic | drawRuntimeAdapter | DRAW_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Draw | Team tournament | team draw bridge | team adapter | DRAW_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Formation | Session pairing | formation engine | formationRuntimeAdapter | FORMATION_V2 | SHADOW | legacy | yes | yes | MLP presets partial | SHADOW_READY | flag off |
| Matchmaking | Daily Play AI | matchmaking | matchmakingRuntimeAdapter | MATCHMAKING_V2 | SHADOW | legacy | yes | yes | session semantics | SHADOW_READY | flag off |
| Rules | Pairing constraints | rules engine | rulesRuntimeOrchestrator | RULES_V2 | SHADOW | legacy | yes | yes | founder dedup | SHADOW_READY | flag off |
| Rules | TT lineup | team bridge | teamTournamentRulesBridge | RULES_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Standings | Group stage | standings engine | standingsRuntimeAdapter | STANDINGS_V2 | SHADOW | legacy | yes | yes | session/season excluded | SHADOW_READY | flag off |
| Standings | Team tournament | standings engine | standingsRuntimeAdapter | STANDINGS_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Scheduling | Group-stage | validation wrapper | schedulingRuntimeAdapter | SCHEDULING_V2 | SHADOW | legacy | yes | yes | rest/venue partial | SHADOW_READY | flag off |
| Scheduling | Round-robin | validation wrapper | schedulingRuntimeAdapter | SCHEDULING_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Scheduling | TE 4.0 base | validation wrapper | schedulingRuntimeAdapter | SCHEDULING_V2 | SHADOW | legacy | yes | yes | requires pre-drawn matches | SHADOW_READY | flag off |
| Scheduling | TT matchups | validation wrapper | schedulingRuntimeAdapter | SCHEDULING_V2 | SHADOW | legacy | yes | yes | — | SHADOW_READY | flag off |
| Rating | Match completion | rating RPC | ratingRpcService | RATING_V2 | SHADOW/TEST | legacy | partial | partial | RPC prerequisite | CONDITIONAL | flag off + RPC revert |
| Standings | Session group | legacy only | — | — | LEGACY | legacy | no | no | different points | LEGACY_ONLY | n/a |
| Standings | Season league | legacy only | — | — | LEGACY | legacy | no | no | separate domain | OUT_OF_SCOPE | n/a |
| Scheduling | Knockout/Swiss | contract only | — | — | LEGACY | legacy | no | no | not implemented | BLOCKED | n/a |
| Scheduling | Director court | courtEngine | — | — | LEGACY | legacy | no | no | runtime writes | LEGACY_ONLY | n/a |
| Scheduling | Manual UI | — | — | — | LEGACY | legacy | no | no | drag/drop | BLOCKED | n/a |
