# Phase 1F — Competition Court Availability Adapter

**Status:** Committed — `7ce80ff` (adapter only; Competition runtime **not** wired)
**Date:** 2026-07-18
**Branch:** `feature/venue-court-phase-1-foundation`
**Depends on:** Phase 1E `23363b19ff7a54fb29cddab5e939c543516590d5`

---

## 1. Existing Competition scheduling findings

| Finding | Detail |
| ------- | ------ |
| Primary consumers | `generateSchedule` / `assignCourts` (tournament-engine); Director `assignTournamentMatchToAvailableCourt` |
| Current input | In-memory `courts[]` on engine context (`id`, `name`, `locked`, `priority`) — **not** live availability |
| Current output | Match `courtId` + ISO `scheduledStart`/`scheduledEnd`; assignment `{ matchId, courtId, ... }` |
| Direct storage | Scheduling engines do **not** read Club V3 bookings; `tournamentBookingService` syncs tournament bookings separately |
| Court Engine | Tournament uses its own `src/tournament/engines/courtEngine.js` runtime helpers; does not import `features/court-engine` or `getCourtAvailability` |
| Existing helper | Canonical `getCourtAvailability` (Phase 1E) exists; Competition does not call it yet |
| Consumer need | Pre-filtered usable courts (available IDs); reasons useful for diagnostics |
| Time model | Schedule config / booking lock: `YYYY-MM-DD` + `HH:mm`; match fields: ISO timestamps derived later |
| Scope | Single court list / optional `clubId`; multi-venue typed but not implemented in active schedulers |
| Determinism | Assignment sorts by priority then name; first free court wins |
| Runtime wiring | Adapter can exist without changing Competition runtime |

---

## 2. Why the adapter is needed

Competition must ask Venue & Court “which courts are free in this window?” without:

- importing Club V3 blob shape
- reimplementing overlap / maintenance / hours rules
- owning inventory or bookings

---

## 3. Dependency direction

```text
Competition consumer (future)
    ↓
getCompetitionCourtAvailability  (this adapter)
    ↓
getCourtAvailability             (Phase 1E public facade)
    ↓
inventory + bookings + operating hours
```

**Forbidden reverse dependency:** Venue & Court must not import Competition / Tournament Engine / Court Engine / AI.

---

## 4. Final adapter input

```javascript
getCompetitionCourtAvailability({
  clubId,              // required — no first-club / first-venue guess
  venueId,             // optional; must match club when provided
  date,                // YYYY-MM-DD venue-local
  startTime,           // HH:mm
  endTime,             // HH:mm; must be after startTime same day
  courtIds,            // optional
  clusterId,           // optional
  context,             // optional; forwarded (e.g. excludeBookingId)
  includeUnavailable,  // default true
})
```

Phase 1A named the planned file `competitionCourtAdapter.js`. Phase 1F implements the availability-focused adapter as:

`src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js`

(status-mapping / inventory-slice extras from Phase 1A remain out of scope until a later Owner-approved expansion.)

---

## 5. Final adapter output

```javascript
{
  clubId,
  venueId,
  date,
  startTime,
  endTime,
  availableCourtIds,   // string[] — only available courts
  unavailableCourts,   // [{ courtId, available:false, reasons, conflicts }]
}
```

**Decision:** Prefer `availableCourtIds` for Competition consumers that currently take a pre-filtered court list. Keep `unavailableCourts` with reason codes for diagnostics. Omit a full `courts` mirror to keep the boundary minimal.

When `includeUnavailable: false`, `unavailableCourts` is `[]` (available IDs still computed from a full canonical evaluation).

---

## 6. Scope rules

* `clubId` required — no arbitrary club fallback.
* `venueId` optional; mismatch → canonical `VENUE_MISMATCH`.
* `courtIds` evaluated only inside the verified club/venue inventory.
* Unknown IDs → unavailable with `COURT_NOT_FOUND` (no cross-scope leak).
* No multi-club batch in Phase 1F.

---

## 7. Time model

* Venue-local `date` + `HH:mm` only — **no** ISO/`startAt`/`endAt` conversion.
* Overnight / `endTime <= startTime` rejected by canonical validation.
* Competition ISO match timestamps remain Competition-owned; callers must supply civil date/time windows when querying this adapter.

---

## 8. Deterministic ordering

* `availableCourtIds` and `unavailableCourts` preserve the order of rows from `getCourtAvailability`.
* That order is inventory order, or the caller’s `courtIds` order when provided.
* No shuffle, random selection, or Set-dependent reordering.

The adapter is **not** a court assignment optimizer and does not apply Competition priority ranking.

---

## 9. Error behavior

| Case | Behavior |
| ---- | -------- |
| Invalid request (time/scope) | Propagate canonical validation error |
| Valid request, no available courts | Success with `availableCourtIds: []` |
| Some unavailable | Success; IDs + optional `unavailableCourts` |
| Data load failure | Propagate `DATA_UNAVAILABLE` — never pretend empty inventory |
| Scope mismatch | Fail securely — no foreign court leak |

---

## 10. Read-only guarantee

Adapter does not call save / createBooking / updateBooking / deleteBooking / assignCourt / lockCourt / unlockCourt / setItem / removeItem.

Side effects: **none**.

---

## 11. No runtime wiring in Phase 1F

**Owner decision for this phase:** create and validate the adapter boundary only.

Phase 1A notes (`PHASE_1A_FACADE_DESIGN.md` Adapters / roadmap; `PHASE_1A_FILE_OWNERSHIP_MATRIX.md`) mention Competition calling the adapter in 1F, with competition-core call sites **Owner-gated**. This Phase 1F delivery follows the Owner authorization to **leave Competition runtime unchanged**.

No files under `competition-core`, `tournament-engine`, `tournament`, or Court Engine were modified.

---

## 12. Known limitations

* Does not assign `match.courtId`.
* Does not sync tournament bookings.
* Does not evaluate Court Engine runtime occupancy.
* Does not convert Competition ISO timestamps.
* Does not implement multi-venue batch queries.
* Does not apply Competition priority/`locked` ranking — callers map IDs into their own `courts[]`.

---

## 13. Phase 1G entry criteria

* Owner approves Phase 1F adapter contract.
* Phase 1E commit remains unchanged.
* Adapter tests green; no Competition runtime change unless separately authorized.

---

## 14. Future Competition runtime integration requirements

Before wiring:

1. Caller supplies explicit `clubId` (and `venueId` when multi-tenant).
2. Convert intended match window to venue-local `date` + `HH:mm` **without** inventing timezone rules.
3. Map `availableCourtIds` into existing `EngineCourt[]` / Director court lists.
4. Keep assignment algorithms (`generateSchedule` / `assignCourts` / Director) unchanged initially — availability is an input filter only.
5. Surface `DATA_UNAVAILABLE` to operators; do not fall back to empty free courts.
6. Optional: use `unavailableCourts` reasons in Director diagnostics UI.
7. Separate Owner review for any competition-core / tournament-engine call-site change.

---

## Files

* `src/features/venue-court/adapters/competitionCourtAvailabilityAdapter.js`
* `src/features/venue-court/index.js`
* `src/features/venue-court/README.md`
* `tests/venue-court/competition-court-availability-adapter.test.js`
* `docs/venue-court/PHASE_1F_COMPETITION_ADAPTER.md`
