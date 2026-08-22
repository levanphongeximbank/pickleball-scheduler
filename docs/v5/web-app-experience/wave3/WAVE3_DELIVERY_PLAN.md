# Wave 3 Delivery Plan

`PROPOSED_WAVE3_BATCH_COUNT=6`
`PROPOSED_WAVE3_SCREEN_COUNT=22`

## 3A — Master adoption audit

Docs only. Owner review and scope lock. No implementation.

## 3B — Court / Daily Operations

Routes: `/court-management/calendar`, `/court-management/bookings`, `/mobile/check-in`, `/court-management`.

Adopt page framing, filters, generic states, responsive data, feedback, and visual status. Keep the calendar matrix, QR runtime, offline queue, booking forms, assignment rules, and writers domain-owned.

## 3C — Customer / Player

Routes: `/court-management/customers`, `/court-management/members`, `/players/skill`, `/admin/skill-level-requests`, `/players/profile/:playerId`; minor pilot normalization in `/players` does not increase the proposed screen count.

Preserve CRUD, rating, membership, privacy, and permission behavior.

## 3D — Club / Coaching

Routes: `/manage/clubs`, `/platform/clubs`, `/manage/clubs/:clubId`, `/my-club`, `/my-club/requests`, plus seven route wrappers served by `CoachingEntityPage`: coaches, students, classes, schedule, packages, attendance, evaluations.

Retain club governance, membership, coaching ACL/concurrency, and all writers.

## 3E — Tournament Outer Hubs

Route: `/tournament/list`.

Adopt authenticated generic framing/states only. Experience 23, tournament pickers, route destinations, status enums, and internal workflows remain frozen/domain-owned. Roster/organize/operations/results defer until legacy destination convergence.

## 3F — Regression / Certification

Required evidence:

- targeted component tests for shared-pattern composition and keyboard behavior;
- route smoke for all 22 routes and four pilots;
- functional parity of create/edit/delete/filter/navigation;
- authorization regression by representative role;
- responsive screenshots at 1440, 1024, 430 and 390 spot-checks;
- visual before/after evidence for each implementation family;
- Wave 1 shell/breakpoint lock;
- Wave 2 token/component lock;
- Tournament Experience and Public boundary checks;
- full unit suite, `npm run ci:foundation-lock`, `npm run lint:no-new`, and `npm run build`.

Do not add Storybook.

## Per-PR safety checklist

For every route:

`ROUTE_UNCHANGED=YES`
`AUTHORIZATION_UNCHANGED=YES`
`DATA_SOURCE_UNCHANGED=YES`
`MUTATION_SEMANTICS_UNCHANGED=YES`
`DOMAIN_AUTHORITY_UNCHANGED=YES`

Stop and split a batch if visual adoption requires writer, RLS, route, permission, or domain-model changes.

`NEXT_BATCH=OWNER_REVIEW_THEN_WAVE3_IMPLEMENTATION`
