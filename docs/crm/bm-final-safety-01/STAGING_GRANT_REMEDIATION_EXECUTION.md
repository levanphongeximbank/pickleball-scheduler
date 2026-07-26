# BM-FINAL-SAFETY-01 — Staging grant remediation execution record

Verdict: `BM_FINAL_SAFETY_01_STAGING_REMEDIATION_PASS`

Target project ref: `qyewbxjsiiyufanzcjcq` (Staging)
Production ref `expuvcohlcjzvrrauvud`: never connected, 0 statements, 0 mutations.

## 1. Pre-mutation stop gates

| Gate | Result |
|------|--------|
| Worktree | `C:/Users/Le Phong/PICK_VN-Workstreams/business-modules/bm-final-safety-01` |
| Branch | `feature/bm-final-safety-01-crm-staging-reapply-guard` |
| HEAD = fresh `origin/main` | `01a70650281f6c8f7acf358e54a3a3c726df8209` |
| Working tree | only intended BM-FINAL-SAFETY-01 files |
| `package.json` / `package-lock.json` | unchanged |
| Stash count | 21 (unchanged, nothing popped/applied/dropped) |
| Secret scan | PASS (15 artifacts, 0 hits) |
| Focused safety tests | PASS |
| Staging project ref | `qyewbxjsiiyufanzcjcq` |
| Production connection | none |
| Current grant matrix vs baseline | exact match |
| Original incident evidence | SHA256 `AA68D276A2E357101AD164E3B6038F30ECEB7C24B46A4FF66A10026EB78767A5`, 2065 bytes, unchanged |

### Recorded SQL hashes

| File | SHA-256 | Bytes |
|------|---------|-------|
| `STAGING_GRANT_REMEDIATION.sql` | `a429cf91715810e74df81854bbaf0782e9397f6c7f4c6b7f59588abdd8426ef4` | 3104 |
| `STAGING_GRANT_REMEDIATION_ROLLBACK.sql` | `30d0f7a58a6911e06d2bfcbc49f5c155c84caa794c7ac089ad39c72a82621807` | 1072 |

Both hashes were identical before and after execution: the approved SQL was not
edited at any point.

## 2. One-time authorization

Issued and verified by
`scripts/crm/bm-final-safety-01-staging-grant-remediation.mjs`, bound to a
dedicated operation so that a Staging *apply* authorization can never unlock
grant remediation.

| Field | Value |
|-------|-------|
| Operation | `crm_bm_final_safety_01_staging_grant_remediation` |
| Staging ref | `qyewbxjsiiyufanzcjcq` |
| SQL fingerprint | `a429cf91…26ef4` (SHA-256 of the approved file) |
| Operation ID | `crm-1hb-bc9d4cae-a289-4b94-bb61-8f248137bdea` |
| Nonce | present (UUID v4, not printed) |
| Issued at | `2026-07-26T14:52:05.781Z` |
| Expires at | `2026-07-26T15:22:05.781Z` (TTL 30 min) |
| Status at execution | `issued` |
| Status after execution | `consumed` (`2026-07-26T14:52:34.626Z`) |
| Storage | outside the Git worktree; never committed |

The runner refuses to issue an authorization inside the worktree and refuses to
execute unless the SQL hash, operation, Staging ref and fingerprint all match.

## 3. Exact SQL executed

The approved file was sent byte-for-byte inside one explicit transaction. No
statement was added, removed or edited.

```
BEGIN;
DO $$ BEGIN IF current_database() IS NULL THEN RAISE EXCEPTION 'database identity unavailable'; END IF; END $$;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.crm_tags FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.crm_tag_assignments FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.crm_consent_records FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.crm_pending_events FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_phase1g_scope_allows(text, text) FROM anon;
COMMIT;
```

Statement whitelist enforced by the runner: `BEGIN`, `DO` (guard, verified free
of DML/DDL), `REVOKE`, `COMMIT`. 8 statements total, 5 DCL statements.

Transaction result: committed (HTTP 201), started `2026-07-26T14:52:33.499Z`,
finished `2026-07-26T14:52:34.626Z`.

## 4. Grant matrix before and after

Table privileges for `authenticated` (only `anon` / `authenticated` / `PUBLIC`
are in scope; owner and `service_role` grants are out of scope):

| Table | Before | After | Target met |
|-------|--------|-------|------------|
| `crm_tags` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE | yes |
| `crm_tag_assignments` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE, DELETE | yes |
| `crm_consent_records` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE | yes |
| `crm_pending_events` | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | SELECT, INSERT, UPDATE | yes |

Routine privileges:

| Function | Before | After |
|----------|--------|-------|
| `crm_phase1g_scope_allows(text, text)` | `anon` EXECUTE + `authenticated` EXECUTE | `authenticated` EXECUTE only |
| `crm_claim_pending_events` | `authenticated` EXECUTE | unchanged |
| `crm_release_expired_pending_event_claims` | `authenticated` EXECUTE | unchanged |
| `crm_consent_records_immutable_guard` | `authenticated` EXECUTE | unchanged |

### Residual UPDATE grants (deferred contract, intentionally retained)

- `crm_tag_assignments.UPDATE` — retained per the deferred contract recorded in
  `STAGING_GRANT_REMEDIATION_PACKAGE.md`; no UPDATE policy exists, so RLS
  denies every row.
- `crm_consent_records.UPDATE` — retained per the same deferred contract;
  immutability is enforced by the `crm_consent_records_immutable_guard`
  trigger and no UPDATE policy exists.

Both are inside the Owner-approved allowance ("UPDATE residual chỉ giữ nếu đúng
deferred contract đã ghi") and are tracked as residual risk rather than silently
removed, because removing them was not part of the certified SQL.

## 5. Post-mutation read-only verification

Verifier: `scripts/crm/bm-final-safety-01-staging-readonly-verify.mjs`, one
explicit `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`, `transaction_read_only=on`
attested by the database, 0 writes, 0 application RPC calls.

| Check | Before | After |
|-------|--------|-------|
| CRM tables present | 4/4 (`relkind=r`) | 4/4 (`relkind=r`) |
| RLS enabled / forced | 4/4 enabled, 4/4 forced | 4/4 enabled, 4/4 forced |
| Row counts | all 0 | all 0 |
| Column fingerprint | `ded3561141b0aeb5ae3f76c24e601e27` | identical |
| Policies | 11 | 11, all expression fingerprints identical |
| Functions | 4 | 4, all definition fingerprints identical |
| Constraints / indexes / triggers | 26 / 18 / 1 | 26 / 18 / 1 |
| CRM permission rows | 24, fingerprint `2b268da901a6973167a711eda866dd39` | identical |
| CRM role-matrix rows | 0 | 0 |
| Duplicate `crm_*` relations | 0 | 0 |
| `crm_*` views | 0 | 0 |
| Production connections | 0 | 0 |

No data impact, no schema-object change, no policy or function change.

## 6. Rollback status

Not executed. Post-mutation verification met the target matrix on the first
attempt, so the rollback condition never triggered.
`STAGING_GRANT_REMEDIATION_ROLLBACK.sql` remains unmodified and available
(SHA-256 recorded above).

## 7. Replay rejection

| Attempt | Verdict | DB writes |
|---------|---------|-----------|
| Re-run `--execute` with the original authorization path (retired on consume) | `CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED` | 0 |
| Re-run `--execute` pointing at the `.consumed` marker | `CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED` | 0 |
| `--expect-sql-sha256` drift | refused before any authorization or DB contact | 0 |
| No authorization at all | `CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED` | 0 |

Both replay attempts were rejected by the gates before any network call, so the
remediation cannot be applied twice.

## 8. Hardening found while testing

Test 14 ("Production project ref is rejected") exposed a real precedence
weakness: the Production verdict could be overwritten by a later expiry check,
so an expired Production-targeted authorization reported as merely *expired*.
The Production block is now terminal — it returns immediately and no later gate
can downgrade it. The test expectation was not changed.

## 9. Mutation accounting

| Metric | Value |
|--------|-------|
| Staging DCL statements executed | 5 |
| Staging transactions committed | 1 |
| Staging data rows mutated | 0 |
| Staging schema objects created/altered/dropped | 0 |
| Migrations applied | 0 |
| Role-matrix changes | 0 |
| Production connections | 0 |
| Production mutations | 0 |
