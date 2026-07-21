# 07 — Phase 1G Acceptance Criteria

**Status:** Checklist

---

## Persistence architecture

- [x] Application → contract → durable adapter → database client port
- [x] No concrete Supabase client in domain / application services
- [x] Injectable, testable client port
- [x] Memory repositories remain available / default composition

## Schema / SQL (authored, not applied)

- [x] Tables: tags, assignments, consent, pending events
- [x] Constraints, indexes, RLS, claim/release RPCs, grants
- [x] Consent append-only trigger authored
- [x] No Production IDs / secrets / destructive migrations
- [x] No SQL execution in Phase 1G

## Adapters

- [x] Durable Tag / TagAssignment / Consent / PendingEvent repositories
- [x] Explicit domain↔row mapping
- [x] Scope required on every operation
- [x] Unique conflicts → CRM conflict errors
- [x] Atomic pending-event enqueue
- [x] Guarded acknowledge / fail transitions
- [x] Claim / release via RPC mapping

## Tests / verification

- [x] `tests/crm-phase-1g-durable-persistence.test.js`
- [x] Phase 1B–1F regressions
- [x] Menu PARTIAL preserved
- [x] ESLint on new test; `lint:no-new`; `git diff --check`
- [x] Static secret scan

## Safety

- [x] No commit / push / PR from implementation agent
- [x] No other workstream files modified intentionally
- [x] No Staging / Production / deploy

## Verdict gate

Owner commit review required. Final agent verdict must be one of the Phase 1G stop codes.
