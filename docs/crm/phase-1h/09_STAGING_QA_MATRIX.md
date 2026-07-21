# 09 — Staging QA Matrix (Post-Apply Design / Phase 1H-A static)

Phase 1H-A implements **static/fake** coverage only. Live Staging probes are deferred to Phase 1H-B after Owner-approved apply.

## Future Staging verification procedures

| Area | Procedure |
|------|-----------|
| Tables/constraints | Catalog probe for four tables + CHECKs/uniques |
| Indexes | Confirm claim/list indexes |
| RLS enabled | `relrowsecurity` + FORCE |
| Permission seeds | All `CRM_PERMISSION_VALUES` present once |
| Role-permission assignments | Match approved matrix; PLAYER/CUSTOMER empty |
| Anonymous denial | anon SELECT/INSERT denied |
| Cross-tenant denial | JWT venue A cannot read tenant B rows |
| Cross-venue denial | Same |
| Same-scope allowed | Matching venue + permission succeeds |
| Consent immutability | UPDATE/DELETE fail |
| Tag assignment delete boundary | DELETE assignments allowed; tags not |
| Claim ordering | Deterministic order under load |
| Concurrent SKIP LOCKED | Two workers disjoint claims |
| Ack/fail guarded transitions | Require CLAIMED |
| Release expired claims | Restores PENDING; preserves attempt_count |
| Duplicate event id | Unique conflict → CRM conflict code |
| Batch enqueue atomicity | Partial insert impossible |
| Memory runtime default | Durable switch still off until explicit |

## Phase 1H-A test file

`tests/crm-phase-1h-staging-readiness.test.js` — offline/static/fake only.
