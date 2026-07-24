# COMMS-ACT-01 — Negative RLS Verification Package

Prepare **before** Staging activation. Execute against Staging in COMMS-ACT-02 after deny-all apply.

## Client (anon / authenticated)

For every `communication_*` table:

- [ ] `SELECT` denied
- [ ] `INSERT` denied
- [ ] `UPDATE` denied
- [ ] `DELETE` denied

RPC:

- [ ] `communication_allocate_message_position` execute denied for anon/authenticated
- [ ] `communication_advance_read_cursor` execute denied for anon/authenticated

## Authorization negatives (application + future client policies)

| # | Case | Expected |
|---|------|----------|
| 1 | Unauthenticated actor | denied |
| 2 | Direct third-party non-participant | denied |
| 3 | Club wrong-club | denied |
| 4 | Club suspended/removed | denied |
| 5 | Community wrong-tenant | denied |
| 6 | Community banned/suspended | denied |
| 7 | Missing Club/Community membership evidence | deny (fail-closed) |
| 8 | UI `actorId` override | ignored; auth actor wins |
| 9 | Cross-tenant conversation access | denied |

## Forbidden outcomes

- Any `USING (true)` policy
- Client tenantId trusted as authority
- Permissive fallback to “make QA pass”

## Evidence

Record results in [01_STAGING_EVIDENCE_TEMPLATE.md](./01_STAGING_EVIDENCE_TEMPLATE.md) §7.
