# CM-07 Competition Suspension / Cancellation

## Purpose

Canonical Competition Management capability for **whole-competition** lifecycle
interruption: temporary suspension, explicit resume, and irreversible
cancellation. Capability-local / dormant — does not replace transitional
`tournamentService` production runtime.

## Canonical ownership

CM-07 owns:

- `CompetitionLifecycleRecord` and linear history
- lifecycle revision (monotonic per tenant + competition)
- effective states: `ACTIVE`, `SUSPENDED`, `CANCELLED`
- suspend / resume / cancel commands
- reason codes, actor, authority decision
- source provenance
- optimistic concurrency (`expectedLifecycleRevision`)
- idempotency
- deterministic operational effect plans (proposal-only)
- integration intents
- typed errors
- repository port + capability-local in-memory repository
- read-only legacy lifecycle observation projector

## Lifecycle states

| State | Meaning |
|-------|---------|
| `ACTIVE` | No interruption record, or resumed |
| `SUSPENDED` | Temporarily interrupted |
| `CANCELLED` | Terminal within CM-07 |

Initial projection with no record: `ACTIVE` (revision `0`). First successful
decision creates revision `1`.

### Transitions

- `ACTIVE` → `SUSPENDED` (suspend)
- `SUSPENDED` → `ACTIVE` (resume)
- `ACTIVE` → `CANCELLED` (cancel)
- `SUSPENDED` → `CANCELLED` (cancel)
- `CANCELLED` is terminal — no resume, no re-suspend, no uncancel

## Suspend

Requires: tenantId, competitionId, definition + expectedDefinitionRevision,
expectedLifecycleRevision, actor, authority ALLOWED, suspension reason,
effectiveAt/clock, idempotencyKey, explicit publicationPolicy, explicit
publicationContext (PRESENT or ABSENT).

Optional: `intendedResumeAt` (metadata only — never auto-resumes).

## Resume

Only from `SUSPENDED`. Requires explicit command even if `intendedResumeAt`
has passed. Does **not** invoke CORE-23 recovery, reopen registration, or
republish.

## Cancellation

Irreversible within CM-07. Requires `dataRetentionAcknowledged: true`.
Does not delete, archive, purge, cancel matches, void results, or mutate
publication history.

## Reason model

Stable codes for suspension / resume / cancellation. `OTHER` requires detail
≥ 8 chars. Control characters and HTML/script rejected. Unknown codes rejected
(no silent normalize).

## Actor / authority

Explicit actor (`actorId`, `actorType`, `tenantId`) and authority decision
(`ALLOWED`/`DENIED`, policy id/version, decisionReference). Denied or missing
authority → fail closed. No RBAC lookup inside CM-07. No tokens/secrets stored.

## Source provenance

Captures definition revision, optional version identity, publication presence
or absence, prior lifecycle revision, policy refs, idempotency fingerprint,
effectiveAt. Never infers “latest” publication or version.

## Lifecycle revision / concurrency

Monotonic per tenant+competition. `expectedLifecycleRevision` required
(`0` or `null` before first record). Stale → typed conflict. Failed commands
do not increment revision.

## Idempotency

Same key + same semantic fingerprint → replay. Same key + different semantics
→ `CM07_IDEMPOTENCY_CONFLICT`. No duplicate records/intents on retry.

## Effect plan

Proposal-only intents (`executionStatus=PROPOSED`, `executed=false`):

**Suspend:** pause registration, freeze draw/schedule/match-generation,
publication notice or temporary withdrawal, notification, audit, CM-01 status
patch proposal.

**Resume:** review intents for registration/draw/schedule/match-execution/
publication restore; notification; audit; CM-01 status patch proposal.

**Cancel:** close registration, permanent freezes, permanent publication
withdrawal intent, archive eligibility **review** intent, notification, audit,
CM-01 cancelled status patch proposal.

CM-07 never executes these effects.

## CM-01 boundary

Receives explicit definition context. Verifies tenant/competition/revision.
Does **not** mutate definition or bump definition revision. Returns
`CM01_DEFINITION_STATUS_PATCH_PROPOSAL` only.

## CM-06 boundary

Does not mutate publication records, create revisions, or activate routes.
Creates withdrawal/notice/restore-review intents only. Requires explicit
publication context — no latest lookup. Publication policy is mandatory
(no hidden default) for suspend/cancel.

## CORE-15 / CORE-19 / CORE-23 boundary

Does not cancel/void/abandon matches. Does not run CORE-19 transitions.
Does not restore CORE-23 checkpoints. Resume means management-lifecycle
resume only.

## CM-08 boundary

Cancellation ≠ archive. May emit `ARCHIVE_ELIGIBILITY_REVIEW_INTENT` only.

## Tenant isolation

All commands/queries are tenant+competition scoped. Cross-tenant access
fail-closed. Record id alone is insufficient without tenant match.

## Deterministic guarantees

Stable fingerprints, sorted field errors, sorted intents, frozen/cloned
records, linear history ordering.

## Legacy compatibility

`projectLegacyTournamentLifecycleObservation` is read-only,
`LEGACY_UNVERIFIED`. Safe observation of cancelled/paused flags with issues.
Does **not** treat deletion, archive, or match cancellation as canonical
competition cancellation. Does not create canonical records.

## Persistence / runtime status

- Capability-local in-memory repository only
- No migration authored or applied
- `wiredToProductionRuntime: false`
- No UI / routes / production tournamentService changes

## Activation conditions

Integrator must wire: persistence port, how CM-01 status proposals are applied,
how CM-06 honors withdrawal/notice intents, registration/schedule freezes,
notification/audit consumers — without granting CM-07 execution ownership.
