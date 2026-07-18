# 17 — Risk Register

**Date:** 2026-07-18  
**Status:** Open for Owner review

| Risk ID | Description | Capability | Prob. | Impact | Detection | Mitigation | Rollback | Owner decision | Status |
|---------|-------------|------------|-------|--------|-----------|------------|----------|----------------|--------|
| R-01 | Identity collision across players/athletes/profiles | Participant | High | Critical | Parity BLOCKER; link audits | Canonical refs + mapping; no silent drop | LEGACY_FALLBACK + reconcile | Required before 3B cutover | Open |
| R-02 | Duplicate active Entry | Registration/Entry | Med | High | findActiveDuplicate parity | Idempotency + unique constraints | Flag OFF + reconcile | Pending registration row | Open |
| R-03 | Waitlist activation error | Registration | Med | High | Status transition tests | Explicit activation command | Manual repair | Pending | Open |
| R-04 | Roster corruption | Roster | Med | High | Revision checks | Optimistic lock | Restore revision | KEEP IN FORMAT — ports only | Open |
| R-05 | Lineup visibility leak | Lineup | Med | Critical | Security tests | Authz in service+RLS | Kill switch | Required | Open |
| R-06 | Seed drift after lock | Seeding | Med | High | Lock snapshot hash | Freeze seed context | Republish policy | Pending seed | Open |
| R-07 | Non-deterministic draw | Draw | High | High | NOT_COMPARABLE rate | Shared randomSeed | Stay SHADOW | Phase 3G conditions | Open |
| R-08 | Duplicate match generation | Match gen | Med | High | Match graph parity | Idempotent generate | Discard unpublished | Extract page logic | Open |
| R-09 | Schedule conflict | Schedule | Med | High | Conflict detector | Semantic comparator | Legacy schedule | Pending | Open |
| R-10 | Result divergence | Lifecycle/Scoring | Med | Critical | Parity + referee | Single write SSOT | Kill + reconcile | Required before 3J | Open |
| R-11 | Standings divergence | Standings | High | High | Multi-engine compare | One policy profile per format | Legacy ranking read | Pending standings | Open |
| R-12 | Dual-write split brain | Persistence | High | Critical | dual_write_failure metric | Outbox + reconcile | Stop secondary writes | OG-3.0C | Open |
| R-13 | Tenant data leakage | Security | Low | Critical | RLS tests | Tenant on all rows | Kill + incident | Required | Open |
| R-14 | Flag misconfiguration | Control plane | Med | High | Boot checks; denies metric | Hierarchy + tests | Kill switch | OG-3.0D | Open |
| R-15 | Partial cutover inconsistency | Cutover | High | High | Mode matrix dashboard | Per-competition mode | Sticky fallback | OG-3.0F | Open |
| R-16 | Rollback data mismatch | Rollback | Med | Critical | Reconcile jobs | Mandatory reconcile after writes | Manual repair window | OG-3.0G | Open |
| R-17 | Performance regression | Shadow/exec | Med | Med | p95 metrics | Sampling + async shadow | Drop samples | Budget in 3A | Open |
| R-18 | Shadow overload | Shadow | Med | Med | drop rate | Circuit breaker | Disable shadow | — | Open |
| R-19 | Legacy dependency hidden in UI | Architecture | High | High | Call-chain audit; CI lock | Fat controller slim; public API | N/A design | Continue 2A lock | Open |
| R-20 | TE4 competing stack drift | Seed/Draw/Schedule | High | Med | Dual UI paths | Freeze TE4 or force parity | Deprecate under 3N | Needed | Open |
| R-21 | TT cloud vs canonical SSOT clash | Team/Roster | High | High | DATA_MODE + CC modes | Single Owner policy | TT mode rollback | OG-3.0C | Open |
| R-22 | Grandfathered reverse deps | Match gen / CC | High | Med | Architecture lock 13 debt | Extract before 3H/3G invert | N/A | Approved with conditions | Open |
| R-23 | Rating V2 RPC inside core | Scoring/Elo | Med | High | CI baseline | Port extract before flag ON | Flag OFF | Existing condition | Open |
| R-24 | Skipping shadow to CANONICAL_ONLY | All | Low | Critical | Control plane deny | Hard forbid | — | Exception only | Watch |

---

## Blockers for Phase 3A start

```text
Owner GO missing on OG-3.0A–H
Persistence strategy undecided (OG-3.0C)
TT cloud vs hybrid SSOT policy undecided
```

Phase 3.0 itself is documentation-only and is **not** blocked from Owner review.
