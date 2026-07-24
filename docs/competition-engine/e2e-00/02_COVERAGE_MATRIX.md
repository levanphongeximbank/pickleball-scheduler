# E2E-00 — Coverage Matrix

**HEAD:** `48c608b6` (`origin/main`)
**Rule:** Every capability maps to ≥1 wave, or is `DEFERRED` / `NOT_APPLICABLE` with reason. No ownerless rows.

**Waves**

| Wave key | Meaning |
|----------|---------|
| FND | Foundation (CM + Core closed + E2E-01 integration) |
| IND | Individual Tournament Pool + Knockout (E2E-02..07) |
| TEAM | Team Tournament wave (post-IND) |
| DAILY | Daily Play wave (post-IND) |
| LL | League / Ladder wave |
| EXT | Extended Formats / commercial / federation |
| HARD | Final Hardening / Certification (E2E-06/07) |

Legend: `●` in-scope owner | `○` consume/reuse | `D` deferred | `N` not applicable | `—` out of wave

---

## Matrix

| Code | Capability | FND | IND | TEAM | DAILY | LL | EXT | HARD | Owner workstream | Notes |
|------|------------|-----|-----|------|-------|----|-----|------|------------------|-------|
| OPS-01 | Organizer Portal | ○ | ● | ○ | ○ | — | — | ○ | E2E-03 | Wire to CM+Core |
| OPS-02 | Team Captain Portal | — | N | ● | — | — | — | ○ | Team wave | N/A IND MVP |
| OPS-03 | Player Portal | ○ | ● | — | — | — | — | ○ | E2E-04 | |
| OPS-04 | Referee Portal | ○ | ● | ○ | — | — | — | ○ | E2E-04 | Canonicalize score path |
| OPS-05 | Check-in | ○ | ● | ○ | ○ | — | — | ○ | E2E-04 | Competition-scoped |
| OPS-06 | Call Room | — | ● | ○ | — | — | D | ○ | E2E-03 | May Owner-defer to post-MVP |
| OPS-07 | Lineup Submission | ○ | N | ● | — | — | — | ○ | Team wave | N/A IND |
| OPS-08 | Score Entry | ○ | ● | ○ | ○ | — | — | ○ | E2E-03/04 | Via Core scoring |
| OPS-09 | Match Control | ○ | ● | ○ | ○ | — | — | ○ | E2E-03 | |
| OPS-10 | Live Operations | ○ | ● | ○ | — | — | — | ○ | E2E-03 | |
| OPS-11 | Incident Handling | — | D | D | — | — | ● | ○ | Deferred / E2E-06 | Post-MVP unless Owner pulls in |
| OPS-12 | Protest & Dispute | ○ | ○ | ○ | — | — | ● | ● | E2E-06 | MVP may keep dispute-reset only |
| OPS-13 | Award & Ceremony | ○ | ● | ○ | — | — | D | ○ | E2E-05/07 | Ceremony animation deferred |
| EXP-01 | Live Score | ○ | ● | ○ | — | — | — | ○ | E2E-05 | Kill public mocks for readiness |
| EXP-02 | Live Standing | ○ | ● | ○ | — | — | — | ○ | E2E-05 | Core standings |
| EXP-03 | Live Bracket | ○ | ● | ○ | — | — | — | ○ | E2E-05 | |
| EXP-04 | Match Center | — | ● | ○ | — | — | D | ○ | E2E-05 | Or fold into public page |
| EXP-05 | Public Schedule | ○ | ● | ○ | — | — | — | ○ | E2E-05 | Align CM publication |
| EXP-06 | Player / Team Profile | ○ | ● | ○ | — | — | — | ○ | E2E-05 | Team profile N for IND |
| EXP-07 | Tournament News | — | D | D | — | — | ● | — | Deferred | Mock-only today |
| EXP-08 | Streaming | — | D | ○ | — | — | ● | — | Deferred | Optional |
| EXP-09 | Sponsor Exposure | — | D | D | — | — | ● | — | Deferred | CM deferred + mock |
| TPL-01 | Daily Play Template | ○ | — | — | ● | — | — | ○ | Daily wave | |
| TPL-02 | Team Tournament Template | ○ | — | ● | — | — | — | ○ | Team wave | |
| TPL-03 | Individual Tournament Template | ○ | ● | — | — | — | — | ○ | E2E-02 | Pool+KO seed required |
| TPL-04 | League Template | — | — | — | — | ● | — | — | LL / Club ownership | Missing in CE |
| TPL-05 | Ladder Template | — | — | — | — | ● | D | — | LL Deferred | Contract-only |
| TPL-06 | Club Championship Template | — | — | — | — | — | D | — | Deferred | Mock seed only |
| TPL-07 | Corporate Tournament Template | — | — | — | — | — | D | — | Deferred | Missing |
| TPL-08 | Custom Tournament Template | — | — | — | — | — | D | — | Deferred | Fail-closed |
| FMT-01 | Daily Play Format | ○ | — | — | ● | — | — | ○ | Daily wave | |
| FMT-02 | Team Tournament Format | ○ | — | ● | — | — | — | ○ | Team wave | |
| FMT-03 | Individual Tournament Format | ○ | ● | — | — | — | — | ○ | E2E-02 | Compose Pool+KO |
| FMT-04 | League Format | — | — | — | — | N/● | — | — | Club vs CE decision | NOT_APPLICABLE until Owner assigns |
| FMT-05 | Ladder Format | — | — | — | — | D | — | — | Deferred | |
| FMT-06 | Extended Formats | ○ | ○ | ○ | ○ | — | ● | ○ | E2E-02 + EXT | Swiss/DE deferred; RR/SE for IND |
| INT-01 | Identity & Permission | ● | ○ | ○ | ○ | ○ | ○ | ○ | E2E-01 | |
| INT-02 | Venue & Court | ● | ○ | ○ | ○ | ○ | ○ | ○ | E2E-01 | |
| INT-03 | Player Profile | ● | ○ | ○ | ○ | ○ | ○ | ○ | E2E-01 | |
| INT-04 | Club | ● | ○ | ○ | ○ | ○ | ○ | ○ | E2E-01 | |
| INT-05 | Player Rating | ● | ○ | ○ | ○ | ○ | ○ | ○ | E2E-01 | |
| INT-06 | Ranking | ○ | ○ | ○ | ○ | ○ | ● | ○ | E2E-01 optional | Non-blocking IND |
| INT-07 | Finance & Payment | ○ | D/○ | ○ | — | — | ● | ○ | E2E-01 / Deferred | Fee-optional MVP |
| INT-08 | CRM | — | D | D | — | — | D | — | Deferred | Missing |
| INT-09 | Notification | ● | ○ | ○ | ○ | — | ○ | ○ | E2E-01 | |
| INT-10 | File & Media | — | D | D | — | — | D | — | Deferred | |
| INT-11 | Streaming Adapter | — | D | D | — | — | D | — | Deferred | |
| INT-12 | External API & Federation | — | D | D | — | — | D | — | Deferred | |
| GOV-01 | Rule Versioning | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-02 | Audit & Event Log | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-03 | Deterministic Seed & Replay | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-04 | Data Validation | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-05 | Import / Export | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-06 | Recovery & Resume | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-07 | Observability | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-06 | |
| GOV-08 | Benchmark & Diagnostics | ○ | ○ | ○ | ○ | ○ | ○ | ● | E2E-07 | |
| GOV-09 | Security & Permission | ● | ○ | ○ | ○ | ○ | ○ | ● | E2E-01/06 | |
| GOV-10 | Tenant / Venue Isolation | ● | ○ | ○ | ○ | ○ | ○ | ● | E2E-01/06 | |
| GOV-11 | Compatibility & Migration | ● | ○ | ○ | ○ | ○ | ○ | ● | E2E-01 | |

---

## Closed foundation (consume only — not counted as 3.3–3.8 complete)

| Foundation package | Status | E2E rule |
|--------------------|--------|----------|
| Competition Management CM-01..08 | CLOSED 8/8 | Consume public barrel only; no reopen |
| Competition Core CORE-01..23 | CLOSED 23/23 | Consume public / capability-local barrels; no parallel engines |

---

## Coverage completeness check

| Check | Result |
|-------|--------|
| Every capability has owner workstream or Deferred/N/A | PASS |
| No capability left unmapped | PASS |
| IND vertical slice P0 set identified | PASS (see gaps doc) |
| Mock-only not counted as IND readiness | PASS (EXP-07, EXP-09, TPL-06) |
