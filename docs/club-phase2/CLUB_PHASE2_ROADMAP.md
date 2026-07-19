# Club Phase 2 Roadmap

**Status:** Historical audit roadmap — **authoritative sequence is** [CLUB_PHASE2_IMPLEMENTATION_SEQUENCE.md](./CLUB_PHASE2_IMPLEMENTATION_SEQUENCE.md)  
**Phase 2A:** **CLOSED** · **Phase 2B:** **LOCKED** · **Next implementation:** **2C** (not started)  
**Constraint:** Later phases require explicit GO before code/SQL. Committee **EXCLUDED**. Invitation + Captain/Coach **GO** (Captain/Coach **0..N**; optional primary Captain). Rating + activity-schedule ownership → **2F**. Invitation actor/identity → **2E**.

---

## Guiding principles

1. **V2 cloud tables + RPCs are the future SSOT** for club entity, membership, governance, join requests, invitations, captain/coach assignments.  
2. **No feature expansion on dual-write** without a cutover plan.  
3. **Boundaries first** — Player / Venue / Competition own their data; Club keeps references.  
4. **Server authz before UI sugar.**  
5. **Committee excluded** from Phase 2; Invitation and Captain/Coach are in scope (Phase 2E).  
6. **No peer writes Club SoT**; **no legacy Club blob access after cutover** (2G).

---

## Phase map (authoritative)

```text
2A Architecture audit          ← CLOSED
2B Domain & API freeze         ← LOCKED (docs)
2C Membership & roster parity  ← NEXT impl
2D Governance writer certification
2E Invitation + Captain/Coach cloud SoT
2F Module boundary cutovers    ← Rating + schedule ownership
2G Legacy writer / blob retirement
2H Final production certification
```

---

## Phase summaries (aligned with locked sequence)

| Phase | Status | Summary |
|-------|--------|---------|
| **2A** | **CLOSED** | Architecture audit pack; rating 6.5/10 |
| **2B** | **LOCKED** | Domain/API/writer/allow-list/gates freeze — docs only |
| **2C** | **NEXT** | Membership command certification + roster assignment **design** |
| **2D** | Planned | Governance single-writer certification (preserve 1B/1C) |
| **2E** | Planned | Invitation + Captain/Coach cloud SoT (0..N; optional primary Captain); lock invite actor/identity |
| **2F** | Planned | Boundary cutovers; **Rating** + **activity-schedule** ownership decisions; player repo home |
| **2G** | Planned | Legacy writers + peer blob access retirement |
| **2H** | Planned | Final Production certification |

Full briefs, safety rationale, and non-goals: [CLUB_PHASE2_IMPLEMENTATION_SEQUENCE.md](./CLUB_PHASE2_IMPLEMENTATION_SEQUENCE.md).  
Gates: [CLUB_PHASE2_ACCEPTANCE_GATES.md](./CLUB_PHASE2_ACCEPTANCE_GATES.md).

---

## Suggested sequencing vs other programs

| Parallel program | Interaction |
|------------------|---------------|
| Player Management | Coordinate player repo move in **2F** |
| Venue & Court | Court blob extraction plan in **2F** |
| Competition registration/teams | Club roster as input only (read) |
| Club Phase 1B/1C authz | **Do not regress**; Phase 2 builds on gates |

---

## Non-goals (Phase 2)

- Committee (excluded)  
- Production deploy from 2A/2B docs alone  
- New SQL in 2A/2B without Owner GO  
- Rewriting tournament engine inside Club  
- Peer writes to Club SoT  
- Legacy Club blob access after 2G cutover  

---

## Success metrics

| Metric | Target |
|--------|--------|
| Architecture rating | ≥ 8/10 after 2H |
| Dual membership writers in Production | 0 |
| Peer imports of Club storage internals | 0 (use public ports) |
| Security gate regressions | 0 |
| Undocumented entities in UI | 0 |
