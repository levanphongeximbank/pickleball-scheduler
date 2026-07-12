# V5-D — RLS Security Specification

**Status:** DRAFT — NOT APPLIED  
**SQL:** `PHASE_V5D_REFEREE_PERSISTENCE.sql`

---

## 1. Principles

| Layer | Enforcement |
|-------|-------------|
| Route guard (UI) | UX only — not sufficient alone |
| RPC `security definer` | Auth + assignment check |
| RLS | Tenant + assignment scoped SELECT; deny client writes |
| JS service | Mirrors RLS for in-memory tests |

---

## 2. Read policies

### match_live_states / match_events

**SELECT allowed when:**

- `referee_v5_is_super_admin()` OR
- `referee_v5_current_user_has_assignment(tenant_id, tournament_id, match_id)`

**SELECT denied:** unassigned referee, other tenant, anonymous (except future approved token path — **not enabled in V5-D**)

### referee_assignments

User may SELECT own rows (`referee_user_id = auth.uid()`) or super admin all.

---

## 3. Write policies

| Table | Client INSERT | Client UPDATE | Client DELETE |
|-------|---------------|---------------|---------------|
| `match_events` | ❌ | ❌ | ❌ |
| `match_live_states` | ❌ | ❌ | ❌ |
| `match_result_revisions` | ❌ | ❌ | ❌ |
| `match_sync_mutations` | ❌ | ❌ | ❌ |

All mutations via RPC + service role commit path only.

---

## 4. Assignment validation (RPC + JS)

Checks before command:

1. `auth.uid()` present
2. `tenant_id` matches actor tenant
3. Assignment `status = active`
4. `revoked_at IS NULL`
5. `token_expires_at` not passed (if set)
6. `referee_user_id = auth.uid()` (unless super admin)

Error codes: `REFEREE_NOT_ASSIGNED`, `ASSIGNMENT_REVOKED`, `ASSIGNMENT_EXPIRED`, `TENANT_ACCESS_DENIED`

---

## 5. HEAD_REFEREE

Role defined in schema (`HEAD_REFEREE`) but **not enabled** in V5-D policies beyond design:

- Future: tournament-wide read, reassign, override with reason
- V5-D: same write path as `REFEREE`; no extra grants

---

## 6. Token access (legacy vs V5)

| Path | V5-D |
|------|------|
| Legacy `referee_get_match_by_token` | Unchanged, separate module |
| V5 token access | **NOT OPEN** — requires owner security design |

Requirements if enabled later: hashed token, expiry, revoke, match scope, no cross-match access.

---

## 7. Super admin

`referee_v5_is_super_admin()` — read any assigned-scope data for support.

Write still via RPC (no direct table UPDATE).

---

## 8. Service role

Edge Function uses service role to:

- INSERT `match_events`
- UPDATE `match_live_states.state_payload`
- INSERT `match_result_revisions`

Only after JS engine + authorization validated in function handler.

Never exposed to browser client.

---

## 9. RLS verification plan (staging — NOT RUN)

| # | Test |
|---|------|
| 26 | Referee reads assigned match |
| 27 | Referee cannot read other match |
| 28 | Tenant A ≠ Tenant B |
| 29–31 | Direct insert/update denied |
| 32–33 | Revoked / expired assignment |
| 34 | Super admin read |
| 35 | Service role backend-only |

Script target: `scripts/verify-referee-v5-rls.mjs` (future, post GO)

---

## 10. Error messages (Vietnamese)

Defined in `persistence/errors.js` → `REFEREE_V5_ERROR_VI`.

UI must map `code` to user message; never show raw SQL.
