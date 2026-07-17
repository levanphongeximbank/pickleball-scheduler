# 14 — Owner Decision Matrix

**Audit date:** 2026-07-17  
**Phase 2A update:** 2026-07-17  
**Instructions:** Owner selects one decision per row. Implementation must not proceed to next capability without approval.

**Decision values:** `APPROVE` | `APPROVE WITH CONDITIONS` | `DEFER` | `REJECT` | `NEEDS MORE EVIDENCE`

---

## Program decision (Owner — Phase 2A)

| Decision | Owner verdict | Date | Notes |
|----------|---------------|------|-------|
| Overall program GO | **GO WITH CONDITIONS** | 2026-07-17 | Strangler only; no big-bang |
| Migration strategy | **APPROVE** strangler | 2026-07-17 | Adapters + parity per capability |
| New formats (League/Ladder/Swiss/Americano) | **REJECT** until Phase 7 | 2026-07-17 | Freeze |
| Team Tournament V6 | **APPROVE** keep behavior; migrate per capability | 2026-07-17 | No V6 rewrite in 2A |
| Competition Core as SSOT | **APPROVE WITH CONDITIONS** | 2026-07-17 | Per capability, not bulk |
| Feature flags | **APPROVE** per-capability, default OFF | 2026-07-17 | No Production enable in Phase 2 |
| Production DB migration | **REJECT** in Phase 2 | 2026-07-17 | Ports first |
| Production execution path change | **REJECT** in Phase 2A | 2026-07-17 | Boundaries only |
| Delete legacy engines | **REJECT** in Phase 2A | 2026-07-17 | Deprecation after parity |
| Core independence | **APPROVE** — no reverse deps | 2026-07-17 | Enforced via CI lock |
| ESLint / architecture boundaries | **APPROVE** | 2026-07-17 | Implemented Phase 2A |
| Phase 2A deliverables | **APPROVE** | 2026-07-17 | See `15_PHASE_2A_ARCHITECTURE_BOUNDARIES.md` |

---

## Cross-cutting decisions

| Topic | Proposed action | Risk | Owner decision |
|-------|-----------------|------|----------------|
| Accept audit deliverables (Phase 0–1) | APPROVE to proceed Phase 2 | None | **APPROVE** 2026-07-17 |
| Freeze new competition engines | APPROVE until Phase 3 | Low | **APPROVE** 2026-07-17 |
| Freeze new formats (League/Ladder/Swiss) | APPROVE until Phase 7 | High if rejected | **APPROVE** 2026-07-17 |
| Keep all Core V2 flags OFF on Production | APPROVE | Low | **APPROVE** 2026-07-17 |
| TT cloud cutover | shadow → cloud_primary with scripts | High | _pending_ |
| Invert Core→TT adapters | APPROVE in Phase 3–4 | Medium | **APPROVE WITH CONDITIONS** — after parity |
| Extract `pages/*.logic.js` | APPROVE in Phase 2B–3 | Medium | **APPROVE** — start 2B |
| ESLint import boundaries | APPROVE in Phase 2 | Low | **APPROVE** — done 2A |
| No full rewrite | APPROVE strangler strategy | — | **APPROVE** 2026-07-17 |
| Architecture CI lock + baseline | APPROVE Phase 2A | Low | **APPROVE** 2026-07-17 |

---

## Capability decisions

| Capability | Current status | Candidate | Proposed action | Risk | Priority | Owner decision |
|------------|----------------|-----------|-----------------|------|----------|----------------|
| **rules** | PARTIAL — bridges live | `evaluateCanonicalRules` | PROMOTE_TO_CORE; shadow → staging | Medium | P0 | _pending_ |
| **participants** | MISSING unified | New participant module | BUILD in Phase 2B | Medium | P0 | **APPROVE** start 2B |
| **registration** | FORMAT scattered | Defer canonical | WRAP_WITH_ADAPTER per format | Low | P2 | _pending_ |
| **eligibility** | PARTIAL | individual engine as seed | EXTRACT contracts | Low | P2 | _pending_ |
| **teams** | TT complete | Format-owned | KEEP IN FORMAT | Low | — | **APPROVE** |
| **roster** | TT complete | — | KEEP IN FORMAT | Low | — | **APPROVE** |
| **lineup** | TT complete | Rules bridge only | KEEP IN FORMAT | Low | — | **APPROVE** |
| **seeding** | Shadow canonical | `runCanonicalSeedPipeline` | WIRE + parity | Medium | P1 | _pending_ |
| **draw** | 6+ paths; adapter live | `drawRuntimeAdapter` | INVERT TT dep; TE bridge | High | P1 | **APPROVE WITH CONDITIONS** — Phase 3C |
| **grouping** | Same as draw | Merge with draw | WRAP_WITH_ADAPTER | High | P1 | _pending_ |
| **pairing** | runAI live | matchmaking adapter | WIRE daily adapter | High | P1 | _pending_ |
| **matchmaking** | Unwired adapter | Same | Phase 5 Daily | High | P1 | _pending_ |
| **optimizer** | MISSING | Future | DEFER Phase 3I | Low | P3 | **DEFER** |
| **scheduling** | 10+ paths | validate → generate | EXTRACT fixtures; adapter | High | P1 | **APPROVE** extract in 2B–3 |
| **court-assignment** | Multiple | Defer | WRAP court-engine | Medium | P2 | _pending_ |
| **referee-assignment** | TT + pages | Format ops | MOVE TO OPERATIONS | Low | P2 | _pending_ |
| **match-lifecycle** | legacy matchEngine | Extract to core | PROMOTE Phase 3E | Medium | P1 | _pending_ |
| **scoring** | Duplicated rally | scoringRules contract | UNIFY validation Phase 3F | Medium | P2 | _pending_ |
| **result-validation** | Per-format | Defer | MOVE_BEHIND_PORT | Low | P2 | _pending_ |
| **standings** | 6+ paths | `calculateStandings` | Individual first → TT | High | P0 | _pending_ |
| **tie-break** | Per-format | `tieBreakCompare` | Policy injection | Medium | P1 | _pending_ |
| **qualification** | TE only | Defer | MERGE with standings | Medium | P2 | _pending_ |
| **advancement** | bracketEngine | Extract | WRAP_WITH_ADAPTER | Medium | P2 | _pending_ |
| **workflow** | Fragmented | New core module | DEFER Phase 3J | Medium | P2 | **DEFER** |
| **disputes** | matchLiveSync | New core module | DEFER Phase 3J | Medium | P2 | **DEFER** |
| **audit** | Fragmented | AuditRepository port | CONSOLIDATE | Low | P2 | _pending_ |
| **diagnostics** | CC traces | Keep pattern | KEEP | Low | P0 | **APPROVE** |
| **persistence** | Dual blob/cloud | Repository ports | Phase 2B stubs | High | P0 | **APPROVE** start 2B |
| **public-projection** | Split portals | Unified projection | Phase 6+ | Medium | P3 | **DEFER** |

---

## Priority order (recommended)

```text
P0 — rules, participants, standings, persistence ports, diagnostics
P1 — seed, draw, pairing, scheduling, match-lifecycle, tie-break, TT adapters
P2 — eligibility, scoring unify, workflow, disputes, court-assign
P3 — optimizer, public-projection, future formats
```

---

## Conditions template (active)

| Capability | Condition |
|------------|-----------|
| All Core V2 | Master + sub-flags OFF on Production until parity + Owner GO |
| draw / formation | Invert TT adapter only after internal/official parity pass |
| rating V2 | RPC moved out of core before any flag ON |
| TT cloud | shadow 2 weeks zero drift before cloud_primary |
| Phase 2B | Phase 2A PASS + no new architecture violations |

---

## Decision log

| Date | Capability | Decision | Notes |
|------|------------|----------|-------|
| 2026-07-17 | Audit phase | Deliverables submitted | Phase 0–1 complete |
| 2026-07-17 | Program | GO WITH CONDITIONS | Owner decisions locked for 2A |
| 2026-07-17 | Phase 2A | APPROVE | Boundaries + CI lock delivered |

---

## Next step

1. **Do not start Phase 2B** until Phase 2A PASS verdict confirmed in implementation report.
2. Phase 2B begins with P0: participants stubs, persistence ports, rating RPC port design.
3. Per-capability Phase 3 work requires row-level Owner approval before flag enable.
