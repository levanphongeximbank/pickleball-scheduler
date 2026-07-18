# 05 — Snapshot and Seed Lock Evidence

| Check | Result |
|-------|--------|
| Snapshot JSON-safe | `validateParticipantSnapshot` |
| Snapshot does not mutate source | Nested affiliation mutation isolated |
| Display / rating / eligibility / affiliation | Captured on snapshot |
| snapshotAt present | Required in fixture |
| SEED_LOCKED marker | `createSeedLockedRatingSnapshot` + Official/Individual mapping |
| Live rating change ≠ seed snapshot | Live 4.9 vs locked 4.5 |
| Incomplete snapshot diagnostics | Code `SNAPSHOT_INCOMPLETE` stable |
| Format extension safe with DTO | Entry DTO + extensions coexist |
