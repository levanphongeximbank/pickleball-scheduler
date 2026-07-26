# Apply Authorization Guard

## Implemented fix (Phase B)

Committed Owner decision JSON is no longer sufficient for mutation.

Write path now requires **all** of:

1. Explicit CLI ↔ env token matches for permission-seed, Phase 1G, umbrella
   (and role-matrix unless deferred).
2. Live Staging URL identity proving `qyewbxjsiiyufanzcjcq`
   (decision identity alone is insufficient).
3. Backup evidence gate.
4. Credentials gate.
5. Runtime durable-off gate.
6. Manifest checksum verification.
7. Explicit one-time / non-replayable authorization file containing:
   - intended operation
   - exact Staging project ref
   - exact migration plan fingerprint
   - issuedAt / short expiresAt
   - unique nonce and operationId
   - status `issued` (consumed after success)

Additional fail-closed controls:

- Audit / test / CI contexts refuse before mutation connections.
- Production ref `expuvcohlcjzvrrauvud` is absolutely blocked.
- Wrong / missing project refs are rejected.
- Expired, replayed, or fingerprint-mismatched authorizations are rejected.
- Verify/dry-run path never calls the apply executor.
- Apply evidence is secret-scanned before write.
- The Production verdict is terminal: once an authorization is seen to target
  `expuvcohlcjzvrrauvud`, no later gate (expiry, replay, fingerprint) can
  overwrite or downgrade that verdict.

## Grant remediation runner (DCL only)

`scripts/crm/bm-final-safety-01-staging-grant-remediation.mjs` applies
Owner-approved DCL under the same one-time mechanism, with a separate operation
(`crm_bm_final_safety_01_staging_grant_remediation`) so that a Staging *apply*
authorization can never unlock grant remediation and vice versa.

It refuses unless all of the following hold:

1. `--expect-sql-sha256` matches the SHA-256 of the approved SQL file, so any
   edit to the certified SQL is refused before anything else happens.
2. The file is executed byte-for-byte; no inline or generated SQL is possible.
3. The statement whitelist holds: `BEGIN`, one `DO` guard block verified free of
   DML/DDL, `REVOKE` (or `GRANT` for the rollback file), `COMMIT`.
4. No Production ref appears in the executable SQL (comments excluded).
5. Audit / test / CI context is absent.
6. A valid, unexpired, unconsumed one-time authorization is bound to the
   operation, the Staging ref and the SQL fingerprint.
7. Mutation requires `--execute`; the default mode is plan-only and never opens
   a database connection.

The authorization must live outside the Git worktree — issuing one inside the
worktree is refused — and it is consumed immediately after a successful commit.

## Files

- `src/features/crm/staging/phase1hBOneTimeAuthorization.js`
- `src/features/crm/staging/phase1hBGates.js`
- `scripts/crm/phase-1h-staging-apply.mjs`
- `scripts/crm/bm-final-safety-01-staging-grant-remediation.mjs`
- `scripts/crm/bm-final-safety-01-staging-readonly-verify.mjs`

## Controlled future Staging apply

Still possible: issue an untracked `*.authorization.local` one-time file bound to
the exact migration fingerprint, supply matching CLI tokens, then run apply.
Repeated apply cannot reuse a consumed authorization.
