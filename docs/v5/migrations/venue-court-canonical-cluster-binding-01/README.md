# Venue/Court canonical cluster membership binding

**DO NOT APPLY WITHOUT OWNER GO STAGING.**

This additive package adds one shared canonical writer:

`public.bind_club_courts_to_cluster`

It binds:

1. `public.clubs.registered_cluster_id`
2. selected physical court `clusterId` values inside `public.club_data_v3.data`

in one authenticated PostgreSQL transaction.

The implementation run that produced it used `STAGING_MUTATIONS=0` and
`PRODUCTION_MUTATIONS=0`. Nothing here was applied to Staging or Production.

## Why this exists

Court Cluster is scope/membership. Physical court identity is `courtId`.
`venueId` must never be substituted for `clusterId`. A missing physical court
`clusterId` must remain missing until an explicit canonical assignment occurs.

Club owns `registeredClusterId`. Shared Venue/Court owns physical court
cluster membership. Team Tournament must not own or duplicate this writer.

## Contract after APPLY

`bind_club_courts_to_cluster(p_request_id, p_club_id, p_venue_id, p_cluster_id, p_court_ids, p_expected_club_version, p_expected_blob_version)`:

- authenticated only; anon denied
- authorized via `phase42_can_update_club`
- tenant scoped (`clubs.tenant_id` = `p_venue_id`)
- cluster must exist, be `active`, and belong to the same venue
- requested court IDs must exist in that club's `club_data_v3` inventory
- only requested court IDs change
- unrelated courts and unrelated JSON fields are preserved
- courts are not created or deleted
- bookings/reservations are not mutated
- already-correct membership is idempotent
- a different existing non-null cluster fails closed (`FOREIGN_CLUSTER`)
- no silent move; a future move operation must be explicit
- CAS on `clubs.version` and `club_data_v3.version`

## Unbind / move semantics

| State | Default bind |
| --- | --- |
| A. club `registered_cluster_id` NULL | bind to target |
| B. court `clusterId` NULL | bind selected courts to target |
| C. already in target | success, no rewrite needed |
| D. other non-null cluster | fail closed |

Clearing club registration remains the existing Club governance path and does
not unbind physical courts.

## Run order after Owner GO

1. `01_PRECHECK.sql` — prove current clubs / club_data_v3 / court_clusters / club_update contracts.
2. `02_APPLY.sql` — create the shared binder RPC.
3. `03_VERIFY.sql` — auth, grants, fail-closed codes, no tournament leakage.
4. `04_ROLLBACK.sql` only if rollback is approved. It drops the function. It does not delete business data.

## Security

`SECURITY DEFINER` + `search_path = public`. `EXECUTE` granted to `authenticated`
only. `anon` and `PUBLIC` revoked.
