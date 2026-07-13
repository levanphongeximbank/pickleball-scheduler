# CC-08 — Standings Runtime Inventory

| Path | Caller | Input | Scoring | Tie-break | Forfeit/BYE | Output | Persistence | Risk | Decision |
|---|---|---|---|---|---|---|---|---|---|
| `src/tournament/engines/rankingEngine.js` | bracketEngine, setup pages | entries, matches, pointsConfig | win 2 / loss 1 / forfeit 0 | matchPoints → scoreDiff → pointsFor → won → name | FORFEIT yes, BYE no | standing[] | computed on read | no mini-table | map to canonical group adapter |
| `src/features/tournament-engine/engines/rankingEngine.js` | tournamentEngine orchestrator | groups, matches, rankingRules | via legacy builder | wins → matchPoints → pointDiff → headToHead → seed | FORFEIT yes | rankings + warnings | engineRunLog localStorage | pairwise H2H only | shadow via group mapper |
| `src/pages/tournament.standings.logic.js` | Tournament.jsx | sessions | win 3 / draw 1 / loss 0 | matchPoints chain | none | standing[] | computed | different points | out of CC-08 scope |
| `src/features/team-tournament/engines/teamStandingsEngine.js` | team engine, cloud sync, awards | teamData.matchups | win 2 / loss 1 | wins → subMatchDiff → pointsScored → manual | indirect via completed winner | standings[] | blob/cloud upsert | no mini-table | map to team adapter |
| `src/tournament/engines/seasonStandingsEngine.js` | season services | match records | league pointsSystem | points → wins → losses | none | league rows | club blob | separate domain | future CC scope |

Flag: `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` — adapter only, legacy remains production truth.
