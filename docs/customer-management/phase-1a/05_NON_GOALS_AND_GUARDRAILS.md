# 05 — Non-Goals and Guardrails

## Non-goals (CUSTOMER-01)

- SQL migrations / RLS / Supabase schema
- UI pages or routes
- Changing CRM, Player, Finance, Club, Notification, Competition internals
- Package dependency changes
- Production / Staging activation
- Booking FK backfill
- Consent governance engine
- Email/phone verification runtime
- Merge execution

## Guardrails

1. Do not treat Identity role `CUSTOMER` as a customer master record.
2. Do not collapse Player / ClubMember / Lead into Customer.
3. Do not import CRM/Finance/Notification internals into Customer.
4. Do not export mutable repository state from the public facade.
5. Fail closed when repository adapter is missing.
6. Keep legacy `src/models/customer.js` untouched until an adoption phase.
7. Platform subject type for this module is `CUSTOMER` (not `CRM_CUSTOMER`).
