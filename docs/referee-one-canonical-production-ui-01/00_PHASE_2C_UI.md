# Phase 2C — One Canonical Production Referee UI

Production routes:

- `/referee` — Referee Home / My Assignments (CORE-13)
- `/referee/match/:matchId` — One Referee Match Screen (all modes)

Path:

```
UI
  → Canonical Referee application client
  → Mode Adapter B
  → competition.referee.adapter.v1
  → E2E-04
  → CORE-13 / CORE-15 / CORE-16 / CORE-17
  → Durable Runtime
```

View-model / CanonicalCourtView are projection only.

Browser never contains service-role or privileged live RPC composition.

`/referee/:token` remains as a legacy compatibility route. Canonical routes do not fall back to it.
