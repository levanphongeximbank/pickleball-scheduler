# E2E-00 — Gap Analysis & Workstream Sequence (E2E-01..07)

**HEAD:** `48c608b6` (`origin/main`)

---

## H. Gap and dependency list

### Blocking gaps (must clear before / during IND vertical slice)

| ID | Type | Evidence | Impact | Owner | Treatment | Workstream | Unblock condition |
|----|------|----------|--------|-------|-----------|------------|-------------------|
| BG-01 | Integration | Identity evidence port defaults unavailable | No fail-open authz; all protected ops deny | E2E Integrator + Identity | Wire Identity→CORE-02 at composition root | E2E-01 | Authz decisions succeed with real evidence in tests |
| BG-02 | Integration | Club MembershipStatusPort stub/null | Club-scoped eligibility incomplete | E2E + Club | Real membership port | E2E-01 | Eligibility resolves club membership |
| BG-03 | Integration | Rating snapshot provider not single injected SoT | Seeding unreliable / dual stacks | E2E + Rating | Inject one provider | E2E-01 | Seeding uses one snapshot port |
| BG-04 | Integration | Venue court availability needs composition inject | Court assignment cannot schedule safely | E2E + Venue | Inject CAA provider into CORE-12 | E2E-01 | Court assignment uses live availability |
| BG-05 | Data model / Template | No IND Pool+KO CM template | Cannot instantiate target format from CM | E2E-02 | Add template seed + formatBlueprint | E2E-02 | Template selectable & instantiable |
| BG-06 | Runtime wiring | CORE-09 GROUP_RR + SINGLE_ELIM dormant; no Pool→KO composition | Cannot generate vertical match graph via Core | E2E-02 | Compose via workflow/integrator using Core executors | E2E-02 | Deterministic Pool then KO plan generated |
| BG-07 | Runtime wiring | All CM `wiredToProductionRuntime: false` | Create→publish→archive path not production | E2E-01/02/03 | Integrator wiring without reopening CM | E2E-01..03 | CM public commands drive IND lifecycle |
| BG-08 | Permission | CORE-02 not production-wired across portals | Ops portals may bypass Core authz | E2E-01/03/04 | Portal actions through CORE-02 | E2E-01 + ops | Portal mutations authorize via Core |
| BG-09 | Tenant isolation | Isolation asserted in contracts but not E2E path | Cross-tenant risk if UI uses legacy paths | E2E-01/06 | Fail-closed scope on all IND commands | E2E-01/06 | Missing tenant/venue fails closed |

### Non-blocking gaps

| ID | Type | Evidence | Treatment | Workstream |
|----|------|----------|-----------|------------|
| NB-01 | UI | Call Room missing | Build or Owner-defer | E2E-03 |
| NB-02 | UI | Match Center missing | Build or fold into public page | E2E-05 |
| NB-03 | UI | Incident handling missing | Defer post-MVP | Deferred |
| NB-04 | Experience | Tournament News mock-only | Defer | Deferred |
| NB-05 | Experience | Sponsor marks deferred + mock | Defer | Deferred |
| NB-06 | Integration | Finance payment port unwired | Fees optional for MVP | Deferred / E2E-01 soft |
| NB-07 | Integration | Ranking adapter optional | Seed without VPR OK | E2E-01 optional |
| NB-08 | Integration | Notification coverage narrow | Expand after schedule | E2E-01 P1 |
| NB-09 | Observability | No dedicated CE APM | Decision traces minimum | E2E-06 |
| NB-10 | Test | No IND Pool+KO E2E certification suite | Build in E2E-07 | E2E-07 |
| NB-11 | Documentation | Ops/Experience ownership split across legacy | Register + ADRs in E2E docs | E2E-00 (this) |
| NB-12 | Protest | Dispute-reset only | Formal protest post-MVP | E2E-06 / Deferred |

### Deferred post-MVP

League/Ladder/Corporate/Custom templates; CRM; File/Media; Streaming adapter; Federation; Swiss/Double Elimination; Sponsor commercial marks; Incident full workflow; Ceremony production ops.

---

## I. Recommended workstream sequence

### E2E-01 — Competition Integration Foundation

| Field | Content |
|-------|---------|
| Goal | Composition-root wiring of Identity, Venue, Player, Club, Rating, Notification adapters into Core/CM public ports; fail-closed tenant/venue/permission |
| In scope | INT-01..05, INT-09; GOV-09/10 foundation; IG-01/05; no new Core engines |
| Out of scope | Portal UI rewrite; Pool+KO format composition; Platform Core edits |
| Dependencies | Fresh `origin/main`; CM+Core CLOSED; Platform public APIs on main |
| File ownership (expected) | `src/features/competition-engine/integration/` or integrator composition under agreed E2E path; adapters that **consume** other modules; **not** `src/core/platform/**`; **not** reopening CM/Core capability folders except import |
| Required tests | Adapter contract tests; fail-closed missing tenant/identity; DI smoke for venue/rating/club |
| Start when | E2E-00 complete + Owner approve |
| Close when | BG-01..04 cleared; integration checklist green |
| Parallel | Can start alone; blocks E2E-02 soft but E2E-02 design docs can draft in parallel |

### E2E-02 — Individual Tournament Template & Pool + Knockout Format

| Field | Content |
|-------|---------|
| Goal | Canonical IND template + compose GROUP_RR → qualification → SINGLE_ELIM using Core |
| In scope | TPL-03, FMT-03, FMT-06 (RR/SE only); CM config blueprints; IND format adapter cutover plan |
| Out of scope | Team/Daily templates; Swiss/DE; production portal polish |
| Dependencies | E2E-01 ports available (or stubs fail-closed for unit tests only — not readiness proof) |
| File ownership | CM catalog seed (via CM public APIs / approved extension point); IND adapter; integrator composition; **no parallel match generator** |
| Required tests | Deterministic Pool+KO plan; replay hash; template instantiation patches |
| Start when | E2E-01 started; preferably after BG-01..04 |
| Close when | BG-05/06 cleared; Core reuse verified (no engine fork) |
| Parallel | After E2E-01 contracts freeze; not before |

### E2E-03 — Organizer Operations MVP

| Field | Content |
|-------|---------|
| Goal | Organizer path: configure → publish → open reg → seed/draw → schedule → court/ref assign → match control → score confirm → standings → advance → KO → champion → publish results → archive |
| In scope | OPS-01, OPS-08/09/10, OPS-06 (or defer), wiring to CM+Core |
| Out of scope | Captain portal; public marketing; incident full workflow |
| Dependencies | E2E-01 + E2E-02 |
| File ownership | Organizer pages/hubs; thin UI over integrator services |
| Required tests | Vertical organizer happy path (harness); permission deny paths |
| Start when | E2E-02 close criteria met |
| Close when | Organizer can complete Pool+KO without legacy engine fork |
| Parallel | E2E-04 after shared contracts freeze |

### E2E-04 — Player & Referee Operations MVP

| Field | Content |
|-------|---------|
| Goal | Player portal + check-in + canonical referee score entry for IND |
| In scope | OPS-03, OPS-04, OPS-05; score entry via Core |
| Out of scope | Team captain; Call Room if deferred in E2E-03 |
| Dependencies | E2E-01; schedule/match contracts from E2E-02/03 |
| File ownership | IND player portal; referee-v5 preferred canonical path |
| Required tests | Player view schedule/results; referee score→validation→standings |
| Start when | Match/score contracts stable from E2E-02/03 |
| Close when | One referee SoT for IND; check-in gates match start |
| Parallel | With E2E-03 after contract freeze; with E2E-05 carefully |

### E2E-05 — Public Competition Experience MVP

| Field | Content |
|-------|---------|
| Goal | Public live score/standing/bracket/schedule without mocks as proof |
| In scope | EXP-01..06; awards public results; optional streaming leave deferred |
| Out of scope | News CMS; sponsors; federation |
| Dependencies | E2E-02 results/standings/bracket data |
| File ownership | Public IND pages; kill mock readiness paths |
| Required tests | Public reads real competition fixtures; publish gates |
| Start when | Standings/bracket data available |
| Close when | EXP-01 not mock-dependent; schedule published readable |
| Parallel | With E2E-04 |

### E2E-06 — Governance & Reliability Runtime

| Field | Content |
|-------|---------|
| Goal | Audit, replay, validation, recovery, permission enforcement, isolation on IND path |
| In scope | GOV-01..07, GOV-09..11; OPS-12 policy |
| Out of scope | Full APM product; import file I/O productization |
| Dependencies | E2E-01..04 paths exist to govern |
| File ownership | Wiring CORE-20..23 + CORE-02 on IND commands |
| Required tests | Replay equality; audit events present; deny without tenant; recovery resume |
| Start when | E2E-03 path exists |
| Close when | Governance checklist green for IND |
| Parallel | Late overlap with E2E-05; before E2E-07 |

### E2E-07 — End-to-End Certification

| Field | Content |
|-------|---------|
| Goal | Certify full IND Pool+KO vertical slice; freeze readiness |
| In scope | Full flow test pack; GOV-08 benchmarks; regression vs Core/CM |
| Out of scope | New features |
| Dependencies | E2E-01..06 closed |
| File ownership | `docs/competition-engine/e2e-07/` + test suites |
| Required tests | Full vertical E2E; collision check vs fresh `origin/main` |
| Start when | E2E-01..06 closed |
| Close when | Owner certifies; marker `E2E_07_CERTIFICATION_COMPLETE` |
| Parallel | None — terminal gate |

---

## J. Parallelization plan

```text
E2E-00 (this) ──► E2E-01 ──► E2E-02 ──► E2E-03 ──┬──► E2E-06 ──► E2E-07
                                    │            │
                                    ├── E2E-04 ──┤
                                    └── E2E-05 ──┘

Team / Daily / League waves: AFTER IND certification (or separate tracks
that do not share files with active E2E worktrees).

Platform Core Final Closure: PARALLEL, isolated.
  - Competition E2E must not edit Platform Core.
  - Before PR/merge: fetch origin/main; retest if public API changed.
```

**Sequential hard gates:** E2E-00 → E2E-01 → E2E-02 → (E2E-03) → E2E-06 → E2E-07
**Soft parallel:** E2E-04 ∥ E2E-05 after E2E-02 contracts; E2E-06 overlaps late E2E-05

---

## Collision protocol (every E2E PR)

1. `git fetch origin main`
2. Diff public surfaces of `competition-core`, `competition-management`, `core/platform`
3. If collision / API change → sync main, re-run affected tests
4. Never merge on stale main
