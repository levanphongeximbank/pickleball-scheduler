# E2E-00 — Competition Engine Capability Register (3.3–3.8)

**HEAD audited:** `48c608b6` (`origin/main`)
**Workstream:** E2E-00 Readiness & Architecture Mapping
**Rule:** Status derived from implementation evidence, not docs alone. CM 8/8 and Core 23/23 ≠ layers 3.3–3.8 complete.

**Status values:** `IMPLEMENTED` | `PARTIAL` | `CONTRACT_ONLY` | `MOCK_ONLY` | `MISSING` | `DEFERRED` | `NOT_APPLICABLE`

**Priority:** `P0` blocking Individual Tournament Pool+Knockout vertical slice | `P1` MVP ops/experience | `P2` hardening / extended | `P3` post-MVP

---

## 3.3 Competition Operations

| Code | Name | Layer | Owner | Status | Evidence | Dependency | Vertical slice | Workstream | Priority | Completion condition |
|------|------|-------|-------|--------|----------|------------|----------------|------------|----------|----------------------|
| OPS-01 | Organizer Portal | 3.3 | `pages/tournament` + tournament hubs | PARTIAL | `src/pages/tournament/TournamentHome.jsx`, hubs in `TournamentSectionPages.jsx`, routes `/tournament/organize`, `/tournament/operations` | Identity, CM publication (dormant), Core engines | Individual | E2E-03 | P0 | Single organizer ops shell wired to CM+Core public APIs for Pool+KO lifecycle |
| OPS-02 | Team Captain Portal | 3.3 | `team-tournament` + `pages/tournament/TeamPortal.jsx` | IMPLEMENTED | TeamPortal, lineup engines, `/team-portal/:tournamentId` | Team roster/lineup Core contracts | Team Tournament (not IND MVP) | E2E-04 / Team wave | P2 | N/A for IND Pool+KO; keep as Team wave |
| OPS-03 | Player Portal | 3.3 | `individual-tournament` | IMPLEMENTED | `IndividualPlayerPortalPage.jsx`, `playerPortalEngine.js`, `/tournament/my` | Registration, schedule publish | Individual | E2E-04 | P0 | Portal consumes Core registration/schedule/result contracts (not only legacy engines) |
| OPS-04 | Referee Portal | 3.3 | `referee-v5` + classic referee + TT portal | PARTIAL | `RefereeScoreboard.jsx`, `TeamRefereePortal.jsx`, `src/features/referee-v5/*` | Referee assignment Core, scoring | Individual | E2E-04 | P0 | One canonical referee path for IND score entry; no parallel SoT |
| OPS-05 | Check-in | 3.3 | `mobile` (+ court-engine / daily) | PARTIAL | `checkInService.js`, `CheckInDashboardPage.jsx`, daily check-in | Identity, venue, registration | Individual | E2E-04 | P0 | Competition-scoped check-in gate before match control |
| OPS-06 | Call Room | 3.3 | — | MISSING | No CallRoom module; closest `preMatchReadiness.js` (not UI, not root-exported) | Check-in, court, referee | Individual | E2E-03 | P1 | Call-room queue UI + readiness gate or explicitly DEFERRED with Owner sign-off |
| OPS-07 | Lineup Submission | 3.3 | `team-tournament` (runtime); Core `lineups/` (contracts) | IMPLEMENTED | TeamPortal + lineup engines; Core `createLineupResolver` | Teams, eligibility | Team / not IND MVP | E2E-04 Team | P2 | Team wave; IND Pool+KO uses pairing/slots not team lineup |
| OPS-08 | Score Entry | 3.3 | referee tracks + director | PARTIAL | Director score panel; TT rally; referee-v5 dispatcher; Core `scoring/` capability-local | Match lifecycle, result validation | Individual | E2E-03/04 | P0 | Score entry writes through Core scoring + validation public surfaces |
| OPS-09 | Match Control | 3.3 | referee-v5 / director / TT; Core `matches/` local | PARTIAL | Start/finalize/undo; `matches/services/transitions.js` not root-wired | Workflow, court, referee | Individual | E2E-03 | P0 | Unified match state machine via Core match + workflow exports |
| OPS-10 | Live Operations | 3.3 | director + mobile + TT realtime | PARTIAL | `TournamentDirectorMode.jsx`, operations mobile dashboard, TT realtime | Live score sync | Individual | E2E-03 | P1 | Organizer live ops board for courts/matches of one competition |
| OPS-11 | Incident Handling | 3.3 | — | MISSING | Doc: incident NOT IMPLEMENTED; forfeit reason codes only | Match control, audit | Extended | E2E-06 / Deferred | P3 | Incident report workflow or DEFERRED post-MVP |
| OPS-12 | Protest & Dispute | 3.3 | director + scoreLog | PARTIAL | `DISPUTE_RESET` only; no formal protest adjudicate | Audit, scoring | Individual | E2E-06 | P2 | Formal protest submit/adjudicate or DEFERRED with dispute-reset only for MVP |
| OPS-13 | Award & Ceremony | 3.3 | individual/team awards engines | PARTIAL | `awardsEngine.js`, Awards pages; ceremony = showcase animation | Standings, archive | Individual | E2E-05/07 | P1 | Awards assignment + public results; true ceremony DEFERRED |

---

## 3.4 Competition Experience

| Code | Name | Layer | Owner | Status | Evidence | Dependency | Vertical slice | Workstream | Priority | Completion condition |
|------|------|-------|-------|--------|----------|------------|----------------|------------|----------|----------------------|
| EXP-01 | Live Score | 3.4 | IND live sync vs `public-portal` mock | PARTIAL | Real: `useMatchLiveScores`, PlayerLiveResults; Public: `MOCK_LIVE_SCORES` | Match sync, permissions | Individual | E2E-05 | P0 | Public live score reads real competition data (no mock as readiness proof) |
| EXP-02 | Live Standing | 3.4 | IND/TT + Core standings | IMPLEMENTED | `getLiveStandings`, public IND page, Core `calculateCanonicalStandings` | Scoring results | Individual | E2E-05 | P0 | Spectator standings use Core canonical standings for Pool stage |
| EXP-03 | Live Bracket | 3.4 | components/tournament/bracket | IMPLEMENTED | BracketView, hubs, DirectorBracketSync | Knockout draw | Individual | E2E-05 | P0 | Bracket reflects Core draw/match plan for KO stage |
| EXP-04 | Match Center | 3.4 | — | MISSING | No Match Center product; `getMatchCenterY` is layout math only | Live score/schedule | Individual | E2E-05 | P1 | Dedicated Match Center page or fold into public schedule+live with Owner approval |
| EXP-05 | Public Schedule | 3.4 | IND/TT publish engines | IMPLEMENTED | `publishScheduleEngine`, public gate `isSchedulePublished` | CM publication (dormant), schedule Core | Individual | E2E-05 | P0 | Schedule publish path aligned with CM publication contracts |
| EXP-06 | Player / Team Profile | 3.4 | `player` (+ TT roster) | PARTIAL | PlayerProfile pages; team profile = roster edit only | Player adapter | Individual | E2E-05 | P1 | Competition-scoped player card; team profile N/A for IND |
| EXP-07 | Tournament News | 3.4 | `public-portal` | MOCK_ONLY | `getPublicNews` → `MOCK_NEWS` | CMS / branding | Extended | Deferred | P3 | Real news or DEFERRED post-MVP |
| EXP-08 | Streaming Integration | 3.4 | `tournament-broadcast` | PARTIAL | Flag-gated capture/relay/VOD in Official setup | Media, permissions | Extended | Deferred / E2E-05 opt | P2 | Optional for IND MVP; not blocking Pool+KO |
| EXP-09 | Sponsor Exposure | 3.4 | CM branding + public mock | DEFERRED | `SPONSOR_MARKS_DEFERRED`; `MOCK_SPONSORS` | CM branding | Extended | Deferred | P3 | Owner lift of deferral + non-mock surface |

---

## 3.5 Competition Templates

| Code | Name | Layer | Owner | Status | Evidence | Dependency | Vertical slice | Workstream | Priority | Completion condition |
|------|------|-------|-------|--------|----------|------------|----------------|------------|----------|----------------------|
| TPL-01 | Daily Play Template | 3.5 | CM-02 | PARTIAL | `cm-global-daily-play`; `wiredToProductionRuntime: false` | CM-01 definition | Daily Play wave | Post-IND | P2 | Production wiring + UI selection |
| TPL-02 | Team Tournament Template | 3.5 | CM-02 | PARTIAL | `cm-global-team-tournament-mlp4` | CM-01, TT format | Team wave | Post-IND | P2 | Production wiring |
| TPL-03 | Individual Tournament Template | 3.5 | CM-02 + IND module | PARTIAL | Closest: internal/official seeds; no dedicated “Individual Pool+KO” template | CM-01/02/04, format blueprint | Individual | E2E-02 | P0 | Canonical IND Pool+KO template seed + formatBlueprintId |
| TPL-04 | League Template | 3.5 | — | MISSING | Not in `COMPETITION_TYPE` / catalog | Club league model | League wave | Deferred | P3 | New type+template or NOT_APPLICABLE to Club |
| TPL-05 | Ladder Template | 3.5 | Core format hint | CONTRACT_ONLY | `COMPETITION_FORMAT_HINT.LADDER` only | — | Extended | Deferred | P3 | Template + runtime or DEFERRED |
| TPL-06 | Club Championship Template | 3.5 | CM-02 test seed | MOCK_ONLY | `cm-tenant-club-cup` isolation sample | — | Extended | Deferred | P3 | Product template or remove from MVP claims |
| TPL-07 | Corporate Tournament Template | 3.5 | — | MISSING | No type/seed | — | Extended | Deferred | P3 | New template or DEFERRED |
| TPL-08 | Custom Tournament Template | 3.5 | CM-02 | DEFERRED | `FORMAT_PRESET.custom` fail-closed | — | Extended | Deferred | P3 | Explicit Owner unlock |

---

## 3.6 Competition Formats

| Code | Name | Layer | Owner | Status | Evidence | Dependency | Vertical slice | Workstream | Priority | Completion condition |
|------|------|-------|-------|--------|----------|------------|----------------|------------|----------|----------------------|
| FMT-01 | Daily Play Format | 3.6 | `daily-play` adapters | PARTIAL | Map-only adapters; unwired | Core matchmaking/formation | Daily wave | Post-IND | P2 | Runtime cutover |
| FMT-02 | Team Tournament Format | 3.6 | `team-tournament` adapters | PARTIAL | Map-only; TT engines remain SoT | Core teams/lineups | Team wave | Post-IND | P2 | Runtime cutover |
| FMT-03 | Individual Tournament Format | 3.6 | `individual-tournament` adapters | PARTIAL | `adapters/competition-core/`; engines still SoT | Core draw/seed/match-gen/standings | Individual | E2E-02 | P0 | Pool+KO composed path via Core strategies + IND adapter |
| FMT-04 | League Format | 3.6 | Club league | NOT_APPLICABLE | Club `league.js` ≠ CE format runtime | Club product | League | Deferred | P3 | Confirm ownership: Club vs CE |
| FMT-05 | Ladder Format | 3.6 | Core hint | CONTRACT_ONLY | Hint enum only | — | Extended | Deferred | P3 | Runtime or DEFERRED |
| FMT-06 | Extended Formats | 3.6 | CORE-09 | PARTIAL / DEFERRED | Supported: RR, GROUP_RR, SINGLE_ELIM, TEAM_FIXTURE (dormant); Swiss/DoubleElim deferred | Match generation | Foundation + IND | E2E-01/02 | P0 for Pool+KO pieces | Wire GROUP_RR + SINGLE_ELIM composition; keep Swiss/DE deferred |

**Composition note:** There is no single `POOL_THEN_KNOCKOUT` strategy. Vertical slice must compose `GROUP_ROUND_ROBIN` → qualification → `SINGLE_ELIMINATION` via workflow/integrator (E2E-02).

---

## 3.7 Competition Integration

| Code | Name | Layer | Owner | Status | Evidence | Dependency | Vertical slice | Workstream | Priority | Completion condition |
|------|------|-------|-------|--------|----------|------------|----------------|------------|----------|----------------------|
| INT-01 | Identity & Permission Adapter | 3.7 | Identity + CORE-02 | PARTIAL | `identityEvidencePort`; default unavailable → deny | Platform identity | Individual | E2E-01 | P0 | Injected Identity evidence port in composition root |
| INT-02 | Venue & Court Adapter | 3.7 | `venue-court` + CORE-12 | PARTIAL | CAA public APIs; DI availability provider | Venue inventory | Individual | E2E-01 | P0 | Composition-root injection for court availability |
| INT-03 | Player Profile Adapter | 3.7 | `player` + Core participants | PARTIAL | Participant mappers; multi-source person SoT | Player module | Individual | E2E-01 | P0 | Stable participant snapshot from Player public API |
| INT-04 | Club Adapter | 3.7 | `club` + MembershipStatusPort | PARTIAL | Stub/null membership ports in eligibility | Club V3 | Individual | E2E-01 | P0 | Real MembershipStatusPort → Club |
| INT-05 | Player Rating Adapter | 3.7 | player-rating / pick-vn-rating / Core rating | PARTIAL | Snapshot ports; dual stacks; IND `ratingV5SeedAdapter` | Rating SoT | Individual | E2E-01 | P0 | Single injected rating snapshot provider for seeding |
| INT-06 | Ranking Adapter | 3.7 | `vpr-ranking` | PARTIAL | VPR bridge; CE port mostly consume-only | VPR | Individual | E2E-01 | P2 | Optional for Pool+KO; wire if seeding uses ranking |
| INT-07 | Finance & Payment Adapter | 3.7 | `finance` + paymentStatusPort | CONTRACT_ONLY | Finance not wired to Competition | Finance | Individual | E2E-01 / Deferred | P2 | Null→UNKNOWN fail-closed OK for fee-optional MVP |
| INT-08 | CRM Adapter | 3.7 | `crm` | MISSING | No CE CRM port | CRM | Extended | Deferred | P3 | Not required for Pool+KO |
| INT-09 | Notification Adapter | 3.7 | `notifications` | PARTIAL | `competitionMatchScheduledAdapter` one-way | Schedule events | Individual | E2E-01 | P1 | Schedule/result notify events for IND MVP |
| INT-10 | File & Media Adapter | 3.7 | — | MISSING | CORE-22 excludes file storage | — | Extended | Deferred | P3 | Not required for engine path |
| INT-11 | Streaming Adapter | 3.7 | — | MISSING | No CE streaming port | Broadcast feature | Extended | Deferred | P3 | N/A for Pool+KO engine |
| INT-12 | External API & Federation | 3.7 | Platform descriptor only | MISSING | Descriptor projection ≠ live ports | Platform | Extended | Deferred | P3 | N/A for local MVP |

---

## 3.8 Competition Governance & Reliability

| Code | Name | Layer | Owner | Status | Evidence | Dependency | Vertical slice | Workstream | Priority | Completion condition |
|------|------|-------|-------|--------|----------|------------|----------------|------------|----------|----------------------|
| GOV-01 | Rule Versioning | 3.8 | CORE-01 + CM-03 | PARTIAL | Rule set version + CM versioning dormant | CM definition | Individual | E2E-06 | P1 | Competition locks ruleSetVersion at publish |
| GOV-02 | Competition Audit & Event Log | 3.8 | CORE-20 audit | PARTIAL | Envelope/sink; not root barrel; Identity audit separate | Workflow | Individual | E2E-06 | P0 | Competition audit sink wired for IND lifecycle events |
| GOV-03 | Deterministic Seed & Replay | 3.8 | CORE-21 | PARTIAL | Capability-local; not root-exported | Seeding/draw | Individual | E2E-06 | P0 | Replay harness for Pool+KO generation |
| GOV-04 | Data Validation | 3.8 | CORE-17 + validators | PARTIAL | Result validation capability-local; legacy validators still live | Scoring | Individual | E2E-06 | P0 | Results pass Core validation before standings |
| GOV-05 | Import / Export Governance | 3.8 | CORE-22 (root) | PARTIAL | Package validate/redact; no file I/O | Recovery | Hardening | E2E-06 | P2 | Dry-run package for IND competition |
| GOV-06 | Recovery & Resume | 3.8 | CORE-23 (root) | PARTIAL | Pure evaluation; no DB backup | Workflow | Individual | E2E-06 | P1 | Resume after mid-tournament interrupt |
| GOV-07 | Observability & Monitoring | 3.8 | runtime-control / traces | PARTIAL | Shadow diagnostics; no dedicated APM | — | Hardening | E2E-06 | P2 | Minimum decision-trace for critical path |
| GOV-08 | Benchmark & Diagnostics | 3.8 | various baselines | PARTIAL | Formation/format diagnostics | — | Hardening | E2E-07 | P2 | Perf sanity for Pool+KO size targets |
| GOV-09 | Security & Permission Enforcement | 3.8 | CORE-02 + Identity | PARTIAL | Fail-closed missing evidence; prod wiring deferred | INT-01 | Individual | E2E-01/06 | P0 | All IND ops paths authorize via CORE-02 |
| GOV-10 | Tenant / Venue Isolation | 3.8 | CM + Venue + Core entities | PARTIAL | Asserted when IDs present; not E2E prod path | INT-02/04 | Individual | E2E-01/06 | P0 | Fail-closed missing tenant/venue/club scope |
| GOV-11 | Compatibility & Migration Control | 3.8 | CORE-22 + CM-02 + Platform | PARTIAL | Dual-write deferred; cutover integrator-owned | Legacy adapters | Foundation | E2E-01 | P1 | Explicit cutover plan for IND legacy engines |

---

## Ownership invariants (locked)

1. Do **not** re-implement Core engines inside E2E workstreams.
2. Do **not** treat CM 8/8 / Core 23/23 as Operations/Experience/Template/Format/Integration/Governance completion.
3. Format adapters may only import Core/CM **public** surfaces; Core must not import format features.
4. `src/core/platform/**` is consumed only via existing public entry; Competition E2E must not edit Platform Core.
5. Missing Platform public API needed by E2E → stop with `E2E_BLOCKED_BY_PLATFORM_CORE_GAP`.
