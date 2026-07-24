# CM-07 Competition Suspension / Cancellation — Architecture

## Purpose

Capability-local, dormant domain/application contracts for whole-competition
lifecycle interruption: **suspend**, **resume**, and irreversible **cancel**.

## Ownership

| Owns | Does not own |
|------|----------------|
| Lifecycle decision records + revision | CM-01 definition content / mutation |
| Suspension / resume / cancellation | CM-06 publication record mutation |
| Reason / actor / authority contracts | Match cancel (CORE-15) |
| Effect plan (proposal-only intents) | CORE-19 workflow execution |
| In-memory repository + port | CORE-23 recovery/resume |
| Legacy observation projector | CM-08 archive |
| Typed errors | Notification / audit persistence |

## States

`ACTIVE` → `SUSPENDED` → `ACTIVE` (resume)  
`ACTIVE|SUSPENDED` → `CANCELLED` (terminal)

No `uncancel`. No archive. No delete.

## Runtime status

`wiredToProductionRuntime: false` — no production wiring, no migration, no UI.
