# E2E-03 → E2E-04 / E2E-05 Readiness

## After E2E-03 merge (contract freeze)

E2E-04 (Player / Referee) and E2E-05 (Public Experience) may proceed **in parallel** against frozen Organizer contracts:

- Organizer operational projection fields
- Check-in window states (`NOT_OPENED` / `OPEN` / `CLOSED`)
- Match ops control states (open / suspend / resume) without score entry
- Knockout activation readiness gates
- Publication kinds (`operational-plan`, `final-result`)
- Archive readiness handoff (`directArchiveMutation: false`)

## E2E-04 should consume

- Organizer check-in window as gate (player check-in marks)
- Match ops open state before referee/player score entry
- No Organizer winner inference — Result Validation remains Core

## E2E-05 should consume

- Operational plan / final result publication projections
- Public surfaces must not call Organizer mutation commands

## Still out of E2E-03

- Player Portal UX
- Referee scoreboard
- Public live score / standings / bracket / Match Center
- Notification delivery
- Staging / Production rollout
