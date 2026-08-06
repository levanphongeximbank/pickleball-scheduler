# 04 — Forward Migration Plan (Planning Only)

**Executable SQL in this task:** FORBIDDEN  
**First apply environment:** Staging only  
**Production apply:** Requires a **separate future Owner GO** after Staging gates pass

## Goal

Introduce dedicated QA quarantine authority (`public.qa_identity_quarantines` + controlled writers) without modifying `profiles.status` lifecycle semantics or `profiles_status_check`.

## Future migration sequence

| Step | Object / action | Notes |
|------|-----------------|-------|
| M0 | Preflight inventory | Confirm Staging backup; record schema snapshot of `profiles` CHECKs; assert `quarantined` absent from `profiles_status_check` |
| M1 | Create table `public.qa_identity_quarantines` | Columns per `02_CANONICAL_QA_QUARANTINE_DATA_MODEL.md` |
| M2 | Add CHECK constraints | state, identity bind, reason, release consistency, original_status |
| M3 | Add FK constraints | `profile_id` → profiles; `auth_user_id` → auth.users |
| M4 | Create indexes | unique partial active-by-profile/auth; batch/state; inventory |
| M5 | Enable RLS | Default deny for `authenticated` / `anon` |
| M6 | Grants | Revoke direct DML from `authenticated`/`anon`; grant SELECT limited via policy or deny; service_role bypass noted explicitly |
| M7 | Writer RPCs / controlled service interface | `qa_quarantine_apply`, `qa_quarantine_release`, optional `qa_quarantine_is_active` read helper |
| M8 | Audit integration | Write `audit_logs` entries from SECURITY DEFINER writers (or parallel ops audit) |
| M9 | Optional compatibility view | e.g. `qa_identity_quarantine_active_v` projecting `profile_id`, `qa_quarantined=true` |
| M10 | Verify | Constraint/index/RLS/RPC existence tests — no Production |
| M11 | Staging rehearsal | Per `10_STAGING_REHEARSAL_AND_ACCEPTANCE_GATES.md` |
| M12 | Production apply (future) | Separate Owner GO; never authorized by this planning package |

## Object creation order

1. Extensions if needed (`pgcrypto` / `gen_random_uuid` already expected)
2. Table
3. Constraints (CHECK then FK)
4. Indexes
5. Comments
6. RLS enable + policies
7. Revoke/grant
8. Functions (SECURITY DEFINER) + grants execute to intended roles only
9. Optional view

## Constraints and indexes

Must implement all constraints and indexes named in the data model doc. Especially:

- Partial unique active quarantine per profile and per auth user
- `profile_id = auth_user_id`
- Release consistency CHECK

## RLS activation

- `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
- No broad `authenticated` INSERT/UPDATE/DELETE
- Read: SUPER_ADMIN and/or `user.manage` with tenant scoping for audit UI if productized later; until then, ops may be service-role only
- Write: only via SECURITY DEFINER RPCs that assert SUPER_ADMIN **or** explicit service-role operator path documented in `06_RLS_WRITER_AND_AUTHORITY_MODEL.md`

## Grants

- `REVOKE ALL ON TABLE public.qa_identity_quarantines FROM PUBLIC, anon, authenticated`
- Grant `SELECT` only if a deliberate authenticated audit path exists
- `GRANT EXECUTE` on writer RPCs only to roles that must call them (prefer service_role operator + tightly gated authenticated SUPER_ADMIN if UI needed)

## Writer RPC / controlled service interface (planned contracts)

### `qa_quarantine_apply(...)`

Inputs (conceptual): `profile_id`, `auth_user_id`, `batch_id`, `reason`, `expected_email`, `allowlist_label`, optional metadata.

Behavior:

1. AuthZ: SUPER_ADMIN or service-role operator context
2. Verify profile/auth/email bind + certified QA predicate hooks at app layer
3. Snapshot `profiles.status` into `original_profile_status` (do not update it)
4. Idempotent insert/select active row
5. Emit audit event
6. Return quarantine row id + state

**Must not** UPDATE `profiles.status`.

### `qa_quarantine_release(...)`

Inputs: `profile_id` or quarantine `id`, `batch_id`, `release_reason`.

Behavior:

1. AuthZ same as apply
2. Drift checks
3. Transition `active` → `released`
4. Return snapshot fields needed for Auth unban decisions (Auth unban may remain in operator runner, not SQL, to match current Admin API pattern)

### Optional read: `qa_quarantine_is_active(profile_id) → boolean`

For directory filters / projectors.

## Compatibility views or projectors

| Artifact | Purpose |
|----------|---------|
| SQL view of active quarantines | Server-side joins if needed |
| App projector setting `qaQuarantined: true` | Compatibility with `qaTestIdentityFilter` |
| **Forbidden** projector writing `status: 'quarantined'` into DB | Must never persist illegal status |

Temporary dual-read: filter accepts active quarantine authority OR legacy `status==='quarantined'` OR `meta.qaQuarantined` during migration window; final state prefers authority table / projector only.

## No-data-loss properties

- Additive schema only relative to `profiles`
- No DROP of profiles columns
- No rewrite of existing profile rows
- Quarantine history retained via released rows
- Original profile status stored as snapshot text only

## Idempotency

- Migration scripts must be re-runnable (`IF NOT EXISTS` / constraint existence guards) in future implementation
- Apply RPC idempotent for same identity+batch active state
- Reapply after rollback must recreate authority cleanly

## Migration verification (future)

Assert:

1. Table exists with expected columns/types
2. All CHECKs present
3. Partial unique indexes present
4. RLS enabled
5. Direct authenticated INSERT fails
6. `profiles_status_check` definition **unchanged** and still excludes `quarantined`
7. Sample apply/release round-trip on Staging fixtures only

## Staging-only first application

```text
STAGING_FIRST=YES
PRODUCTION_APPLY_IN_THIS_PLAN=NO
PRODUCTION_GO=NO
```

Production migration apply is a later work package (WP8) gated by Staging acceptance and a **new** Owner GO.

## Explicit non-actions for implementers reading this plan

- Do not create executable SQL in the planning directory as “ready to paste Production”
- Do not alter `profiles_status_check`
- Do not backfill fake `quarantined` statuses
- Do not reuse retired B1 GO/batch
