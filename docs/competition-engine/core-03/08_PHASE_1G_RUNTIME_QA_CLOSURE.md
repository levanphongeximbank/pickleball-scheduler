# CORE-03 Phase 1G — Runtime QA Closure

**Wave:** 1 / CORE-03
**Phase:** 1G — Runtime QA, Migration Readiness, and Final Closure
**Module:** `src/features/competition-core/registration-eligibility/`
**Branch intent:** `feature/competition-core-03-runtime-qa`

---

## 1. Phase 1A–1G summary

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1A | Contracts, enums, policies, ports, fixtures | Merged |
| 1B | Registration lifecycle service | Merged |
| 1C | Eligibility evaluation orchestration | Merged |
| 1D | Capacity & waitlist runtime | Merged |
| 1E | Sibling Core adapters (injected facades) | Merged |
| 1F | Persistence foundation + authored SQL | Merged / `AUTHORED_NOT_APPLIED` |
| 1G | Runtime composition QA, reconciliation, migration readiness, closure | This phase |

---

## 2. Delivered capabilities

- Draft → submit → review lifecycle
- Eligibility evaluation with sibling adapters
- Capacity reserve / release
- Waitlist place / withdraw / promote (scope-bound authorization)
- Persistence repositories (memory adapters) + authored SQL
- Idempotent replay + optimistic concurrency fail-closed
- Partial-success / `reconciliationRequired` signaling
- Deferred Core-02 Entry creation (`DEFERRED_FAIL_CLOSED`)
- Phase 1G test-only runtime composition harness (not a Production root)

---

## 3. Public contracts and services

Capability barrel: `registration-eligibility/index.js`

- Enums / errors / contracts / policies / ports
- `createRegistrationLifecycleService`
- `createEligibilityEvaluationService`
- `createCapacityWaitlistService`
- `createCore03SiblingAdapters`
- `createCore03PersistenceRepositories`
- `CORE03_PHASE_1F_MIGRATION_STATUS`
- `CORE03_PHASE_1G_CLOSURE_STATUS` (closure metadata only)

Protected root barrel `competition-core/index.js` is **not** modified and does **not** re-export Core-03.

---

## 4. Sibling adapter status

| Sibling | Adapter status | Notes |
|---------|----------------|-------|
| Core-01 Rule Engine | Wired via injected facade | Malformed/exception → fail closed |
| Core-02 Participant | Wired via injected facade | Canonical pair identity |
| Core-02 Entry lookup | Wired via injected facade | Duplicate/active entry detection |
| Core-02 Entry creation | `DEFERRED_FAIL_CLOSED` | Request/env cannot enable |
| Core-04 Division | Wired via injected facade | Incompatible division fails closed |
| Core-05 Team roster | Wired via injected facade | Invalid/stale roster fails closed |

---

## 5. Persistence status

- Memory repository adapters implement Core-03 ports
- Optimistic concurrency via `stateVersion` / `expectedStateVersion`
- Audit append-only (repository rejects update/delete; SQL triggers authored)
- Transaction helpers with rollback where store supports transactions
- Non-transaction path reports partial-success + `reconciliationRequired`

---

## 6. Migration status

`MIGRATION_STATUS = AUTHORED_NOT_APPLIED`

- SQL authored: `supabase-core03-phase1f-persistence.sql`
- Rollback authored: `supabase-core03-phase1f-persistence-rollback.sql`
- Verification query pack authored (not executed)
- Staging checklist authored (no step executed that connects to DB)
- No database connection from Phase 1G
- No SQL apply from Phase 1G

---

## 7. Deferred gaps

1. `TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED` (deny-all only; no tenant ownership model)
2. `CORE02_ENTRY_CREATION = DEFERRED_FAIL_CLOSED` (APPROVED→Entry handoff)
3. Live Supabase executor / Production composition root
4. Formal director-approval service beyond waitlist promote / test-only approve helper
5. Automatic reconciliation worker (explicitly out of scope)
6. Staging/Production SQL apply (separate Owner GO)

---

## 8. Runtime QA result

Test-only harness composes:

- ClockPort, IdGeneratorPort
- Persistence registration / audit / evidence / capacity / reservation / waitlist repos
- Sibling adapters (Core-01/02/04/05 facades)
- Lifecycle + eligibility + capacity services

Covered flows include happy-path registration, eligibility variants, capacity/waitlist,
idempotent replay, stale versions, adapter fail-closed, deferred Entry, and reconciliation hooks.

---

## 9. Test totals

| Suite | Count |
|-------|-------|
| Phase 1A | 27 |
| Phase 1B | 25 |
| Phase 1C | 40 |
| Phase 1D | 55 |
| Phase 1E | 62 |
| Phase 1F | 42 |
| Phase 1G | 52 |
| **Total Core-03 1A–1G** | **303** (all pass) |

---

## 10. Ownership boundaries

| Owns | Does not own |
|------|--------------|
| Core-03 registration/eligibility runtime | Core-01/02/04/05 business logic |
| Core-03 persistence adapters + authored SQL | Legacy Phase 3C tables |
| Fail-closed Entry handoff boundary | Authentication runtime |
| Migration readiness docs | Deployment configuration / env files / package locks |
| | Protected root barrel / `scripts/ci/unit-test-files.json` |

---

## 11. Staging prerequisites

See `10_STAGING_ROLLOUT_CHECKLIST.md`. Minimum:

- Owner GO
- Backup / restore point
- Staging identity confirmation
- Read-only preflight + dry run
- Apply + verification queries
- Smoke tests + RLS/grant verification
- Owner Staging sign-off

---

## 12. Production prerequisites

- Separate Production Owner GO after Staging sign-off
- Fresh backup / restore plan
- No client write grants; RLS remains fail-closed until tenant model approved
- Entry creation remains deferred unless a dedicated Owner instruction lifts it

---

## 13. Known risks

- Eligibility evidence bridge is required between evaluation and capacity (harness helper; not yet a Production composer)
- Formal non-waitlist approval orchestration is still deferred (test-only composition helper documents the gap)
- Partial-success paths require trained operator recovery; automatic recovery is unsafe
- Authored SQL not yet applied — runtime DB behavior unverified in Staging

---

## 14. Closure verdict

**Verdict:** `CORE03_READY_TO_CLOSE`

Owner-accepted conditions that remain (not Phase 1G defects):

- Migration remains `AUTHORED_NOT_APPLIED`
- Entry creation remains `DEFERRED_FAIL_CLOSED`
- Tenant client RLS remains `DEFERRED_FAIL_CLOSED`
- No Production composition root shipped

Final machine-readable marker: `CORE03_PHASE_1G_CLOSURE_STATUS`.

---

## 15. Next recommended work

1. Staging-first SQL apply under Owner GO + checklist
2. Optional Core-03 Production composition root (Integrator-owned wiring)
3. Dedicated APPROVED decision service (if Owner prioritizes non-waitlist approval)
4. Core-02 Entry handoff activation under separate Owner instruction
5. Tenant RLS ownership model design (then replace deny-all client policy)

---

## Safety affirmation

Phase 1G does not:

- connect to a database
- apply SQL
- deploy
- mutate Staging or Production
- enable Core-02 Entry creation
- modify protected root barrel, package files, or CI unit-test allowlist
