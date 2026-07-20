# Phase 1H — Scope Freeze

**Owner decision:** `APPROVE_PHASE_1H_SCOPE`  
**Decision date:** 2026-07-20  
**Branch:** `feature/player-phase-1h-verification-admin`  
**Discovery audit base SHA:** `21f6b00a25b5489d9585fd9ff18fe386e5da1bee`  
**Branch cut base (`origin/main` at freeze authoring):** `3e2c486963e086f8124b889abc9a75a7625f9feb`  
**Classification:** **A — Authorized Player Verification Workflow (admin-only)**  
**Verdict:** `APPROVE_PHASE_1H_SCOPE`

---

## Context

| Item | State |
|------|-------|
| Phase 1A–1E | Complete |
| Phase 1E Production closure | Merged; foundation columns + guard **`ALREADY_READY`** |
| Phase 1F | Closed — self **read** + privacy projector + directory wire-up; B3 skipped |
| Phase 1G | Closed — Athlete self foundation **edit** (1G-A); 1G-B excluded |
| Deferred carried forward | Verification admin (was 1F-C / 1G-C); legacy cutover; public directory UI |
| Production `identity_verification_status` | **Exists** (`unverified` \| `pending` \| `verified` \| `rejected`) |
| Production self-write guard | **Blocks** self modification of `identity_verification_status` |
| Privileged DB path | Same-venue `user.manage` / `SUPER_ADMIN` may change verification on **others** |
| New Production schema for 1H | **Not required** |
| App privileged writer | **Missing** — `updatePlayerVerificationStatus` deferred in `writableFields.js` |

Discovery evidence: Player Management Phase 1H Discovery and Scope Recommendation Audit (read-only on `main` at `21f6b00`).  
Branch cut note: `origin/main` advanced to `3e2c486` with unrelated competition-core commits; discovery SHA remains an ancestor.

---

## Classification (frozen)

| Option | Role in Phase 1H |
|--------|------------------|
| **A. Authorized player verification workflow (admin-only)** | **Primary — selected** |
| **B. Legacy Player dossier/blob cutover** | **Deferred** |
| **C. Public Player Directory UI** | **Deferred** (was 1F-B3 / 1G-E) |
| **D. Admin Player Management** | **Deferred** — optional 1H-D is **minimal entry only**, not full admin |
| **E. Duplicate player identity resolution** | **Deferred** |
| **F. Player audit & history product** | **Deferred** — verify-action audit only in this phase |

---

## Existing foundation (do not re-migrate)

1. `identity_verification_status` already exists in Production (Phase 1D/1E).
2. Existing Production guard blocks self verification writes.
3. Privileged same-venue `user.manage` / `SUPER_ADMIN` path already exists in the DB guard.
4. Partial index for non-`unverified` rows already exists (admin queue support).
5. **No new SQL expected** for this phase.

App work completes the missing privileged writer + admin queue/actions on top of that foundation.

---

## Status model (required)

| Value | Meaning |
|-------|---------|
| `unverified` | Default; not under review |
| `pending` | Actionable; awaiting admin decision |
| `verified` | Admin-confirmed identity verification |
| `rejected` | Admin-rejected |

These map to `IDENTITY_VERIFICATION_STATUS` in Player Management. Rating verification statuses remain out of scope and must never be accepted as identity verification.

---

## Sub-phases

### 1H-A — Privileged verification writer (PRIMARY)

1. Explicit `updatePlayerVerificationStatus` service (name frozen as contract intent).
2. Never accept verification status via generic `updatePlayerProfile`.
3. Admin authorization checked **before** write.
4. Same-tenant / same-venue enforcement aligned with existing guard semantics.
5. Explicit transition validation against the status model.
6. Audit logging on every successful privileged action.

### 1H-B — Admin verification queue

1. List pending / actionable Player records (non-`unverified` and/or `pending`-first product rules).
2. Read through Player facade / **internal** viewer mode only.
3. No raw public exposure; public/directory projectors must not leak verification internals.

### 1H-C — Admin verification actions

1. Admin may set: `pending`, `verified`, `rejected`.
2. Optional reset to `unverified` only if explicitly justified in implementation evidence.
3. Audit every successful action.

### Optional 1H-D — Minimal admin entry point

1. Minimal entry from existing admin / User Management shell.
2. Do **not** build full Admin Player Management.
3. Do **not** rewrite legacy `/players` dossier.

### Deferred (not Phase 1H without `REVISE_SCOPE`)

| Item | Notes |
|------|--------|
| Legacy dossier / club blob cutover | Was 1F-D / 1G-D |
| Public Player Directory UI | Was 1F-B3 / 1G-E |
| Duplicate merge / link tooling | Candidate E |
| Broad Player audit/history product | Candidate F beyond verify-action audit |
| Full Admin Player Management | Candidate D |
| Self-service verification request / self→`pending` | Requires SQL change; excluded |

**Hard rule:** Do **not** expand into deferred items without Owner `REVISE_SCOPE`.

---

## Safety rules (mandatory)

1. Self cannot modify `identity_verification_status` (app + existing DB guard).
2. Normal `updateSelfProfile` remains forbidden for verification fields.
3. Generic `updatePlayerProfile` must not accept verification status (`FORBIDDEN_FIELD` / privileged list).
4. Privileged writer must be **explicit** (`updatePlayerVerificationStatus`).
5. Authorization must be checked **before** write.
6. Venue / tenant boundary must be enforced.
7. Every successful privileged action must be audited.
8. Public and directory projections must never expose raw verification internals.

---

## Explicit out of scope (this phase)

- Self-service verification request
- Self → `pending` (or any self verification write)
- New SQL or schema
- Production SQL apply
- Public Player Directory UI
- Legacy dossier / blob cutover
- Duplicate merge tooling
- Full Admin Player Management
- Club / Competition / Rating / Ranking rewrites
- Production deployment
- Mixing deferred candidates into the same delivery wave without `REVISE_SCOPE`

---

## Implementation order (mandatory)

```
1H-A (service + authorization)
    →
1H-B (queue reads)
    →
1H-C (admin actions)
    →
optional 1H-D (minimal UI entry)
```

Docs freeze only on this commit wave. Application code starts only after Owner authorizes **1H-A implementation**.

---

## Entry conditions

- [x] Phase 1G closed on `main`
- [x] Phase 1E Production foundation columns + guard ready; no new schema expected
- [x] Owner `APPROVE_PHASE_1H_SCOPE`
- [x] Branch cut from latest `main` (ancestor includes discovery SHA `21f6b00`)
- [x] Scope-freeze docs authored (this package)
- [ ] Implementation proceeds only under this freeze (1H-A → 1H-B → 1H-C; optional 1H-D)
- [ ] No Production mutation / SQL apply / deploy without separate Owner approval

---

## Closure criteria

- Authorized admin transitions work.
- Unauthorized and self transitions fail.
- Transition matrix is explicit.
- Tenant / venue isolation is tested.
- Audit entries are written for successful privileged actions.
- Focused verification tests pass.
- All Player Management regressions pass.
- No SQL added or applied.
- No Production mutation for rollout.
- No deploy as part of Phase 1H closure.
- Closure evidence merged to `main`.

---

## Conditions (from Owner decision)

1. Freeze Phase 1H as classification **A — admin-only verification workflow** only.
2. Do **not** include self-service verification, public directory, legacy cutover, dedupe, or full admin player management in the same phase.
3. No Production schema apply expected; any Production change needs a separate Owner gate.
4. Do not reopen Phase 1G; this is a new wave completing deferred verification admin debt.

---

## Exact Owner action next

Authorize **1H-A implementation** on this branch when ready (privileged verification writer first).  
Do **not** expand into deferred scopes without `REVISE_SCOPE`.  
Do **not** authorize Production SQL apply or deploy under this freeze.
