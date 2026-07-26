# 07 — Post-Closure Maintenance, Change Control, And Revalidation

After PGO-09 closure, Platform Governance & Operations documentation remains living. Changes must not silently inflate certification vocabulary.

## Documentation maintenance

| Activity | Rule |
|----------|------|
| Editorial fix (typo, broken relative link) | Allowed under PGO docs ownership; no vocabulary elevation |
| Add evidence pointers | Allowed; do not claim verification without Owner-attested package |
| Rewrite authority / readiness verdicts | Requires Owner GO |
| Touch outside `docs/platform-governance-operations/**` | Out of PGO scope unless separate Owner GO workstream |

## Control ownership change

When a named control owner changes:

1. Update the owning PGO domain doc and authority map references.
2. Reconfirm SoD conflicts (PGO-06/PGO-08).
3. Mark related operating evidence for refresh.
4. Do not inherit prior Owner GO certifications automatically.

## Environment change

New environment, project binding, or promotion path:

- Update PGO-04 (+ PGO-01 matrix if baseline changes).
- External console evidence remains **`NOT_VERIFIED`** until Owner-attested.
- Cadence/SLA numbers stay **`PROVISIONAL_NOT_CERTIFIED`** until approved.

## Provider change

Hosting, database, auth, payment, notification, observability provider change:

- Update external platform matrices (PGO-04/05/06/07 as applicable).
- Invalidate prior external assurance claims (already `NOT_VERIFIED` unless separately certified later).
- Notification Production Phase 2C stays deferred unless Owner reopens.

## Material runtime change

Application/runtime behavior affecting incident, observability, access, data, or release controls:

- Trigger domain review (PGO-02..08).
- May require reopening a readiness certification path.
- Does not by itself change structural foundation certification unless docs become false.

## Access-model change

RBAC, privileged roles, break-glass, service accounts:

- Update PGO-06; refresh access-review evidence requirements.
- Revocation and review cadences remain provisional until Owner approves.

## Data-model change

Schema, retention-relevant stores, processors, non-prod data handling:

- Update PGO-07 (+ PGO-02 backup implications).
- Legal/compliance remains **`NOT_CERTIFIED`** until formal path completes.

## Incident-triggered review

After Sev-impacting incidents:

1. Postmortem per PGO-02.
2. Update runbooks/matrices if control failure identified.
3. Feed findings into PGO-08 model.
4. Owner decides whether readiness vocabulary or risk acceptance must change.

## Periodic revalidation

Any proposed periodic revalidation cadence (quarterly, semi-annual, annual) that has **not** been Owner-approved is:

```text
PROVISIONAL_NOT_CERTIFIED
```

Do not publish a certified calendar from PGO-09 alone.

## Evidence refresh

Evidence packages expire when:

- Ownership changes
- System/provider changes
- Control design changes
- Sampling period elapses (once Owner approves a period)
- Incident indicates control failure

Stale evidence cannot support operating-effectiveness claims.

## Reopening PGO workstreams

| Action | Requirement |
|--------|-------------|
| Amend a closed PGO-0x doc set | Owner GO + path-scoped branch; prefer additive evidence docs |
| Elevate domain readiness vocabulary | Close gap register items + Owner GO |
| Reopen Notification Phase 2C | Explicit Owner GO only |
| Supersede structural certification | New consolidation package with fresh audit tip |

## Superseded certification

If a later Owner-approved package replaces PGO-09:

1. Mark this package **SUPERSEDED** with pointer to successor.
2. Record which verdict layers changed and why.
3. Retain historical evidence for audit trail.
4. Do not delete history solely to “clean” certification state.

## Honesty lock

Post-closure maintenance must preserve until evidence + Owner GO change them:

```text
OPERATIONAL EFFECTIVENESS = NOT_VERIFIED
PRODUCTION READINESS = NOT_READY
EXTERNAL ASSURANCE = NOT_VERIFIED
COMPLIANCE CERTIFICATION = NOT_CERTIFIED
UNAPPROVED TARGETS = PROVISIONAL_NOT_CERTIFIED
NOTIFICATION PHASE 2C = DEFERRED_BY_OWNER
```
