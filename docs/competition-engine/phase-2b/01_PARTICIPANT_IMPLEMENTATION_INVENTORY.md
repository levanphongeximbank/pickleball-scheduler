# 01 — Participant Implementation Inventory

**Phase:** 2B.1  
**Audit date:** 2026-07-17  
**Mode:** Read-only survey  
**Coverage:** Daily Play, Team Tournament V6, Individual, Internal, Official + platform identity

---

## Summary counts

| Metric | Count |
|--------|-------|
| Inventory rows (significant implementations) | **48** |
| Distinct identity field patterns | **12** |
| Formats covered | Daily / Team / Individual / Internal / Official |
| Canonical suitability = Yes | 10 |
| Adapter only | 30 |
| No (out of domain / unsuitable) | 8 |

---

## Semantic boundary (enforced for this inventory)

| Term | Meaning | Not to confuse with |
|------|---------|---------------------|
| Participant | Person/org eligible to compete | Entry, Team, Lineup slot |
| Entry | Registration unit into competition/division/category | Lineup SQL row, pairing synthetic id |
| Team | Competing unit of multiple people | Daily court side `teamA`/`teamB` |
| Roster | Valid members of a Team in a competition | Referee roster |
| Lineup | Selected players for a specific match/tie/round | Roster, Entry |

---

## Inventory table

| # | File | Symbol | Format | Runtime | Identity field | Data shape (main) | Persistence | Consumer | Canonical | Risk |
|---|------|--------|--------|---------|----------------|-------------------|-------------|----------|-----------|------|
| 1 | `src/models/player.js` | `normalizePlayer` | All (athlete attrs) | Production | `id` | name, gender, playerType, skill/rating, Elo, status, tenantId | Club blob / `club_data_v3` | UI, engines, AI | Yes (profile attrs) | Medium |
| 2 | `src/models/tournament/entry.js` | `normalizeEntry`, `createEntryRecord` | Individual / Internal / Official | Production | `id`; `playerIds[]` | tournamentId, eventId, name, pairType, rating, seed, status, waitlistPosition, partnerInviteToken | Tournament blob | Registration, draw, seed, match | Yes (entry) | High |
| 3 | `src/models/tournament/constants.js` | `ENTRY_STATUS`, `PLAYER_TYPE`, `PAIR_TYPE`, `EVENT_TYPE` | All modes | Production | n/a | Enums for entry/player/event | In-code + blob | All tournament surfaces | Yes (enums) | Medium |
| 4 | `src/models/tournament/event.js` | `normalizeEvent` | Individual / Internal / Official | Production | `id` | eventType, entries[], groups, matches | Blob | Setup / draw | Adapter only | Low |
| 5 | `src/models/tournament/tournament.js` | `normalizeTournament` | All | Production | `id` | mode, events[], settings, status | Blob | Pages / services | Adapter only | Low |
| 6 | `src/models/tournament/match.js` | `normalizeMatch` | Individual / Internal / Official | Production | `entryAId`, `entryBId`, `winnerId` | Sides are **entries** | Blob | Match engines | Adapter only | Medium |
| 7 | `src/models/tournament/group.js` | `normalizeGroup` | Individual / Internal / Official | Production | `entryIds[]` | Group of entries | Blob | Draw / standings | Adapter only | Low |
| 8 | `src/models/user.js` | `normalizeUser` | Platform | Production | `id`; optional `playerId`, `teamId` | Auth user links | `profiles` + app model | Identity / portals | Adapter only | High |
| 9 | `src/features/club/models/clubMember.js` | `normalizeClubMember` | Club | Production | `id`; `playerId` | tenantId, clubId, role, status | Blob; SQL differs | Club UI | Adapter only | High |
| 10 | `src/features/club/models/clubMembershipRequest.js` | `normalizeClubMembershipRequest` | Club join | Production | `id`; `userId`; `approvedPlayerId` | Request lifecycle | SQL tables | My Club | No | Medium |
| 11 | `src/features/club/constants/clubMemberRoles.js` | `CLUB_MEMBER_STATUSES` | Club | Production | n/a | active/inactive/left/removed | In-code | Guards | Adapter only | Medium |
| 12 | `src/features/team-tournament/models/index.js` | `normalizeTeam` | Team V6 | Production | `id`; `playerIds[]`; `captainPlayerId` | deputies, absent/locked, seed, ratings | Blob `teamData` + cloud | Roster / draw | Yes (team) | High |
| 13 | same | `normalizeLineup` | Team V6 | Production | key `matchupId::teamId` | selections[disciplineId]=playerIds[], status, override | Blob + SQL | Captain / BTC | Yes (lineup) | Medium |
| 14 | same | `normalizeDiscipline` | Team V6 | Production | `id` | categoryType, genderRequirement, playerCount | Blob + SQL | Lineup validation | Adapter only | Low |
| 15 | same | `normalizeMatchup` | Team V6 | Production | `teamAId`, `teamBId` | Team vs team + subMatches | Blob + SQL | Schedule / referee | Adapter only | Low |
| 16 | same | `normalizeStanding` | Team V6 | Production | `teamId` | Team standings | Blob | UI / closing | Adapter only | Low |
| 17 | `src/features/team-tournament/repositories/teamTournamentRepositoryTypes.js` | `TeamMemberRecord`, `TeamRecord`, `LineupRecord` | Team V6 | Production (DTO) | `playerId`; team `id` | Repo contracts | Blob/cloud/shadow | Repository | Adapter only | Medium |
| 18 | `src/features/team-tournament/constants.js` | `LINEUP_STATUS`, `DISCIPLINE_CATEGORY` | Team V6 | Production | n/a | Lineup + discipline enums | In-code | Engines / UI | Yes (TT enums) | Low |
| 19 | `src/features/team-tournament/engines/lineupStateMachine.js` | `EXTENDED_LINEUP_STATUS` | Team V6 | Production | n/a | + withdrawn, overridden, expired | In-code | Lineup workflows | Adapter only | Medium |
| 20 | `src/features/team-tournament/engines/eligibilityEngine.js` | `checkPlayerEligibility` | Team V6 | Production | player `id` | age/gender/skill on roster | `teamData.settings` | Roster add | Adapter only | Medium |
| 21 | `src/features/team-tournament/engines/teamRosterEngine.js` | roster / MLP validation | Team V6 | Production | `playerId` | Roster composition rules | Blob | Team setup | Adapter only | High |
| 22 | `src/features/team-tournament/engines/teamRosterHydration.js` | `hydrateTeamRoster` | Team V6 | Production | `athleteId` + aliases | Opaque ID → athlete pool | In-memory | UI / engines | Yes (resolver) | High |
| 23 | `src/features/team-tournament/services/teamTournamentAthletePoolService.js` | `listAvailableAthletes` | Team V6 | Production | athleteId / pairingIdentityId / id | Unified athlete pool | Supabase + blob | Selectors | Yes (TT pool) | Medium |
| 24 | `src/features/team-tournament/canonical/teamTournamentSetupSnapshot.js` | `buildCanonicalSetupSnapshot` | Team V6 | Production | team id, rosterMembers | Setup snapshot package | Snapshot / RPC | Setup / showcase | Yes (snapshot) | Medium |
| 25 | `src/features/team-tournament/engines/lineupValidationContract.js` | `LINEUP_VALIDATION_CODE` | Team V6 | Production | invalidPlayerIds | Validation DTO | Client + server | Lineup UX | Adapter only | Low |
| 26 | `src/features/tournament-engine/types/tournamentTypes.js` | `EngineParticipant` | Individual / Internal / Official | Production (TE paths) | `id` ≈ entry id; `playerIds[]` | Seed metrics, status, seed | In-memory / engineV4 | Seed/draw/schedule | Adapter only | High |
| 27 | `src/features/tournament-engine/services/tournamentEngineAdapter.js` | `entryToParticipant`, `playersToParticipants` | Individual / Internal / Official | Production | entry.id or `entry-${player.id}` | Blob → EngineParticipant | In-memory | Engine hook | Adapter only | High |
| 28 | `src/features/competition-core/seed/seedTypes.js` | `CanonicalSeedObject`, `SeedRequest` | Core | Shadow | `participantId`, `entryId` | Seed score, rankingSnapshot | Contracts | Seed pipeline | Yes (seed handle) | Medium |
| 29 | `src/features/competition-core/seed/seedContracts.js` | `createCanonicalSeedObject` | Core | Shadow | `participantId` | Seed factory | In-memory | Seed adapters | Adapter only | Medium |
| 30 | `src/features/competition-core/types/index.js` | `RatingSnapshot`, constraint types | Core | Shadow / bridges | playersById; lineupSlots.playerId | Constraint context | In-memory | Constraints | Adapter only | Medium |
| 31 | `src/features/competition-core/constraints/evaluateHardRules.js` | `RulePlayerSnapshot` | Core / Daily bridges | Production via bridges | keyed by player id | gender, club, checkedIn, skill | In-memory | Hard rules | Adapter only | Medium |
| 32 | `src/features/competition-core/constants/ratingEligibilityStatus.js` | `RATING_ELIGIBILITY_STATUS` | Rating | Shadow/SQL-ready | n/a | eligible / ineligible / requires_review | In-code | Rating | Adapter only | Low |
| 33 | `src/features/individual-tournament/engines/registrationEngine.js` | registration lifecycle | Individual (+ shared) | Production | `entry.id` | Window, approve, waitlist, partner | Blob settings + entries | Registration UI | Adapter only | Medium |
| 34 | `src/features/individual-tournament/engines/eligibilityEngine.js` | eligibility rules | Individual | Production | player id / whitelist | age, gender, skill, rating, club, invite | Blob settings | Registration | Adapter only | Medium |
| 35 | `src/features/individual-tournament/engines/withdrawalEngine.js` | `WITHDRAWAL_STATUS` | Individual | Production | `entryId` | Withdrawal records | Blob settings | Ops | Adapter only | Low |
| 36 | `src/features/pairing-intervention/engines/entryInterventionEngine.js` | `recalculateEntry` | Internal / Official | Production | often `playerIds.join("|")` | Pair/team entry builder | Event.entries | Pairing UI | Adapter only | High |
| 37 | `src/tournament/engines/dailyPlayEngine.js` | checked-in players / sides | Daily | Production | `player.id`; `teamAPlayerIds`/`teamBPlayerIds` | Check-in + ephemeral sides | `settings.dailyPlay` | DailyPlaySetup / AI | Adapter only | Medium |
| 38 | `src/ai/engine.js` | `runAI` players input | Daily / court | Production | `player.id` | Selected players | Session / club | AI pairing | Adapter only | Low |
| 39 | `src/models/tournament/refereeRoster.js` | `normalizeRefereeRosterEntry` | All (refs) | Production | `id` | Referee list | Tournament settings | Referee assign | No | Low |
| 40 | `docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql` | `team_tournament_teams`, `_team_members`, `_lineups`, `_lineup_entries` | Team V6 | Staging/cloud (GA not verified) | `external_team_id`; `player_id` text | Cloud roster/lineup | Supabase | Cloud repo | Adapter only | High |
| 41 | `docs/v5/PHASE_42B_SCHEMA.sql` | `athletes`, `club_members`, `tenant_members` | Platform | Staging schema | `athletes.id`; membership FKs | Person vs membership | Supabase | Club / pairing | Yes (athlete) | High |
| 42 | `docs/supabase-rbac.sql` | `profiles` | Platform | Production-ready SQL | `id`=auth; `player_id` | Auth bridge | Supabase | Auth/RBAC | Adapter only | Medium |
| 43 | `docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql` | `match_participant_positions` | Live match | Staging/V5 | `player_id`, `team_id` | Court positions + snapshot_version | Supabase | Referee V5 | Adapter only | Medium |
| 44 | `docs/competition-core/supabase-cc02-rating-v2.sql` | `player_ratings` | Rating core | Not prod-apply | `player_id`, `auth_user_id` | Rating SSOT | Supabase | Rating engine | Adapter only | Medium |
| 45 | `src/domain/clubStorage.js` | `players` collection | All | Production | player `id` | Club blob players | Local + cloud blob | Everywhere | Adapter (storage) | Medium |
| 46 | `src/features/pairing-candidates/pairingEligibilityEvaluator.js` | pairing eligibility | Team / pairing | Production | athleteId + aliases | Scope/membership | Candidate pool | Athlete pool | Adapter only | High |
| 47 | `src/features/individual-tournament/adapters/ratingV5SeedAdapter.js` | `enrichParticipantWithRatingV5` | Individual | Production | participant/player | Snapshot rating on participant | In-memory | Seed | Adapter only | Low |
| 48 | `src/features/individual-tournament/engines/tournamentClosingEngine.js` | `freezeEventSnapshots` | Individual | Production | event/entry | Frozen standings/brackets | Blob settings | Closing | Snapshot pattern | Low |

---

## Per-format identity summary

| Format | Competition identity | Athlete link | Has Entry? | Has Team/Roster/Lineup? |
|--------|---------------------|--------------|------------|-------------------------|
| Daily Play | `player.id` in check-in + court sides | Direct | No | “Team” = court side only |
| Team Tournament V6 | `team.id` + roster `playerIds` + lineup selections | Intended `athletes.id` via hydration | No (team is unit) | Yes — full stack |
| Individual | `entry.id` per event | `playerIds[]` → club players | Yes | No team roster |
| Internal | Same as Individual; often BTC `ACTIVE` | Same | Yes | No |
| Official | Same; Open/AI Balance may synthesize entries | Same | Yes | No |

---

## Empty / thin scopes

| Path | Finding |
|------|---------|
| `src/types/` | No participant type files |
| `src/services/` | No participant model hits |
| `src/hooks/` | No participant model hits |
| `supabase/` (repo edge) | Rating/referee functions; no participant schema SSOT here |

---

## Highest-risk collisions

1. **Three person IDs:** `players.id` (blob) ↔ `athletes.id` (42B) ↔ `profiles.player_id`
2. **Overloaded “entry”:** tournament registration vs `team_tournament_lineup_entries` vs pairing `playerIds.join("|")`
3. **Overloaded “participant”:** `EngineParticipant.id` ≈ entry; seed `participantId` unbound; referee positions
4. **Overloaded “team”:** TT entity vs Daily/AI court side vs doubles display name “Đội”
5. **Club member dual shape:** blob `playerId` vs SQL `user_id` + `athlete_id`

---

## Files surveyed (representative)

Models: `src/models/player.js`, `user.js`, `tournament/{entry,event,tournament,match,group,constants,refereeRoster}.js`  
Club: `src/features/club/models/*`, membership constants  
Team: `src/features/team-tournament/models`, `constants`, `engines/*`, `services/*`, `canonical/*`, `repositories/*`  
Individual: `src/features/individual-tournament/engines/{registration,eligibility,withdrawal,tournamentClosing}Engine.js`, rating adapter  
TE4: `tournament-engine/types`, `tournamentEngineAdapter.js`  
Core: `competition-core/{types,seed,constraints,constants}`  
Daily/AI: `src/tournament/engines/dailyPlayEngine.js`, `src/ai/engine.js`  
SQL docs: PHASE_23C, PHASE_42B, referee V5A, supabase-rbac, CC rating SQL  
Storage: `src/domain/clubStorage.js`  
Pages (consumers): DailyPlaySetup, Internal/Official setups, IndividualRegistrationPage, TeamPortal
