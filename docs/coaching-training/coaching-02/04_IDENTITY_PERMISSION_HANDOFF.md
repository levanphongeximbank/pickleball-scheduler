# COACHING-02 — Identity Permission Handoff

## Mapping (14 COACHING-01 actions → Identity permission ids)

| Coaching action | Identity `permissions.id` | Seed module/action |
|-----------------|---------------------------|--------------------|
| `coaching.program.create` | `coaching.program.create` | coaching / program.create |
| `coaching.program.update` | `coaching.program.update` | coaching / program.update |
| `coaching.coach.assign` | `coaching.coach.assign` | coaching / coach.assign |
| `coaching.player.enroll` | `coaching.player.enroll` | coaching / player.enroll |
| `coaching.curriculum.create` | `coaching.curriculum.create` | coaching / curriculum.create |
| `coaching.lesson.create` | `coaching.lesson.create` | coaching / lesson.create |
| `coaching.session.schedule` | `coaching.session.schedule` | coaching / session.schedule |
| `coaching.attendance.record` | `coaching.attendance.record` | coaching / attendance.record |
| `coaching.attendance.correct` | `coaching.attendance.correct` | coaching / attendance.correct |
| `coaching.package.create` | `coaching.package.create` | coaching / package.create |
| `coaching.entitlement.grant` | `coaching.entitlement.grant` | coaching / entitlement.grant |
| `coaching.entitlement.consume` | `coaching.entitlement.consume` | coaching / entitlement.consume |
| `coaching.evaluation.submit` | `coaching.evaluation.submit` | coaching / evaluation.submit |
| `coaching.records.read` | `coaching.records.read` | coaching / records.read |

**JS source of truth:** `src/features/coaching/constants/permissions.js`  
**SQL seed (authored only):** `15_COACHING_02_PERMISSION_SEED.sql`

## What COACHING-02 does NOT do

- Does **not** modify `src/features/identity/**`
- Does **not** assign roles / `role_permissions`
- Does **not** decide which roles get which Coaching actions by default
- Does **not** apply the seed to any database

## COACHING-03 prerequisite

Owner-approved role → permission assignment policy + Staging apply of catalog seed + RLS pack. Until then, JWT users will fail closed even after schema apply (except `is_super_admin`).

## Phase 28 coarse keys (not canonical)

`coaching.view`, `coaching.manage`, `coaching.attendance`, `coaching.evaluate` — **do not** use as COACHING-02 canonical identifiers.
