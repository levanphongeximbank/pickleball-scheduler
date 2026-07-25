# COMMS-ACT-06 — Production Database Audit (read-only)

**Target only:** `expuvcohlcjzvrrauvud`  
**Forbidden:** insert / update / delete / apply / rollback / auth PII dumps.

## Live catalog status (ACT-06 audit window)

| Item | Result |
|------|--------|
| Live Management API / DB catalog executed | **NO** — no Production credentials in worktree |
| mutationCount | **0** |
| Classification pending live Owner run | `PRODUCTION_SCHEMA_NOT_APPLIED_EXPECTED` (expected pre-ACT-07) |

ACT-05 closed state recorded Production untouched. Fresh ACT-06 **does not** treat that as live proof — Owner must run read-only catalog before Gate C.

## Catalog checklist (Owner / ACT-07 Gate C)

Run `scripts/communication/comms-act-06-production-catalog-readonly.mjs` with Owner token (read-only).

Audit:

1. 14 `communication_*` tables present or absent
2. RLS enabled on each
3. Deny-all policies baseline
4. Club SELECT policies (ACT-03/04) if schema present
5. Grants anon/authenticated
6. RPCs (`allocate_message_position`, `advance_read_cursor` names per package)
7. Triggers/functions
8. Realtime publication membership (**must be 0**)
9. Row counts per Communication table (aggregate only)
10. Migration history drift vs SQL package hashes
11. Conflicting legacy objects
12. Marker collisions vs `COMMS_ACT_07_PROD_SMOKE_`

## SQL package binding (static)

| File | Role |
|------|------|
| `docs/supabase-communication-comms05.sql` | Forward foundation |
| `docs/supabase-communication-comms05-rollback.sql` | Rollback |
| `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` | Club SELECT |
| sibling rollback | Club SELECT rollback |

## If schema absent

Classify **`PRODUCTION_SCHEMA_NOT_APPLIED_EXPECTED`** — not an implementation defect.  
ACT-07 Gate D step 1 = schema/RLS apply under separate Owner GO.

## Mutation policy

ACT-06 mutationCount must remain **0**.
