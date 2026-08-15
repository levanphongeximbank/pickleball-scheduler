# Canonical authority map

```
Competition Core
  CORE-13 assignment domain
  CORE-15 match lifecycle
  CORE-16 scoring calculation
  CORE-17 result validation / acceptance / correction
        ↓
Competition Engine E2E-04
  Referee Operations facade (orchestration only)
        ↓
END A — CompetitionRefereeAdapterContract v1
  translator + policy provider for tournament modes
        ↓
Canonical persistence (V5 tables, CORE payloads)
```

| Concern | Canonical authority | Must not own |
|---|---|---|
| Referee identity | `auth.uid` / `actor.actorId` | Fuzzy name/email/phone; client grants |
| Assignment | CORE-13 | Mode adapters; V5 UI |
| Lifecycle transitions | CORE-15 | Adapters; V5 matchStateEngine (new CE path) |
| Scoring calculation | CORE-16 | Adapters; V5 rally/side-out engines (new CE path) |
| Match events | append-only `match_events` + CORE-16 commands | Adapters writing scores as results |
| Official result | CORE-17 accepted + ACTIVE lineage | Raw UI score; CORE-15 COMPLETED; CORE-16 projection |
| Standings/bracket/qualification/aggregate | CORE-17 accepted active result only | Adapter direct score→result |

Locked inequality:

`CORE-16 calculated score` ≠ `CORE-15 lifecycle completion` ≠ `CORE-17 accepted official result`

Adapters may describe propagation instructions. They must never accept results.
