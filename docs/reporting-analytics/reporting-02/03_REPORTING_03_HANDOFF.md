# REPORTING-03 Handoff — Staging Apply Readiness

REPORTING-02 delivers authored durable schema, RLS, durable repository adapters, and execution/export orchestration. It does **not** apply SQL and does **not** claim Staging/Production readiness.

## Preconditions to open REPORTING-03

1. REPORTING-02 PR merged into `main`
2. Post-merge verification PASS (CI + registry)
3. SQL package under `docs/reporting-analytics/reporting-02/` stable (no pending ownership collision)
4. Repository / execution / export public contracts stable
5. No active Reporting-owned workstream collision
6. Owner grants **separate** authorization for Staging apply
7. Staging connection, backup, and readiness verified independently

## Out of REPORTING-02

- Staging SQL apply / live certify
- Production apply
- Dashboard UI cutover (REPORTING-04)
- Experience Channels presentation wiring (REPORTING-04/05)
- Production blob storage integration
- I&A analytical query runtime

## Suggested REPORTING-03 scope

- Staging preflight + apply + verify + rollback drill
- Live certification of RLS fail-closed paths
- Idempotency and optimistic concurrency smoke against Staging
- Artifact storage adapter certification (if Owner authorizes storage)

## Local remediation delivered (not Staging apply)

- Permission catalog seed: `40_REPORTING_02_PERMISSION_SEED.sql` + handoff `04_IDENTITY_PERMISSION_HANDOFF.md` (no role grants)
- Projection mapping adapter boundary: `createIntelligenceProjectionDataSourcePort` (public I&A entry only; `PROJECTION_SOURCE_NOT_DEPLOYED` until I&A publish execute-by-projectionId)
- Staging apply manifest: `05_STAGING_APPLY_MANIFEST.md` — **do not execute** without Owner GO
