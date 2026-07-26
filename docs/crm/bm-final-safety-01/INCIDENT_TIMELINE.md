# Incident Timeline

- 2026-07-22: committed limited Owner decision recorded for the original
  Staging apply; it had no expiry, nonce or consumed state.
- 2026-07-26 13:39:08 UTC: the apply script reported a repeated Staging apply
  completed against `qyewbxjsiiyufanzcjcq`.
- The reported execution applied migration orders 1–7 and deferred role-matrix
  order 8.
- Production connection was reported false.
- 2026-07-26 14:16–14:17 UTC: BM-FINAL-SAFETY-01 ran two catalog-only probes in
  explicit read-only transactions, each ending in rollback.
- Phase A found excess table/function grants and stopped before Phase B.
- Phase B implemented the one-time / non-replayable authorization guard and
  prepared the grant remediation package without touching the database.
- 2026-07-26 14:52:05 UTC: one-time authorization issued for operation
  `crm_bm_final_safety_01_staging_grant_remediation`, bound to the Staging ref
  and the SHA-256 of the approved SQL, TTL 30 minutes, stored outside Git.
- 2026-07-26 14:52:33–14:52:34 UTC: the approved SQL executed byte-for-byte in
  one transaction — 5 `REVOKE` statements — and committed.
- 2026-07-26 14:52:34 UTC: the one-time authorization was consumed.
- Immediately after: read-only re-verification confirmed the target grant matrix
  with no data, schema, policy or function change. No rollback was needed.
- Two replay attempts were rejected with 0 database writes.

Incident command family: `phase-1h-staging-apply.mjs` live apply path. It was
never executed during BM-FINAL-SAFETY-01; the only Staging mutation was the
Owner-approved DCL transaction above.
