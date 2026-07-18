# 03 — Capability Migration Matrix

**Audit date:** 2026-07-18  
**Rule:** A capability is not “ready” unless input/output contracts, side effects, persistence, parity rule, and rollback path are identified.

---

## Status vocabulary

| Status | Meaning |
|--------|---------|
| READY_FOR_SHADOW | Contracts + adapter exist; can shadow without Production write |
| READY_FOR_ADAPTER | Mapping interfaces exist; executor still legacy |
| NEEDS_CANONICAL_IMPLEMENTATION | No independent canonical executor |
| NEEDS_PERSISTENCE_PORT | Ports stubbed; no Production adapter |
| NEEDS_DATA_MIGRATION | Legacy ID / blob shape must be mapped or backfilled |
| NEEDS_OWNER_DECISION | Owner row still `_pending_` or conditioned |
| BLOCKED_BY_ARCHITECTURE | Grandfathered reverse deps or ownership conflict |
| BLOCKED_BY_RUNTIME_COUPLING | UI/page-logic or multi-stack coupling |
| NOT_IN_PHASE_3 | Explicitly deferred (optimizer, disputes bulk, new formats) |

---

## Matrix

| Capability | Prod executor | Canonical candidate | Status | Risk | Contracts | Persistence | Parity rule | Rollback path |
|------------|---------------|---------------------|--------|------|-----------|-------------|-------------|----------------|
| Participant resolution | TT hydration, athlete pool, normalizePlayer, TE adapter | `createParticipantReference` / `createCompetitionParticipant` | READY_FOR_SHADOW + NEEDS_PERSISTENCE_PORT + NEEDS_DATA_MIGRATION | Critical | Yes | Ports stub only | Identity equivalence | Flag OFF; no write yet |
| Registration | `registrationEngine` | `createCompetitionRegistration` | READY_FOR_ADAPTER + NEEDS_CANONICAL_IMPLEMENTATION + NEEDS_OWNER_DECISION | High | Yes | Blob via tournamentService | Waitlist + status + competitionId | Flag OFF |
| Eligibility | IND + TT eligibility engines | `createEligibilityDecision` / `validateEligibility` | READY_FOR_ADAPTER + NEEDS_OWNER_DECISION | High | Partial | Rules in blob | Decision parity | Flag OFF |
| Entry creation | `entry.js` + registration + pairing | `createCompetitionEntry` | READY_FOR_SHADOW + NEEDS_PERSISTENCE_PORT | Medium | Yes | Blob events | Active entry uniqueness | Flag OFF |
| Team creation | `teamTournamentEngine` | `createCompetitionTeam` | READY_FOR_ADAPTER + NEEDS_PERSISTENCE_PORT (Owner: KEEP IN FORMAT) | High | Yes | Blob ± cloud | Team identity + catalog | TT DATA_MODE + flags |
| Roster management | `teamRosterEngine` | Roster contracts | READY_FOR_ADAPTER + NEEDS_PERSISTENCE_PORT | High | Yes | Blob ± cloud | Member/captain parity | TT rollback / flag |
| Lineup submission | `lineupEngine` | Lineup contracts | READY_FOR_SHADOW + READY_FOR_ADAPTER | High | Yes | Blob ± cloud | Member + revision | Flag OFF |
| Lineup locking | lineup state machine + publish workflow | Lock states in contracts | READY_FOR_ADAPTER + BLOCKED_BY_RUNTIME_COUPLING | High | Partial | Blob ± cloud RPC | Lock + visibility | Flag OFF |
| Seeding | seeding.logic, TE seed, TT group seed, CC seed pipeline (shadow) | `runCanonicalSeedPipeline` / seed contracts | NEEDS_OWNER_DECISION + READY_FOR_ADAPTER | High | Partial | Event/groups in blob | Deterministic seed order | Flag OFF |
| Draw and grouping | Multiple draw engines + adapter wrapper | `evaluateCanonicalDraw` | READY_FOR_ADAPTER + NEEDS_CANONICAL_IMPLEMENTATION + NEEDS_OWNER_DECISION (3C conditioned) | High | Yes | Groups in blob | Exact or semantic by mode | Flag OFF |
| Pairing | AI + teamPairing + TT formation | matchmaking/formation adapters | NEEDS_CANONICAL_IMPLEMENTATION + BLOCKED_BY_RUNTIME_COUPLING | High | Partial | Via plans | Policy-equivalent | Flag OFF |
| Match generation | scheduleEngine + fixtures.logic + TT RR + TE | scheduling contracts | NEEDS_CANONICAL_IMPLEMENTATION + BLOCKED_BY_ARCHITECTURE | High | Partial | Matches in blob | Semantic match graph | Flag OFF + extract page logic |
| Scheduling | same + publishSchedule + TE | CC-09 scheduling | READY_FOR_ADAPTER + NEEDS_OWNER_DECISION | High | Partial | Blob publish state | Slot/court policy | Flag OFF |
| Court assignment | courtEngine + TE courts + court-engine feature | Partial scheduling only | NEEDS_CANONICAL_IMPLEMENTATION + NEEDS_OWNER_DECISION | Medium | No full SSOT | Match.courtId | Assignment policy | Flag OFF |
| Match lifecycle | matchEngine + matchResultEngine + TT results + lifecycle | Lifecycle docs only | NEEDS_CANONICAL_IMPLEMENTATION + BLOCKED_BY_RUNTIME_COUPLING | Critical | Thin | Blob + live RPC | State machine parity | Flag OFF + deploy rollback |
| Scoring | score submit paths + rallyScoring | scoringRules (partial) | NEEDS_CANONICAL_IMPLEMENTATION + NEEDS_OWNER_DECISION | High | Partial | Scores on matches | Score + validation | Flag OFF |
| Result validation | validationEngine + format validators | CC validators | READY_FOR_ADAPTER + NEEDS_OWNER_DECISION | Medium | Partial | In-memory / gates | Decision parity | Flag OFF |
| Standings | rankingEngine + TE + TT + season + CC calc | `calculateCanonicalStandings` | READY_FOR_SHADOW + NEEDS_OWNER_DECISION | High | Strong | Projection / blob | Exact ranking order | Flag OFF |
| Tie-break | Embedded per standings engine | tieBreakSteps / H2H / miniTable | READY_FOR_SHADOW + NEEDS_OWNER_DECISION | High | Strong | Same | Policy steps | Flag OFF |
| Publication | publishDraw / publishSchedule / TT atomic | Lifecycle docs; no single CC executor | NEEDS_CANONICAL_IMPLEMENTATION | High | Thin | Publish flags + snapshots | Lock/publish parity | Flag OFF |

---

## Capability readiness summary

| Bucket | Capabilities |
|--------|--------------|
| READY_FOR_SHADOW (primary) | Participant, Entry, Lineup (map), Standings, Tie-break |
| READY_FOR_ADAPTER | Registration, Eligibility, Team, Roster, Draw wrapper, Scheduling wrapper |
| NEEDS_CANONICAL_IMPLEMENTATION | Registration executor, Draw algo, Pairing, Match gen, Court, Lifecycle, Scoring, Publication |
| NEEDS_PERSISTENCE_PORT | Participant, Entry, Team, Roster, Lineup (all ports) |
| NEEDS_DATA_MIGRATION | Participant (triple ID), TT cloud dual path, Entry IDs |
| NEEDS_OWNER_DECISION | Most P0/P1 rows still `_pending_` in Owner matrix |
| BLOCKED_BY_ARCHITECTURE | Match gen (page logic reverse deps), some CC→TT adapters |
| BLOCKED_BY_RUNTIME_COUPLING | Lineup lock cloud, Pairing AI, Match lifecycle |
| NOT_IN_PHASE_3 | Optimizer, disputes module, public projection unify, new formats (League/Ladder/Swiss) |

---

## Canonical readiness by capability (short)

```text
Participant:  contracts COMPLETE · runtime INACTIVE · persistence NOT IMPLEMENTED
Registration: contracts EXIST · executor FORMAT · Owner pending
Team/Roster/Lineup: contracts EXIST · Owner KEEP IN FORMAT · runtime FORMAT
Draw/Standings/Scheduling: adapters EXIST · still legacy-exec · flags OFF
Match lifecycle: NO single Core executor · Critical risk
```
