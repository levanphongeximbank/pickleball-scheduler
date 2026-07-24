# CM-08 Competition Archive — Architecture

## Purpose

Capability-local, dormant domain/application contracts for whole-competition
**archive** and explicit **unarchive** decisions.

## Ownership

| Owns | Does not own |
|------|----------------|
| Archive decision records + revision | CM-01 definition content / mutation |
| Effective states: `UNARCHIVED`, `ARCHIVED` | CM-06 publication record mutation |
| Archive / unarchive commands | CM-07 lifecycle mutation |
| Reason / actor / authority contracts | Delete / purge |
| Source provenance + manifest | Retention job execution |
| Effect plan (proposal-only intents) | Storage deletion |
| In-memory repository + port | CORE-20 audit persistence |
| Legacy observation projector | CORE-22 export / CORE-23 recovery |
| Typed errors | Notification sending |

## States

`UNARCHIVED` → `ARCHIVED` (archive)  
`ARCHIVED` → `UNARCHIVED` (unarchive, policy permitting)

Initial projection with no record: `UNARCHIVED` (revision `0`).

## Runtime status

`wiredToProductionRuntime: false` — no production wiring, no migration, no UI.
