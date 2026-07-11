# CC-04B — Seed Audit Object

`createSeedAudit()` — in-memory only, no persistence.

| Field | Purpose |
|-------|---------|
| sourceValues | Input metric snapshot summary |
| weights | Score weight contract used |
| adjustments | Resolved adjustments |
| finalScore | Top seed score |
| tieBreaks | Tie-break decisions |
| engineVersion | `cc04b-v1` |
| recordedAt | Optional timestamp |

Attached to `SeedResult.audit` from pipeline output.
