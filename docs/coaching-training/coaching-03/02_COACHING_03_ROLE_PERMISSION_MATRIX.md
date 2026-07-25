# COACHING-03 — Role / Permission Matrix (Proposal)

**Status:** PROPOSED — not applied  
**Owner matrix approval:** required at Gate C  
**SQL proposal:** `sql/70_COACHING_03_ROLE_PERMISSION_ASSIGNMENT.proposal.sql`  
**Rollback:** `sql/91_COACHING_03_ROLE_PERMISSION_ROLLBACK.proposal.sql`

## Role catalog mapping

| Owner label | Identity / DB role ids granted (if present) |
|-------------|-----------------------------------------------|
| SUPER_ADMIN | `SUPER_ADMIN` |
| VENUE_OWNER | `TENANT_OWNER`, `VENUE_OWNER`, `COURT_OWNER` |
| VENUE_MANAGER | `VENUE_MANAGER`, `COURT_MANAGER` |
| CLUB_OWNER | `CLUB_MANAGER`, `CLUB_OWNER` |
| CLUB_MANAGER | `CLUB_MANAGER`, `CLUB_OWNER` |
| COACH | `COACH` (operational subset) |
| PLAYER | **none** |

Explicit default deny: `STAFF`, `REFEREE`, `CASHIER`, `CUSTOMER`, `SUPPORT`, `ACCOUNTANT`, `SYSTEM_TECHNICIAN`, `TOURNAMENT_MANAGER`, `TEAM_CAPTAIN`.

## Action matrix

| Action | SUPER_ADMIN | VENUE_OWNER* | VENUE_MANAGER | CLUB_MANAGER* | COACH | PLAYER |
|--------|:-----------:|:------------:|:-------------:|:-------------:|:-----:|:------:|
| coaching.program.create | Y | Y | Y | Y | N | N |
| coaching.program.update | Y | Y | Y | Y | N | N |
| coaching.coach.assign | Y | Y | Y | Y | N | N |
| coaching.player.enroll | Y | Y | Y | Y | Y | N |
| coaching.curriculum.create | Y | Y | Y | Y | N | N |
| coaching.lesson.create | Y | Y | Y | Y | Y | N |
| coaching.session.schedule | Y | Y | Y | Y | Y | N |
| coaching.attendance.record | Y | Y | Y | Y | Y | N |
| coaching.attendance.correct | Y | Y | Y | Y | N | N |
| coaching.package.create | Y | Y | Y | Y | N | N |
| coaching.entitlement.grant | Y | Y | Y | Y | N | N |
| coaching.entitlement.consume | Y | Y | Y | Y | Y | N |
| coaching.evaluation.submit | Y | Y | Y | Y | Y | N |
| coaching.records.read | Y | Y | Y | Y | Y | **N** |

\*Includes legacy aliases listed above.

## Scope semantics (all grants)

| Dimension | Rule |
|-----------|------|
| Tenant scope | `tenant_id = user_venue_id()` (venue-bound JWT) |
| Club scope | `club_id = user_club_id()` |
| Actor scope | Administrative vs coach ops per action (see `roleMatrix.js`) |
| Deny default | No permission → denied; anon denied; wrong tenant/club denied |
| QA role | Certification uses existing sanitized Staging QA principals when available — no password commit |

## PLAYER `records.read` deferral

Current RLS checks **permission + tenant/club** only — **no proven self-only row scope**.

Therefore:

- Do **not** grant `coaching.records.read` to PLAYER in canonical role grant.
- Self-service player read deferred to **COACHING-04** (or dedicated workstream).
- Do **not** widen RLS only to enable a positive player test flow.

## Machine-readable source

`src/features/coaching/staging/roleMatrix.js`
