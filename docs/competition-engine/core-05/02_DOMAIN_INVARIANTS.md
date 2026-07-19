# Core-05 — Domain Invariants

Phase 1 management service enforces the following. Failures are structured (`ok: false` + ordered `issues`), never silent pass.

---

## Isolation

1. **Tenant isolation** — when `tenantId` is required (classification adapter) or present on entities, mismatched tenant fails.
2. **Competition isolation** — team/roster/member operations must share `competitionId`.
3. **Division isolation** — when division refs are present/required, mismatched `divisionId` / `divisionCategoryId` fails. Classification adapter selects which refs are required.

## Identity & membership

4. **Stable team identity** — `id` + `competitionId::TEAM::id` identity key; no timestamp/random identity.
5. **Unique active participant within a team** — one active membership per person token per roster.
6. **Cross-team membership** — active person may not join another team in the same competition + division by default.
7. **Rule Adapter exception** — `allowCrossTeamMembership` may explicitly permit.

## Roster constraints

8. **minSize / maxSize** — active members must satisfy bounds when set.
9. **Captain membership** — captain must be an active roster member when assigned / on activate validation.
10. **Removed member cannot remain captain** — removing/replacing captain clears or reassigns captain.
11. **Replacement traceability** — replaced member gets `removedAt`, `replacedMemberId` / amendment trail, status `REPLACED`.

## Lock & activation

12. **Locked roster** — membership mutations blocked when status is `ROSTER_LOCKED`.
13. **unlockRoster** — requires authorization adapter allowing `TEAM_ROSTER_UNLOCK`.
14. **activateTeam** — requires non-empty `entryId`.
15. **Eligibility / registration** — when eligibility is required, missing or negative decision fails closed.

## Versioning & determinism

16. **rosterVersion** — increments monotonically on membership or lock-state mutations.
17. **Snapshots** — member ids sorted deterministically; `contentHash` deterministic when produced.
18. **Validation issue ordering** — sorted by `code`, then `path`, then `message`.

## Dependencies

19. Missing required ports/context (tenant, competition, division, entry, eligibility) → structured failure, not throw-to-silence.
