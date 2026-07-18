# 18 — Owner Gate Matrix

**Program:** Phase 3 Runtime Migration  
**Rule:** No Phase 3A implementation without **OG-3.0H = GO**

---

## Phase 3.0 gates

| Gate ID | Decision | Options | Required before | Owner verdict |
|---------|----------|---------|-----------------|---------------|
| **OG-3.0A** | Architecture package approved | GO / GO WITH CONDITIONS / NO-GO | Any 3.x impl | _pending_ |
| **OG-3.0B** | Capability migration order approved | Approve as in `04` / Amend order | 3A scope lock | _pending_ |
| **OG-3.0C** | Persistence strategy approved | A / **C (recommended)** / B / Hybrid variant | Dual-write design | _pending_ |
| **OG-3.0D** | Feature flag hierarchy + runtime overrides approved | Approve `05`/`10` / Amend | 3A impl | _pending_ |
| **OG-3.0E** | Shadow + parity model approved | Approve `07`/`08` / Amend | Production shadow hook | _pending_ |
| **OG-3.0F** | Pilot policy approved | Approve `11` / Amend | Any tenant pilot | _pending_ |
| **OG-3.0G** | Rollback + reconciliation policy approved | Approve `12` / Amend | Dual-write / primary | _pending_ |
| **OG-3.0H** | Phase 3A implementation approved | GO / NO-GO | **Start 3A coding** | _pending_ |

---

## Related locked Owner decisions (do not reopen casually)

From `14_OWNER_DECISION_MATRIX.md`:

| Topic | Locked verdict |
|-------|----------------|
| Strangler migration | APPROVE |
| New formats until Phase 7 | REJECT |
| Team/Roster/Lineup ownership | KEEP IN FORMAT |
| Core flags default OFF on Production | APPROVE |
| Production DB migration in Phase 2 | REJECT |
| Invert Core→TT after parity | APPROVE WITH CONDITIONS |
| Draw Phase 3C conditions | APPROVE WITH CONDITIONS |

---

## Outstanding capability rows (still `_pending_` in Owner matrix)

rules, registration, eligibility, seeding, grouping, pairing, matchmaking, court-assignment, referee-assignment, match-lifecycle, scoring, result-validation, standings, tie-break, qualification, advancement, audit, TT cloud cutover.

Phase 3.0 does **not** auto-approve these. Each needs row-level GO before flag enable / cutover.

---

## Decision log (Phase 3.0)

| Date | Gate | Verdict | Notes |
|------|------|---------|-------|
| 2026-07-18 | Phase 3.0 package submitted | — | Awaiting Owner review |
