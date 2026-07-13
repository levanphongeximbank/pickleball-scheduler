# CC-10 — Deferred Scope Register

| Item | Reason | Risk | Owner | Legacy behavior | Flag protection | Future phase | Production impact |
|---|---|---|---|---|---|---|---|
| Knockout scheduling | Not wired to adapter | Medium | CC-11+ | legacy bracket | SCHEDULING_V2 off | CC-11 | none while flag off |
| Swiss scheduling | Contract only | Medium | CC-11+ | n/a | SCHEDULING_V2 off | CC-11 | none |
| Season standings | Different domain | Low | future | seasonStandingsEngine | STANDINGS_V2 off | CC-11 | none |
| Session standings | Different points model | Low | future | tournament.standings.logic | STANDINGS_V2 off | CC-11 | none |
| League standings | Club blob semantics | Low | future | season engine | STANDINGS_V2 off | CC-11 | none |
| Daily Play scheduling | Session AI semantics | Medium | future | runAI | MATCHMAKING_V2 off | CC-11 | none |
| Director live court | Runtime writes | High | legacy | courtEngine | no flag | blocked | none |
| Manual drag/drop | UI write path | High | legacy | UI | no flag | blocked | none |
| Rest-time conflicts | Modeled not computed | Medium | CC-11 | TE greedy skip | SCHEDULING_V2 shadow only | CC-11 | none |
| Venue-level conflicts | Modeled not computed | Medium | CC-11 | partial | SCHEDULING_V2 shadow only | CC-11 | none |
| TE 4.0 qualification overlay | Partial integration | Low | TE team | legacy ranking | STANDINGS_V2 off | CC-11 | none |
| Referee preview route | Gated/incomplete | Low | v5 | removed/gated | n/a | v5 release | none |
| Canonical-primary persistence | Not enabled | High | CC-12+ | legacy writes | all flags | post-staging | none in CC-10 |
| Rating V2 production RPC | Staging verified, prod not | High | CC-12 | legacy Elo | RATING_V2 off | prod GO | none while off |

Hard rules with missing context return warnings/limitations in Decision Trace — never silent hard-pass.
