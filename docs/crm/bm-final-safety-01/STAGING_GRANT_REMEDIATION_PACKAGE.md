# Staging Grant Remediation Package

**Status:** EXECUTED once under Owner execution approval #2 — see
`STAGING_GRANT_REMEDIATION_EXECUTION.md`  
**Verdict:** `BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS`  
**Staging project ref (exact):** `qyewbxjsiiyufanzcjcq`  
**Production project ref (blocked):** `expuvcohlcjzvrrauvud`

The SQL below was executed byte-for-byte and was not edited before or after
execution. The one-time authorization that unlocked it is consumed, so this
package cannot be replayed without a fresh Owner-issued authorization.

## Exact objects affected

| Object | Type |
|--------|------|
| `public.crm_tags` | table |
| `public.crm_tag_assignments` | table |
| `public.crm_consent_records` | table |
| `public.crm_pending_events` | table |
| `public.crm_phase1g_scope_allows(text, text)` | function |

No other objects are included.

## Exact current grant matrix (Phase A evidence)

### Tables → `authenticated`

| Table | Current privileges |
|-------|--------------------|
| `crm_tags` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `crm_tag_assignments` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `crm_consent_records` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `crm_pending_events` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |

Grantor: `postgres`. No direct `anon` / `PUBLIC` table grants were observed.

### Routines

| Routine | Grantee | Privilege |
|---------|---------|-----------|
| `crm_phase1g_scope_allows` | `authenticated` | EXECUTE |
| `crm_phase1g_scope_allows` | `anon` | EXECUTE |
| `crm_claim_pending_events` | `authenticated` | EXECUTE |
| `crm_release_expired_pending_event_claims` | `authenticated` | EXECUTE |
| `crm_consent_records_immutable_guard` | `authenticated` | EXECUTE |

## Exact target grant matrix (this remediation wave)

### Tables → `authenticated`

| Table | Desired after remediation |
|-------|---------------------------|
| `crm_tags` | INSERT, SELECT, UPDATE |
| `crm_tag_assignments` | DELETE, INSERT, SELECT, UPDATE* |
| `crm_consent_records` | INSERT, SELECT, UPDATE* |
| `crm_pending_events` | INSERT, SELECT, UPDATE |

\*This wave only removes Owner-listed excess privileges (`DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`). It does **not** revoke residual `UPDATE` on `crm_tag_assignments` or `crm_consent_records` in this package. Those residuals are documented below for a later Owner decision.

### Routines

| Routine | Desired |
|---------|---------|
| `crm_phase1g_scope_allows` | EXECUTE for `authenticated` only (`anon` revoked) |

## Exact remediation statements

See `STAGING_GRANT_REMEDIATION.sql`.

Summary:

1. `REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.crm_tags FROM authenticated;`  
   Reason: not in canonical Phase 1G grants for tags.
2. `REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.crm_tag_assignments FROM authenticated;`  
   Reason: not in canonical grants; `DELETE` kept because it is designed.
3. `REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.crm_consent_records FROM authenticated;`  
   Reason: consent is append-only (`SELECT, INSERT` only in design).
4. `REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.crm_pending_events FROM authenticated;`  
   Reason: not in canonical pending-event grants.
5. `REVOKE EXECUTE ON FUNCTION public.crm_phase1g_scope_allows(text, text) FROM anon;`  
   Reason: canonical contract grants EXECUTE to `authenticated` only.

## Data / schema impact confirmation

- No data rows are modified (`SELECT`/DCL only).
- No schema objects created, altered, or dropped.
- No role-matrix rows touched.
- CRM table row counts were 0 at Phase A verification; remediation does not insert/update/delete rows.

## Transaction strategy

1. Pre-mutation read-only snapshot (catalog grants only).
2. `BEGIN` → REVOKE statements → `COMMIT`.
3. Immediate post-mutation read-only grant read-back.
4. If read-back fails expectation: run rollback SQL in a separate approved transaction.

## Pre-mutation snapshot

Re-run:

`node scripts/crm/bm-final-safety-01-staging-readonly-verify.mjs`

Capture `tableGrants` and `routineGrants` before any DCL.

## Post-mutation verification

Re-run the same read-only verifier and assert:

- listed excess privileges absent;
- desired privileges still present;
- `anon` EXECUTE absent on `crm_phase1g_scope_allows`;
- row counts unchanged;
- no schema object drift.

## Exact rollback statements

See `STAGING_GRANT_REMEDIATION_ROLLBACK.sql`.

## One-time execution authorization mechanism

After Owner execution approval #2, issue an untracked local one-time authorization
file (`.authorization.local`, gitignored via `*.local`) bound to:

- operation: Staging grant remediation (separate from migration apply);
- exact Staging ref `qyewbxjsiiyufanzcjcq`;
- exact remediation SQL fingerprint;
- issuedAt / short expiresAt;
- unique nonce / operationId;
- consumed after success.

Do **not** use committed `OWNER_LIMITED_STAGING_APPROVAL.json`.
Do **not** run `phase-1h-staging-apply.mjs --apply-staging` for this DCL wave.

## Secret-safe command (proposed, not executed)

Owner shell only, after approval #2 and one-time auth issuance:

```text
# Pseudocode — do not run until Owner execution approval #2
# 1) read-only snapshot
node scripts/crm/bm-final-safety-01-staging-readonly-verify.mjs
# 2) apply DCL via Staging Management API project ref qyewbxjsiiyufanzcjcq
#    using a dedicated remediation runner that requires one-time auth
# 3) read-only verify again
node scripts/crm/bm-final-safety-01-staging-readonly-verify.mjs
```

Credentials must never be printed.

## Estimated blast radius

- Privilege surface only for four empty CRM tables + one scope helper.
- Authenticated clients lose table privileges they should not have had.
- Anonymous clients lose EXECUTE on the scope helper.
- RLS policies remain unchanged; FORCE RLS remains on.

## Expected application behavior after remediation

- No CRM durable runtime is enabled; app impact should be none for end users.
- JWT callers still require CRM permissions via RLS; excess table DCL removal
  reduces accidental privilege if a policy were ever loosened.
- Scope helper remains usable by `authenticated` under RLS/RPC paths.

## Residual risks deferred (not in this wave)

- `UPDATE` still present on `crm_tag_assignments` and `crm_consent_records`
  (not in Owner-listed privilege set for this wave).
- `authenticated` EXECUTE on `crm_consent_records_immutable_guard` remains
  (trigger function; not in Owner-listed scope).
- Apply-authorization code fix is implemented, but Staging DCL not yet applied.
