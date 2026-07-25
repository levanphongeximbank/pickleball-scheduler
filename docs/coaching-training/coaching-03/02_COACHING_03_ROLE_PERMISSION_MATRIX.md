# COACHING-03 — Role / Permission Matrix (Proposal)

**Status:** PROPOSED — not applied  
**Owner matrix approval:** required at Gate C  
**SQL proposal:** `sql/70_COACHING_03_ROLE_PERMISSION_ASSIGNMENT.proposal.sql`  
**Rollback:** `sql/91_COACHING_03_ROLE_PERMISSION_ROLLBACK.proposal.sql`

## Root cause (why COACH is zero)

COACHING-02 RLS currently enforces only:

- authenticated actor
- `tenant_id = user_venue_id()`
- `club_id = user_club_id()`
- canonical action permission

It does **not** enforce coach assignment, coach-player relationship, coach-owned session, assigned-player attendance/evaluation, or assigned entitlement consumption.

Therefore granting any Coaching permission to **COACH** would enable **club-wide** access under current RLS. Metadata `actorScope` in JS/docs is **not** database enforcement.

**Remediation:** COACH receives **zero** Coaching grants in COACHING-03. Coach authorization is **not** complete here.

## Role catalog mapping

| Owner label | Identity / DB role ids granted (if present) |
|-------------|-----------------------------------------------|
| SUPER_ADMIN | `SUPER_ADMIN` |
| VENUE_OWNER | `TENANT_OWNER`, `VENUE_OWNER`, `COURT_OWNER` |
| VENUE_MANAGER | `VENUE_MANAGER`, `COURT_MANAGER` |
| CLUB_OWNER | `CLUB_MANAGER`, `CLUB_OWNER` |
| CLUB_MANAGER | `CLUB_MANAGER`, `CLUB_OWNER` |
| COACH | **none** (deferred COACHING-04) |
| PLAYER | **none** |

Explicit default deny: `COACH`, `PLAYER`, `STAFF`, `REFEREE`, `CASHIER`, `CUSTOMER`, `SUPPORT`, `ACCOUNTANT`, `SYSTEM_TECHNICIAN`, `TOURNAMENT_MANAGER`, `TEAM_CAPTAIN`.

## Action matrix

| Action | SUPER_ADMIN | VENUE_OWNER* | VENUE_MANAGER | CLUB_MANAGER* | COACH | PLAYER |
|--------|:-----------:|:------------:|:-------------:|:-------------:|:-----:|:------:|
| coaching.program.create | Y | Y | Y | Y | **N** | N |
| coaching.program.update | Y | Y | Y | Y | **N** | N |
| coaching.coach.assign | Y | Y | Y | Y | **N** | N |
| coaching.player.enroll | Y | Y | Y | Y | **N** | N |
| coaching.curriculum.create | Y | Y | Y | Y | **N** | N |
| coaching.lesson.create | Y | Y | Y | Y | **N** | N |
| coaching.session.schedule | Y | Y | Y | Y | **N** | N |
| coaching.attendance.record | Y | Y | Y | Y | **N** | N |
| coaching.attendance.correct | Y | Y | Y | Y | **N** | N |
| coaching.package.create | Y | Y | Y | Y | **N** | N |
| coaching.entitlement.grant | Y | Y | Y | Y | **N** | N |
| coaching.entitlement.consume | Y | Y | Y | Y | **N** | N |
| coaching.evaluation.submit | Y | Y | Y | Y | **N** | N |
| coaching.records.read | Y | Y | Y | Y | **N** | **N** |

\*Includes legacy aliases listed above.

## Scope semantics (all grants)

| Dimension | Rule |
|-----------|------|
| Tenant scope | `tenant_id = user_venue_id()` (venue-bound JWT) |
| Club scope | `club_id = user_club_id()` |
| Actor scope | Administrative only in COACHING-03 |
| Deny default | No permission → denied; anon denied; wrong tenant/club denied; COACH/PLAYER denied |
| QA role | Certification uses admin principals only — no password commit |

## PLAYER / COACH deferral

- Do **not** grant any Coaching permission to PLAYER or COACH in this proposal.
- Do **not** widen RLS only to enable positive coach/player test flows.
- Self-service player read and assignment-aware coach ops → **COACHING-04**.

## COACHING-04 handoff — prerequisites before any COACH grants

Before proposing COACH Coaching permissions, COACHING-04 must deliver:

1. Assignment-aware RLS and/or scoped RPCs
2. Verified `coach_principal_id` / coach-player relationship
3. SELECT limited to assigned records only
4. Enrollment only within allowed program/assignment
5. Session scheduling only for valid coach scope
6. Attendance/evaluation only for assigned player/session
7. Entitlement consume only under explicit authorized relationship
8. Negative cross-coach tests
9. Removed assignment immediately denies access

Until then: **COACH authorization is incomplete; do not claim otherwise.**

## Machine-readable source

`src/features/coaching/staging/roleMatrix.js`
