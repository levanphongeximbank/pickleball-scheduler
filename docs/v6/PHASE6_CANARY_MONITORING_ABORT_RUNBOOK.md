# Phase 6 Canary, Monitoring, and Abort Runbook

Status: `CANDIDATE_PENDING_OWNER_ACCEPTANCE`  
Production GO: `NO`

## Preconditions

- Storage recovery drill PASS with measured RTO and accepted RPO/RTO.
- Production database read-only preflight PASS with no unresolved HIGH/CRITICAL exposure.
- Exact M0–M11 manifest, rollback dependencies, environment values, and deployment SHA accepted.
- Backup timestamp and restore target recorded; no secret values stored in evidence.

## Canary sequence

1. Confirm the latest healthy Production deployment remains available for instant Vercel rollback.
2. Apply only the exact Owner-approved database/deployment package.
3. Enable the hard-cutover flags for one named internal canary tenant only where the runtime supports tenant scoping. If the flags are build-global, treat the deployment itself as the canary and do not broaden traffic until the observation gate passes.
4. Run anonymous negative probes, authenticated Tenant A/B isolation, privileged RPC negative/positive probes, and the eight-role operator checklist.
5. Observe for 30 minutes before broadening. Record start/end timestamps, deployment SHA, migration versions, operators, and metric snapshots.

## Success thresholds

- Zero tenant-isolation, authorization-bypass, anonymous-write, or data-integrity failures.
- Zero new Supabase Advisor ERROR findings.
- HTTP 5xx rate below 1% and no sustained increase of 0.5 percentage points over the immediately preceding 30-minute baseline.
- Auth success rate at least 98% for controlled QA accounts.
- API p95 below 2 seconds for the controlled probe set.
- No failed migration, stuck transaction, connection exhaustion, or queue/dead-letter growth caused by the cutover.

## Immediate abort conditions

- Any cross-tenant read/write, anonymous write, privilege escalation, or incorrect role access.
- Any destructive data drift, unexpected row-count loss, migration checksum mismatch, or irreversible step outside the accepted manifest.
- HTTP 5xx at or above 1% for 5 consecutive minutes, auth success below 98%, or controlled API p95 at or above 2 seconds for 5 consecutive minutes.
- Storage restore verification failure or inability to reach the accepted recovery path.

## Rollback order

1. Stop traffic broadening and record the abort timestamp/reason.
2. Disable the approved cutover flags or restore the prior Vercel deployment.
3. Do not run database rollback SQL unless its exact decision point is approved and the affected migration is classified reversible.
4. For replaced objects or irreversible/data-bearing steps, restore from the accepted database/Storage recovery point.
5. Re-run anonymous, Tenant A/B, role, and integrity probes; keep Production GO `NO` until reconciliation is signed.

## Ownership

- Owner: authorizes Production mutation and accepts final RPO/RTO and observation result.
- Database operator: applies exact migrations and owns abort/restore execution.
- Release operator: controls Vercel deployment and flags.
- QA observer: records metrics and evidence; cannot waive security abort conditions.

No Production mutation is authorized by this candidate runbook.
