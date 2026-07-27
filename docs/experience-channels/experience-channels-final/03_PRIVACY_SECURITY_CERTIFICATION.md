# Privacy & Security Certification

## DTO allowlists

Tournament and Ranking public DTOs remain frozen allowlists (PC-02). Clubs/Courts allowlists unchanged.

Forbidden examples absent from public output: phone, email, note, staff, tenantId, audit, memberId, rates, private address.

## RLS / privileges

- Projection tables: RLS on; anon SELECT denied
- Public list RPCs: SECURITY DEFINER; anon EXECUTE granted
- Anon INSERT/UPDATE/DELETE denied

## Fail-closed

- Invalid pagination rejected
- Unsupported sort rejected
- Remote failure → ERROR (no mock)
- Error messages sanitized (no secrets / stack dumps in public UI)

Evidence: `evidence/DTO_PRIVACY.json`
