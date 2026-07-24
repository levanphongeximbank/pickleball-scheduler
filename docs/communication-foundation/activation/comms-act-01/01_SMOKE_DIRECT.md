# COMMS-ACT-01 — Direct Smoke Checklist

**Data:** Staging `@staging.local` test identities only. **No Production data.**  
**COMMS-ACT-01:** checklist only — do not create real remote rows in this workstream.

## Actors (suggested)

| Actor | Example |
|-------|---------|
| A | `player@staging.local` |
| B | `owner@staging.local` |
| C (third party) | `manager@staging.local` |

## Cases

- [ ] Request Direct conversation A→B
- [ ] Accept request (B)
- [ ] Decline / cancel paths (as implemented)
- [ ] Send message A→B
- [ ] Reply in-thread
- [ ] Advance read cursor (monotonic)
- [ ] Block path A blocks B (or vice versa)
- [ ] Report path (if exercised)
- [ ] Unauthorized third party C denied read/write
- [ ] UI-supplied actorId override ignored

## Pass criteria

Trusted backend (service-role) after app authorization succeeds for A/B authorized flows; anon/authenticated direct table access remains denied under deny-all.
