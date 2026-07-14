# Private Pairing Rules V2 — Production Runbook

| Field | Value |
|-------|-------|
| Status | **DRAFT — Production blocked** |
| Staging first | Required |
| Branch | `feature/private-pairing-rules-v2` |

---

## 1. Production prerequisites (all required)

1. Staging QA matrix signed PASS (`PRIVATE_PAIRING_RULES_V2_STAGING_QA.md`).
2. Owner GO for merge to release branch / main.
3. Owner GO for Production SQL apply.
4. Owner GO for Production feature flags.
5. PITR / backup confirmation for Production Supabase.
6. Rollback rehearsal understood (below).

**Until all of the above: do not apply Production migration and do not enable Production flags.**

---

## 2. Staging apply (already executed once)

1. Confirm helpers: `is_super_admin`, `user_has_permission`, `user_venue_id`, `user_role`.
2. Apply `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql`.
3. Apply `docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql` (if base file already had duplicate `MESSAGE` before fix).
4. Verify tables / RLS / RPCs / realtime OFF / audit append-only.
5. Preview env:
   - `VITE_PRIVATE_PAIRING_RULES_ENABLED=true`
   - `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED=true`
   - `VITE_RBAC_ENABLED=true`
6. Redeploy Preview; smoke SUPER_ADMIN UI.

Details: `PRIVATE_PAIRING_RULES_V2_PR4_APPLY_RUNBOOK.md`, `PRIVATE_PAIRING_RULES_V2_STAGING_QA.md`.

---

## 3. Production apply (future GO only)

1. Snapshot / ensure PITR.
2. Apply the **current** `PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql` (includes RAISE fix).
3. Verify with Staging verification SQL against Production.
4. Set Production flags only after UI smoke:
   - `VITE_PRIVATE_PAIRING_RULES_ENABLED=true`
   - `VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED=true`
5. Deploy Production frontend from reviewed SHA.
6. SUPER_ADMIN Production smoke (minimal create/list only).

---

## 4. Rollback

### Feature-flag rollback (fast)

Set both flags to `false` on the affected environment and redeploy. Runtime returns OFF; admin UI shows flag warning / RPC FEATURE_DISABLED.

### Schema rollback (staging/local; Production only with GO)

1. `revoke execute` / `drop function` for all `private_pairing_*` RPCs.
2. Drop triggers/policies on the four tables.
3. Optionally keep audit table; or `drop table … cascade` if empty / approved.
4. Delete `role_permissions` / optional `permissions` rows for `pairing.private_rules.%`.

---

## 5. Explicit non-actions (current)

- No Production migration in this GO
- No Production env changes in this GO
- No merge in this GO
