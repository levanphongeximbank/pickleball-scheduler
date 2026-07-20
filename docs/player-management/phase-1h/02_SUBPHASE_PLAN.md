# Phase 1H — Sub-phase Plan

Companion to `00_PHASE_1H_SCOPE_FREEZE.md`. Owner-approved 2026-07-20 (`APPROVE_PHASE_1H_SCOPE`).

## Order (mandatory)

```
1H-A (privileged verification writer + authorization + audit)
    →
1H-B (admin verification queue reads)
    →
1H-C (admin verification actions)
    →
optional 1H-D (minimal admin / User Management entry)
```

Do not open public directory, legacy cutover, dedupe, full admin player management, or self-service verification under this plan.

Docs freeze precedes all application code. **No implementation in the freeze commit.**

---

## Existing foundation (consume; do not re-author SQL)

| Foundation | Source |
|------------|--------|
| `identity_verification_status` column + check constraint | Phase 1D/1E Production |
| Self-write block for verification | `profiles_guard_privileged_update` |
| Privileged other-user path (`user.manage` same venue / SUPER_ADMIN) | Phase 1D/1E Production |
| Partial index for non-`unverified` | Phase 1D/1E Production |
| App forbids verification on `updatePlayerProfile` | `PLAYER_PRIVILEGED_WRITE_FIELDS` |

**SQL requirement:** none expected.  
**Production schema apply:** not part of Phase 1H.

---

## 1H-A deliverables — Privileged verification writer

| Deliverable | Notes |
|-------------|--------|
| `updatePlayerVerificationStatus` | Explicit privileged service; contract name frozen |
| Not via `updatePlayerProfile` | Verification remains `FORBIDDEN_FIELD` on generic patch |
| Admin authorization | Checked before any write attempt |
| Tenant / venue enforcement | Align with existing DB guard semantics |
| Transition validation | Explicit matrix over `unverified` \| `pending` \| `verified` \| `rejected` |
| Audit logging | Every successful privileged write |
| Tests | Authorized success; unauthorized fail; self fail; transition reject |

**Status:** Merged to `main` (PR #104) — evidence `03_PHASE_1H_A_IMPLEMENTATION_EVIDENCE.md`.

---

## 1H-B deliverables — Admin verification queue

| Deliverable | Notes |
|-------------|--------|
| Queue list | `listPlayerVerificationQueue` — pending default; explicit status filters |
| Read path | Player facade; internal admin queue DTO (not public projector) |
| Authorization | Reuse Identity `user.manage` + SUPER_ADMIN / PLATFORM_ADMIN; venue isolation |
| Privacy | No raw privacy_settings / unrelated PII; public projector unchanged |
| Limit / sort | Max 100; `updatedAt` desc + playerId asc |
| UI | Deferred to optional 1H-D (no suitable non-invasive User Management entry) |
| Tests | Authz, filters, search, limit, sort, DTO exclusions, read-only |

**Status:** Implemented on branch (awaiting pre-commit review) — evidence `04_PHASE_1H_B_QUEUE_IMPLEMENTATION_EVIDENCE.md`.

---

## 1H-C deliverables — Admin verification actions

| Deliverable | Notes |
|-------------|--------|
| Set `pending` | Admin-only |
| Set `verified` | Admin-only |
| Set `rejected` | Admin-only |
| Optional `unverified` reset | Only if explicitly justified in implementation evidence |
| Audit | Every successful action |
| Tests | Action matrix + authz + audit side effects |

**Status:** Blocked on 1H-B acceptance (+ uses 1H-A writer).

---

## Optional 1H-D deliverables — Minimal entry point

| Deliverable | Notes |
|-------------|--------|
| Entry point | Existing admin / User Management shell only |
| Not in scope | Full Admin Player Management; legacy `/players` rewrite |

**Status:** Optional — not required to open 1H-A.

---

## Deferred (post–1H)

| Item | Prior label | Status |
|------|-------------|--------|
| Legacy writer / V2 dossier / blob cutover | 1F-D / 1G-D | **Deferred** |
| Public directory UI | 1F-B3 / 1G-E | **Deferred** |
| Duplicate merge / link tooling | Candidate E | **Deferred** |
| Broad audit / history product | Candidate F | **Deferred** |
| Full Admin Player Management | Candidate D | **Deferred** |
| Self-service verification / self→`pending` | — | **Deferred** (needs SQL) |

Reopening any deferred item requires Owner `REVISE_SCOPE`.

---

## Closure criteria (phase)

- Authorized admin transitions work.
- Unauthorized and self transitions fail.
- Transition matrix is explicit and tested.
- Tenant / venue isolation is tested.
- Audit entries are written.
- Focused verification tests pass.
- All `tests/player-management*.test.js` regressions pass.
- No SQL added or applied.
- No Production mutation for rollout.
- No deploy as part of Phase 1H closure.
- Closure evidence merged to `main`.

---

## Hard rules

1. No new Production schema SQL.
2. No Production SQL apply / deploy without separate Owner gate.
3. No expansion into deferred candidates without `REVISE_SCOPE`.
4. Do not rewrite Club / Competition / Ranking / Rating / Venue / Notification in this wave.
5. Do not implement application code until Owner authorizes **1H-A implementation**.
