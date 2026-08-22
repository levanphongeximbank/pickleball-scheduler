# Official / Open — canonical court assignment (temporary)

Temporary Official/Open court handling after Owner stop-condition on real
Venue reservation. This is **not** a booking/reservation capability.

## Status

```
OFFICIAL_COURT_ASSIGNMENT=CANONICAL_RECORD_ONLY
OFFICIAL_REAL_COURT_RESERVATION=DEFERRED
OFFICIAL_CROSS_MODE_OCCUPANCY=DEFERRED
CROSS_MODE_COURT_OCCUPANCY=DEFERRED
VENUE_OPERATIONS_INTEGRATION=OPEN
TEAM_CROSS_MODE_OCCUPANCY_BLOCKER=OPEN
DEFERRED_TO=VENUE_COURT_OPERATIONS_END_TO_END_CANONICAL_CLOSURE
```

Do **not** mark real court reservation PASS.

## Failed browser evidence (stop condition)

Exact-head Preview:

`a9a5426ace7d9cce9efe4679f5db8eddd09ed2fe`

Fresh fixture:

`a5d7661a-6967-4f12-86f6-fd92a2d30de9`

Visible error:

`Không tìm thấy club để resolve venue.timezone.`

Owner decision: do not patch Venue timezone; do not add another Court Lock
remediation layer; Official/Open uses Internal-style canonical court assignment.

## Active Official contract

- Persist Tournament-owned `canonical_tournaments.payload.courtSchedule`
  (date, startTime, endTime, selected court IDs).
- One canonical Tournament CAS write (`canonical_tournament_update` +
  `expected_version`).
- Survive F5 / new session from canonical readback.
- Use persisted `courtSchedule` to place time/court onto **existing**
  group matches (`event.matches` IDs only).
- Do **not** claim Venue booking/reservation.
- Do **not** write `club_data_v3.data.bookings`.
- Do **not** write `public.court_reservations`.
- Do **not** require `venue.timezone` for the assignment save.
- Do **not** invoke `official_tournament_reserve_courts` or
  `official_tournament_commit_group_schedule` from the Owner Official
  browser lifecycle.

Inventory remains Phase 2N: `club_data_v3.data.courts` (config only).

## Deferred Staging objects

Leave dormant (no rollback, no drop, no mutate, no backfill):

- `btree_gist`
- `public.court_reservations`
- shared availability helper
- Official reservation/schedule RPCs
- Daily assign/change shared occupancy integration

Future project: **VENUE / COURT OPERATIONS — END-TO-END CANONICAL CLOSURE**.
