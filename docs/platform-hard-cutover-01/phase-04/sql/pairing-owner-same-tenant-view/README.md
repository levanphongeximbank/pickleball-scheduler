# A-PAIR PERMISSION_DENIED remediation — Owner same-tenant pairing.view RPC auth

**Target only:** Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply. Do not auto-apply.**

## Browser evidence (sanitized)

| Field | Value |
|-------|--------|
| Steps | A-OWN…A-COMP = PASS (6) |
| Fail | A-PAIR / `PERMISSION_DENIED` |
| Tenant | `venue-staging-a` |
| Actor | `13e0***af9c` (app `TENANT_OWNER`) |
| Secrets printed | `false` |
| Runner | stopped at A-PAIR; not re-run |

## Diagnosis

`private_pairing_get_active_rules_for_scope` gates on:

1. `private_pairing_can('pairing.private_rules.view')`
2. `private_pairing_tenant_visible(v_tenant)`

Live helpers (pre-this-package) both require `is_super_admin()`.

PR #347 only inserted `role_permissions` for `COURT_OWNER` / `VENUE_OWNER` → `pairing.private_rules.view`. That cannot bypass the `is_super_admin()` gates. Adding `TENANT_OWNER` mapping alone also cannot.

## Chosen remediation

Forward package (does **not** rewrite applied `pairing-owner-view-rbac` history):

| File | Purpose |
|------|---------|
| `10_OWNER_SAME_TENANT_VIEW.sql` | Apply |
| `99_VERIFY.sql` | Verify |
| `90_ROLLBACK.sql` | Rollback |

Changes:

1. Ensure `TENANT_OWNER` role + `pairing.private_rules.view` for `TENANT_OWNER` / `COURT_OWNER` / `VENUE_OWNER`.
2. Add `private_pairing_actor_is_owner_like()`.
3. Replace `private_pairing_can` — platform path keeps `is_super_admin()`; owner-like path only for **view**.
4. Replace `private_pairing_tenant_visible` — owner-like may see rows only when `private_pairing_current_tenant_id() = p_tenant_id` (via `user_venue_id()`). No Owner cross-tenant. SUPER_ADMIN path unchanged.

Does **not**:

- grant edit / manage / admin / audit / simulate to owners
- grant view to every authenticated user
- change SUPER_ADMIN / PLATFORM_ADMIN grant rows
- wipe / reseed / touch Production

## Apply order (Owner GO)

1. Merge PR containing this package.
2. Apply `10_OWNER_SAME_TENANT_VIEW.sql` on Staging only.
3. Run `99_VERIFY.sql` — structural columns all true; then Owner-session runtime matrix in file comments.
4. Redeploy Preview if needed; Owner reruns Operator Acceptance once.
5. On abort: `90_ROLLBACK.sql` (restores PR4 helper bodies; keeps prior COURT_OWNER/VENUE_OWNER view mappings from #347 package).
