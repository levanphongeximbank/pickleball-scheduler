# E2E-06 — Recovery & Resume (GOV-06)

## Canonical reuse

- CORE-23: checkpoint / eligibility / recovery plan evaluation (handoff)
- CORE-19: workflow resume is **not** called directly; readiness only

## Readiness checks

- checkpoint availability
- workflow + lifecycle state
- recovery reason
- elevated actor authority (permission map)
- replay seed presence (companion evidence)
- audit evidence presence
- idempotency key projection
- conflict detection
- resume target validation
- recovery completion flag

## Explicit non-goals

- no direct match resume outside CORE-23/CORE-19 handoff
- no state mutation to “fix” recovery (`mutatesState: false`)
- no DB backup / Supabase recovery product
