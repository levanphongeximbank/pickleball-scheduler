# CORE-13 — Ownership Boundary

**Module:** `src/features/competition-core/referee-assignment/`
**Capability-local public surface:** `referee-assignment/index.js`
**Protected:** root `competition-core/index.js` (Integrator-owned; Phase 1B does not modify it)
**Schema:** `CORE13_REFEREE_ASSIGNMENT_SCHEMA_V1`

---

## 1. Owner supersession

The historical Owner Decision Matrix row that classified **referee-assignment** as **“MOVE TO OPERATIONS”** is **superseded** for assignment **decision ownership**.

**CORE-13 is the canonical Competition Core owner** of referee assignment evaluation and planning contracts (eligibility, availability, conflicts, workload, manual validation, replacement request/result shapes, unassigned diagnostics, deterministic inputs/outputs).

Referee **identity/profile** management and referee **portal / scoring operations** remain **outside** CORE-13 (product / identity / referee-v5).

---

## 2. CORE-13 owns

- Referee eligibility evaluation **contracts**
- Referee availability evaluation **contracts**
- Assignment planning **contracts**
- Workload calculation **contracts**
- Referee-specific **conflict facts** (domain facts + CORE-14 projection shape)
- Manual assignment validation **contracts**
- Replacement request and result **contracts**
- Deterministic assignment inputs and outputs (helpers in Phase 1B; planner later)
- Unassigned requirement diagnostics **contracts**

---

## 3. CORE-13 does not own

| Concern | Owner |
|---------|-------|
| Referee identity / profile (name, phone, user creation) | Identity / directory product |
| Referee authentication / session | Identity |
| Referee portal UI / live scoring | referee-v5 / product |
| Match generation | CORE-09 |
| Schedule generation | Schedule Engine (CORE-11 when numbered) |
| Court inventory / court assignment | Court Assignment (CORE-12 when numbered) |
| **Generic resource conflict resolution** | **CORE-14 Resource Conflict Resolver** |
| Match lifecycle / scoring / standings | Match Lifecycle consumer (not CORE-14) / scoring / standings modules |
| Notification delivery | Product |
| Persistence migrations / Supabase tables | Integrator / product |
| Deployment | Ops |
| Legacy individual/team/court assign engines | Legacy product (adapters later; not Phase 1B) |

---

## 4. CORE-14 boundary (Owner-corrected)

**CORE-14 is the Resource Conflict Resolver.**

**CORE-14 is not Match Lifecycle.**

- CORE-13 may produce referee-specific conflict facts / projections (`resourceType = REFEREE`) for CORE-14 to consume or reconcile.
- CORE-14 does **not** own referee assignment decisions.
- Any Match Lifecycle consumer must be documented **separately** and must **not** be labelled CORE-14.
- Phase 1B does **not** import CORE-14 implementation or private contracts.

---

## 5. Identity boundary

`RefereeCandidate` is an **assignment projection**, not an identity/profile aggregate.

May reference: `refereeId`, `active`, optional `userId` / `playerId`, `organizationIds`, `clubIds`, qualification refs, preference tags, optional read-only `displayLabel`.

Must **not** own: referee names as authoritative profile data, phones, profile updates, user creation, authentication, certification persistence.

---

## 6. Allowed dependency direction

```text
Ports (directory, quals, availability, schedule, existing assignments, conflict policy, audit sink, workload history)
        │
        ▼
   CORE-13 contracts / (later) pure engine
        │
        ▼
  AssignmentPlan / Failure / Conflict facts / ResourceConflictProjection
        │
        ▼
  Consumers: Integrator, Match Lifecycle (separate), CORE-14 (conflict aggregation only)
```

- No React, Supabase, browser APIs, or network inside the pure module.
- No deep-import of CORE-09 / CORE-10 / legacy private implementations.
- Root barrel remains untouched until Integrator certification.

---

## 7. Phase 1B non-goals

- Assignment planner / auto-assign / replacement execution
- Product adapters / legacy engine wiring
- Final plan fingerprint algorithm (prep helpers only)
- UI, SQL, deploy
