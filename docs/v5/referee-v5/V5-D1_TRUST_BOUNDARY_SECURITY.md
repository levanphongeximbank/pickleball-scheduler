# V5-D.1 — Trust Boundary Security

**Status:** DRAFT specification — implemented in JS layer, SQL grants in V5-D.1

---

## Principle

```text
RLS protects direct client access.
Mutation security is enforced by:
1. Edge Function JWT verification
2. Server-derived actor identity
3. Database assignment/tenant checks
4. Internal RPC grants
5. Atomic constraints and validation
```

## Edge Function requirements

| Rule | Implementation |
|------|----------------|
| Verify access token | `verifyAccessToken()` / Supabase Auth |
| Actor from verified JWT | `deriveUserIdFromVerifiedToken()` |
| Ignore body `actorId` | `rejectClientIdentityFields()` |
| Ignore body `tenantId` for auth | Assignment lookup from DB |
| Ignore body `role` | Role from `referee_assignments` |
| No token logging | Spec — Edge deploy checklist |
| Expired token rejected | Test 29 D1 |

## Internal RPC trust

- Receives `p_actor_id` from trusted Edge Function (service role)
- **Still re-checks** assignment in database inside `FOR UPDATE` transaction
- Browser cannot invoke — grants revoked from `authenticated`

## Service role boundary

Service role bypasses RLS → mutation path must never be exposed to browser.

Only Edge Function (server-side) holds service role key.

## Token access (V5)

Legacy token RPCs unchanged. V5 token path **not enabled**.
