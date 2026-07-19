# Phase 1C — Club Owner Assign Authorization Security Gate

**Verdict: SECURITY BLOCKER** (ordinary `tenant_staff` / bare `phase42_is_tenant_member` can call `club_assign_owner`)

**Production:** DO NOT APPLY from this branch without Owner GO.  
**Staging:** apply only after Owner approval of the narrow patch.

## Exact current RPC authorization (deployed)

Source: `docs/v5/phase45a3a/PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql` (Production `pg_get_functiondef`, 2026-07-15).

### `club_assign_owner` / `club_clear_owner`

Plain language:

1. If `auth.uid()` is null → `NOT_AUTHENTICATED`
2. If request id missing → `REQUEST_ID_REQUIRED`
3. Idempotency cache hit → return cached response
4. Load club `FOR UPDATE`; missing → `NOT_FOUND`
5. If `clubs.version <> expected` → `VERSION_CONFLICT`
6. **Authz boolean:**  
   `phase42_is_platform_super_admin() OR phase42_is_tenant_member(club.tenant_id)`  
   else → `FORBIDDEN`
7. Assign only: target must be active `club_members` row → else `MEMBER_REQUIRED`
8. Mutate governance assignment + bump club version
9. Audit: `club.assign_owner` / `club.clear_owner` via `phase42_write_audit`
10. Return canonical club JSON

### Helper `phase42_is_tenant_member(tenant_id)` (`PHASE_42C_RLS_RPC.sql`)

TRUE if **any** of:

- active `tenant_members` row for `(tenant_id, auth.uid())` — **no role_code filter** (`tenant_owner` **or** `tenant_staff`)
- OR platform super admin
- OR `profiles.venue_id = tenant_id` and role in  
  `VENUE_OWNER | COURT_OWNER | VENUE_MANAGER | COURT_MANAGER | TENANT_OWNER`

### Grants

- Explicit: `GRANT EXECUTE … TO authenticated`
- Catalog also showed PUBLIC/anon/service_role EXECUTE from Supabase defaults; function still returns `NOT_AUTHENTICATED` when `auth.uid()` is null.

### RLS

Both RPCs are `SECURITY DEFINER` — they bypass table RLS for writes. Authz is entirely the boolean above, not RLS.

---

## Difference vs Owner expected policy

| Expected ALLOW | Current RPC |
|----------------|-------------|
| SUPER_ADMIN | ALLOW |
| Authorized tenant owner/admin | ALLOW (tenant_owner + also broader) |
| Current Club Owner (if approved) | **DENY** unless also tenant member |

| Expected DENY | Current RPC |
|---------------|-------------|
| Ordinary tenant member / tenant_staff | **ALLOW** ← BLOCKER |
| VENUE_MANAGER / COURT_MANAGER | **ALLOW** ← BLOCKER-adjacent |
| Club Owner alone | DENY |
| President alone | DENY |
| VP alone | DENY |
| Ordinary club player | DENY |
| Unrelated user | DENY |
| Anonymous | NOT_AUTHENTICATED |
| Stale version | VERSION_CONFLICT |

**Do not silently add Club Owner to RPC** — requires explicit Owner GO (see OPTIONAL section in gate SQL).

---

## Prepared patch (not applied)

| File | Purpose |
|------|---------|
| `PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_SECURITY_GATE.sql` | Introduce `phase42_can_assign_club_owner`; wire assign/clear |
| `PHASE_1C_CLUB_OWNER_ASSIGN_AUTHZ_ROLLBACK.sql` | Restore bare `phase42_is_tenant_member` bodies |

### Staging verification plan (after Owner GO to apply Staging only)

1. Apply gate SQL on Staging (never Production from this branch).
2. As `tenant_staff`: call `club_assign_owner` → expect `FORBIDDEN`.
3. As `tenant_owner` / SA: assign → `ok`, Owner labels refresh on My Club / Governance / Org Chart / Manage Detail.
4. As Club Owner alone (PLAYER): → `FORBIDDEN`; UI transfer control hidden under V2.
5. Stale `p_expected_club_version` → `VERSION_CONFLICT`.
6. Clear owner as tenant_owner → `ok`; as staff → `FORBIDDEN`.
7. Rollback file only if Staging must revert.

---

## UI alignment (client, this commit)

Under V2, **do not show** “Chuyển quyền sở hữu” solely because `canTransferClubOwnership` is true when the caller is not also an authorized tenant assigner (`canAssignClubOwner`). That removes UI/RPC mismatch for Club Owner–only users (RPC would FORBIDDEN).

`assignClubOwner` UI remains gated by `canAssignClubOwner` (tenant owner / SA).
