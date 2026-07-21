# 06 — Phase 1E Acceptance Criteria

**Status:** Checklist

---

## Must pass

- [x] Phase 1B–1D contracts reused (no parallel contract families)
- [x] Interaction record / get / list with deterministic timeline order + filters
- [x] Append-only Interaction (no edit/delete command)
- [x] Task create / follow-up schedule / get / list
- [x] Follow-up requires future `dueAt`; creates Task only
- [x] Assignment via IdentityActorPort (fail closed)
- [x] Reschedule / start / complete / cancel with lifecycle rules
- [x] Cancellation reason required; no terminal reopen
- [x] Same-scope relationship validation for ContactReference / Lead / Opportunity / Interaction
- [x] MODEL 1 pending validated events; no best-effort rollback
- [x] Memory Interaction + Task repos; instance + scope isolation
- [x] No Notification / Calendar / Finance side effects
- [x] Public facade exports Phase 1E APIs; test fakes not on facade
- [x] Legacy CRM menu remains PARTIAL
- [x] Focused Phase 1E tests + Phase 1B/1C/1D/menu/finance regressions
- [x] No SQL / Supabase / deploy / commit / push / PR in this phase

## Command success / failure semantics

| Result | Meaning |
|--------|---------|
| `ok: true` | Documented aggregate write committed; pending envelopes validated (not delivered) |
| `ok: false` | No aggregate write committed for that command |

## Explicit non-goals

- CRM UI / routes / pipeline board
- SQL / RLS / Supabase repos
- Durable event bus / delivery workers
- Notification / email / SMS / Calendar integration
- Lead conversion or Opportunity stage mutation as side effects
- Automatic reminders / background workers
- Production / Staging deploy

## Phase 1F entry conditions

1. Phase 1E committed after owner review.
2. Tags/consent and/or event-dispatch adapters may proceed on the same foundation.
3. Still no SQL until later persistence phases.
4. Still no CRM UI rewrite until a later UI phase (unless owner expands scope).
