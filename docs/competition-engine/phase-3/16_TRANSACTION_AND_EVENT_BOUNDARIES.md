# 16 — Transaction and Event Boundaries

**Status:** Design only — no transaction/event bus implementation in Phase 3.0

---

## Transaction boundaries (mutating capabilities)

| Command | Atomic unit | Idempotency key | Revision | Retry | Outbox | Partial failure |
|---------|-------------|-----------------|----------|-------|--------|-----------------|
| Registration submit | Registration + Entry create/waitlist | `idempotencyKey` from client | Entry revision | Safe retry same key | Optional notify | No half-entry |
| Entry activate (waitlist) | Status transition | `activationId` | Yes | Conditional | Yes | Rollback status |
| Roster lock | Roster snapshot + lock flag | `rosterId+revision` | Yes | Reject stale | Audit | Keep prior revision |
| Lineup submit | Lineup draft revision | `lineupId+revision` | Yes | Reject stale | Audit | Prior draft remains |
| Lineup lock/publish | Lock + visibility rules | `matchupId+revision` | Yes | No double publish | Yes | Sticky lock audit |
| Match result confirm | Score + lifecycle state | `matchId+resultToken` | Match version | Referee RPC semantics | Elo outbox | No partial Elo without score |
| Standings projection | Rebuild from results | `competitionId+resultsHash` | Projection version | Rebuild | Optional | Stale projection OK if marked |
| Dual-write pair | Logical command across stores | Same command key | Per store | Outbox retry | **Required** | `reconciliation_pending` |

---

## Event model evaluation

### Candidate domain events

```text
ParticipantResolved
RegistrationSubmitted
RegistrationApproved
EntryActivated
RosterLocked
SubstitutionApproved
LineupSubmitted
LineupLocked
DrawGenerated
SchedulePublished
MatchCompleted
ResultValidated
StandingsUpdated
```

### Event kinds (do not conflate)

| Kind | Purpose | Consumer |
|------|---------|----------|
| Domain event | Business fact inside bounded context | Core/projections |
| Audit event | Who did what | Compliance / `/audit` |
| Integration event | Cross-module (Elo, season, notify) | Outbox → workers |
| UI notification | Push/toast | Mobile/push — not domain bus |

**Phase 3.0 decision:** Design allows an **outbox later**; **do not** build an event bus now. Prefer explicit application-service calls + future outbox for Elo/season during 3J.

---

## Elo / season side effects

Today `processCompletedMatch` couples score persistence with Elo and season points. Migration must split:

```text
MatchCompleted (domain)
  → outbox: ApplyRating
  → outbox: ApplySeasonPoints
```

with idempotent handlers — otherwise dual-write and kill switch cannot reason about partial side effects.
