# 09 — Lifecycle and Locking

**Phase:** 2B.1  
**Note:** Design proposal. Does **not** change Team Tournament V6 or Individual Production behavior.  
**Owner decisions:** OD-04, OD-05, OD-06, OD-08, OD-09 are **OWNER APPROVED** (see `11_`).

---

## Minimum status set (Entry / Participant competition status)

```text
DRAFT → PENDING → ELIGIBLE / INELIGIBLE
                → APPROVED / WAITLISTED   (WAITLISTED lives on Registration — OD-10)
                → ACTIVE
                → COMPLETED
         ↘ WITHDRAWN / DISQUALIFIED
```

Also: CANCELLED/REJECTED may remain Format extensions mapped to WITHDRAWN/INELIGIBLE for Core queries.

---

## Named lifecycle markers (Core contract)

| Marker | Meaning | Owner policy |
|--------|---------|--------------|
| `ROSTER_LOCKED` | Roster member set immutable except substitution workflow | Must occur **before** Competition/Stage `IN_PROGRESS` (OD-04). UI lock ≠ SSOT. |
| `SEED_LOCKED` | Seed inputs (rating snapshot) frozen for draw/seed | Seeding uses this snapshot only (OD-09). Live rating does not auto-update seed. |
| `DRAW_LOCKED` | Draw published/frozen | Re-seed only via deliberate pipeline **before** this marker. |

---

## Competition-level gate

| Tournament status (today) | Participant implication |
|---------------------------|-------------------------|
| `draft` / `registration` | Entries mutable; roster mutable |
| `ready` | Soft locks recommended; Format may emit `ROSTER_LOCKED` / `SEED_LOCKED` here |
| `active` (= IN_PROGRESS) | Hard locks; `ROSTER_LOCKED` must already have fired; substitution default NOT ALLOWED (OD-05) |
| `completed` | Freeze snapshots |
| `cancelled` | Terminal |

---

## When can Entry be edited?

| Field | Before APPROVED | After APPROVED, before ACTIVE | After competition ACTIVE |
|-------|-----------------|-------------------------------|---------------------------|
| memberRefs / playerIds | Yes | Format policy (partner change) | No (except audited Format sub) |
| name / club display | Yes | Yes | Snapshot preferred (OD-08 APPROVED) |
| status | Workflow | Workflow | Withdraw/DQ only |
| seed | Until `SEED_LOCKED` | No after publish | No |
| waitlist | On Registration only (OD-10) | N/A if approved | No |

---

## Roster lock (OD-04 OWNER APPROVED)

Lock via explicit lifecycle event `ROSTER_LOCKED`, **before** Competition or Stage `IN_PROGRESS`.

| Phase | Roster |
|-------|--------|
| Setup | Mutable |
| After `ROSTER_LOCKED` | Add/replace only via substitution workflow |
| After IN_PROGRESS | Default NOT ALLOWED; Format exception requires full audit (OD-05) |

TT today: `lockedPlayerIds` / absent lists exist; adapters map to `ROSTER_LOCKED` without changing V6 behavior in 2B.1/2B.2.

---

## Lineup submit and lock (OD-06 OWNER APPROVED)

| Status | Meaning |
|--------|---------|
| not_submitted / draft | Editable by captain |
| submitted | Captain finished; may still edit until deadline (Format) — each change = new revision |
| locked | Immutable except override |
| published | Visible per Format visibility rules |
| overridden | BTC change; new revision |

**Versioning:** Full immutable chain. Minimum fields: `lineupId`, `revision`, `previousRevisionId`, `submittedAt`, `submittedBy`, `lockedAt`, `status`, `slots`, `reason`.

Registration/eligibility: append-only decisions sufficient.

---

## Substitutions (OD-05 OWNER APPROVED)

| Scenario | Allowed? |
|----------|----------|
| Before `ROSTER_LOCKED` | Yes (edit roster) |
| After lock, before first match / IN_PROGRESS | Format policy + substitution workflow |
| After IN_PROGRESS | **Default NOT ALLOWED**. Format may allow with: reason, requester, approver, replaced, replacement, effectiveAt, eligibility validation, audit. |
| Direct mutate of locked roster | **Forbidden** |
| Lineup after lock | Override workflow only (new revision) |

---

## Snapshot / version requirements

| Data | Snapshot? | When |
|------|-----------|------|
| Entry member set | Yes | On APPROVED and on competition start |
| Display name / rating / eligibility attrs / affiliation / source ref | Yes (OD-08) | Registration or lock; timestamp required |
| Roster | Yes | On `ROSTER_LOCKED` |
| Lineup | Version chain | Each submit/change/lock/override |
| Eligibility inputs | Decision snapshot | Each evaluation |
| Closing standings | Existing freeze helpers | Tournament complete |

Snapshot does **not** replace the source profile (OD-08).

---

## Seed rating (OD-09 OWNER APPROVED)

Seeding uses rating snapshot at `SEED_LOCKED`.

Live rating changes after that do **not** automatically change seed or draw. Updating seed requires a deliberate seed-pipeline action **before** draw lock.
