# S1 — Individual Tournament: Test Plan

**Sprint:** Tournament V5 Sprint 1  
**Date:** 2026-07-14  
**Environments:** Local (`npm test`) · Staging Supabase + Vercel Preview  
**Production:** NO deploy · NO production test

---

## Test strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Node test runner (`npm test`) | Engines, models, adapters |
| Integration | Node + staging RPC | Propagation, idempotency, RLS |
| UI component | Existing test harness | Bracket, standings panels |
| Manual E2E | Owner staging checklist | Full BTC + player flows |
| Regression | `tournament-regression.test.js` | Legacy internal/official unchanged |

**Coverage target:** All P0 gaps have ≥1 automated test before batch merge.

---

## Existing test assets (reuse)

| File | Covers |
|------|--------|
| `tests/tournament-service.test.js` | Status transitions |
| `tests/tournament-models.test.js` | Model normalization |
| `tests/tournament-open-doubles.test.js` | Event types, open/mixed double |
| `tests/tournament-open-random.test.js` | Open random draw |
| `tests/tournament-seeding.logic.test.js` | Snake/open seeding |
| `tests/tournament-engine.test.js` | Seed/draw/schedule/courts |
| `tests/tournament-bracket.test.js` | Group→KO bracket |
| `tests/tournament-bracket.logic.test.js` | Bracket logic |
| `tests/tournament-internal.test.js` | Internal tournament plan |
| `tests/tournament-director.test.js` | Director mode |
| `tests/tournament-fixtures.logic.test.js` | RR fixtures + BYE |
| `tests/tournament-results.logic.test.js` | Results logic |
| `tests/competition-core-standings-cc08.test.js` | Canonical standings (#31 individual) |
| `tests/competition-core-rating-eligibility.test.js` | Rating eligibility |
| `tests/competition-core-scheduling-cc09.test.js` | Schedule conflicts |
| `tests/referee-rpc-security.test.js` | Token RPC RLS |
| `tests/v5-menu-audit.test.js` | Menu completeness |

**Team-only (reference, do not break):** `tournament-phase25.test.js`, `team-tournament-tt5*.test.js`, `team-tournament-tt6*.test.js`

---

## New tests required (by batch)

### S1-A — Engine + draw publish

| ID | Test | Type |
|----|------|------|
| T-S1-A01 | `useTournamentEngine` calls real orchestrator not platform stub | Unit |
| T-S1-A02 | Publish draw sets `publishedAt`; redraw blocked | Unit |
| T-S1-A03 | Force redraw with audit entry appended | Unit |
| T-S1-A04 | Workflow history records seed/draw actor | Unit |

**File:** `tests/individual-tournament-draw-publish.test.js`

### S1-B — Registration

| ID | Test | Type |
|----|------|------|
| T-S1-B01 | Registration window blocks submit outside dates | Unit |
| T-S1-B02 | Entry pending → approved → active path | Unit |
| T-S1-B03 | Waitlist promote ordering | Unit |
| T-S1-B04 | Partner invite token confirm binds player | Unit |
| T-S1-B05 | Cancel before lock removes entry | Unit |
| T-S1-B06 | Nav `?event=men_single` preselects event type | Unit |

**File:** `tests/individual-tournament-registration.test.js`

### S1-C — Eligibility & fees

| ID | Test | Type |
|----|------|------|
| T-S1-C01 | Age rule rejects ineligible player | Unit |
| T-S1-C02 | Gender rule rejects wrong gender for event | Unit |
| T-S1-C03 | Cross-event duplicate registration blocked | Unit |
| T-S1-C04 | Fee status unpaid blocks approve (if configured) | Unit |
| T-S1-C05 | Config page round-trip persist on blob | Integration |

**File:** `tests/individual-tournament-eligibility.test.js`

### S1-D — Rating V5 + standings

| ID | Test | Type |
|----|------|------|
| T-S1-D01 | Seed order matches Rating V5 display_rating desc | Unit |
| T-S1-D02 | Fallback to legacy Elo when V5 missing | Unit |
| T-S1-D03 | STANDINGS_V2 H2H resolves 2-way tie | Unit |
| T-S1-D04 | STANDINGS_V2 mini-table resolves 3-way tie | Unit |
| T-S1-D05 | Individual mapper CC-08 #31 regression | Unit |

**Files:** extend `tests/tournament-seeding.logic.test.js`, `tests/competition-core-standings-cc08.test.js`

### S1-E — Schedule

| ID | Test | Type |
|----|------|------|
| T-S1-E01 | Min rest violation fails schedule generation | Unit |
| T-S1-E02 | Publish schedule locks mutations | Unit |
| T-S1-E03 | Player time conflict detected | Unit |

**File:** `tests/individual-tournament-schedule.test.js`

### S1-F — Referee & propagation

| ID | Test | Type |
|----|------|------|
| T-S1-F01 | Finalize idempotency — duplicate command once | Integration |
| T-S1-F02 | Finalize updates standings exactly once | Integration |
| T-S1-F03 | Bracket sync after group match complete | Unit |
| T-S1-F04 | Correction request → approve → recompute | Integration |
| T-S1-F05 | Referee assignment scoped to match | Security |

**Files:** `tests/individual-tournament-referee.test.js`, staging RPC scripts

### S1-G — Results ops

| ID | Test | Type |
|----|------|------|
| T-S1-G01 | Walkover points in standings | Unit |
| T-S1-G02 | Withdrawn entry excluded from draw | Unit |
| T-S1-G03 | Third place match created when enabled | Unit |
| T-S1-G04 | Awards preview top 3 matches standings | Unit |

**File:** `tests/individual-tournament-results-ops.test.js`

---

## Manual staging checklist (pilot)

### BTC desktop — happy path

- [ ] **M1** Create official tournament with 2 events (đôi nam + đôi nữ)
- [ ] **M2** Set registration window; status transitions draft → registration → ready
- [ ] **M3** Configure eligibility (age + skill) and fee
- [ ] **M4** Approve 8 entries per event (mix manual + self-registration)
- [ ] **M5** Lock registration; run seed (V5 rating visible)
- [ ] **M6** Draw groups; publish draw; verify no redraw without audit
- [ ] **M7** Generate schedule; assign courts; publish schedule
- [ ] **M8** Assign referee; referee enters score; finalize
- [ ] **M9** Verify standings update (H2H tie scenario)
- [ ] **M10** Complete group stage; KO bracket populates
- [ ] **M11** Complete tournament; awards preview; status completed

### BTC mobile (375px)

- [ ] **M12** Navigate tournament hubs; touch targets ≥48px
- [ ] **M13** Bracket readable (horizontal scroll / timeline)
- [ ] **M14** Director mode score finalize

### Player mobile

- [ ] **M15** Self-register singles
- [ ] **M16** Register doubles + partner confirm link
- [ ] **M17** View my entries; cancel before lock

### Error / edge

- [ ] **M18** Register outside window → blocked message
- [ ] **M19** Ineligible rating → blocked/flagged
- [ ] **M20** Duplicate event registration → blocked
- [ ] **M21** Walkover recorded; standings correct
- [ ] **M22** Correction workflow after finalize
- [ ] **M23** Two devices finalize same match → no double-count

### Security

- [ ] **M24** Player cannot approve own entry
- [ ] **M25** Referee token cannot access other tenant match
- [ ] **M26** Cross-tenant tournament read blocked (RLS)

---

## Regression gates (every PR)

```bash
npm test
npm run build
npm run lint
```

**Must stay green:**
- All `tests/tournament*.test.js`
- `tests/competition-core-standings-cc08.test.js`
- `tests/v5-menu-audit.test.js`
- Team tournament suites (no regression)

---

## Evidence artifacts

Store under `docs/v5/qa-evidence/sprint-1-individual/`:

| Artifact | Content |
|----------|---------|
| `S1_UNIT_TEST_REPORT.json` | `npm test` output summary |
| `S1_STAGING_SMOKE_REPORT.json` | Manual checklist M1–M26 |
| `S1_SECURITY_RLS_REPORT.json` | Cross-tenant + referee scope |
| `S1_MULTI_DEVICE_REPORT.json` | Finalize idempotency |

---

## Test data fixtures

| Fixture | Purpose |
|---------|---------|
| `fixtures/s1-eight-players-doubles.json` | 8 players, 4 pairs, 2 groups |
| `fixtures/s1-h2h-tie-three-way.json` | 3-way mini-table scenario |
| `fixtures/s1-rating-v5-seed-order.json` | V5 display_rating seed oracle |

Create in `docs/v5/qa/tournament-individual/fixtures/` during S1-B.

---

## Exit criteria

| Gate | Condition |
|------|-----------|
| Automated | All T-S1-* tests PASS; zero regression in existing tournament suites |
| Manual | M1–M23 PASS on staging Preview |
| Security | M24–M26 PASS |
| Owner | Signed `S1_STAGING_SMOKE_REPORT.json` |

---

## Out of scope (no test required)

- Swiss / Double Elim runtime
- TV / livestream
- Public API
- Production environment
- Rating V5 singles (unless owner removes waiver)
