# Phase 7 Production Execution Package Checklist — NOT AUTHORIZED

This is a decision-audit checklist only. It contains no authorization to connect, apply SQL, deploy, change environment/flags/traffic/domain, or run rollback.

## Stop gate before any Production access

- [ ] Owner confirms target project ref `expuvcohlcjzvrrauvud` and repository SHA.
- [ ] Credential exists only in a gitignored local file, is not printed, and is least-privilege read-only.
- [ ] Connector and every query are technically enforced read-only; `read_only=false` is forbidden.
- [ ] Operator records `PRODUCTION_PREFLIGHT_ACCESS=0` before the first connection.
- [ ] Stop immediately on target ambiguity, write capability, missing credential hygiene, or secret exposure.

Current result: `PRODUCTION_PREFLIGHT_NOT_ATTEMPTED`.

## Required accepted package order

1. Freeze target SHA, package hashes, operators, communication channel and maintenance/canary window.
2. Verify current backup timestamp, restore target, Storage recovery path, RPO/RTO acceptance and prior healthy deployment.
3. Perform the approved read-only Production migration/catalog/schema/RLS/RBAC/ACL/publication/tenant preflight.
4. Compare the result to the exact M0–M11 expected delta; stop before the first DDL on any unexplained drift.
5. Confirm environment names/values, flags OFF/fail-closed, canonical domain/CORS and monitoring metadata without changing them.
6. Obtain separate Owner GO bound to target, SHA, checksums, operators and window.
7. Only under that future authorization, follow the exact manifest order with verification after every step and per-step rollback/restore decision points.
8. Use the named canary scope; run anon-negative, Tenant A/B, role, integrity and runtime probes.
9. Observe the accepted 30-minute window; broaden only if every threshold passes.
10. Retain immutable timestamps, migration IDs, hashes, metric snapshots, operator decisions and communication events.

## Package completeness review

- [x] Canonical ordered migration ledger and checksums exist.
- [x] Source provenance and evidence binding exist.
- [x] Rollback/restore classifications and abort thresholds exist.
- [x] Stop-before-first-DDL control exists.
- [x] Canary and post-deploy verification plan exist.
- [ ] Current read-only Production catalog preflight exists.
- [ ] Every verification boundary is an exact tracked artifact; M2 currently requires Owner/manual catalog verification.
- [ ] One final target-bound execution sequence is accepted by all operators.
- [ ] Current operator assignments and communication plan are signed.
- [ ] Current monitoring/alert routes are demonstrated.
- [ ] No untracked dependency is required.
- [x] Repository secret scan found no credential after candidate review.

## Abort triggers

Abort before mutation for any target/SHA/hash mismatch, unexpected catalog delta, missing backup/recovery prerequisite, credential/tool write capability, missing operator, hidden manual step, or absent Owner GO. During a future authorized canary, use the security, integrity, 5xx, auth, latency, transaction and recovery thresholds in `docs/v6/PHASE6_CANARY_MONITORING_ABORT_RUNBOOK.md`.

```text
PRODUCTION_GO=NO
NO_DEPLOY=YES
NO_SQL_APPLY=YES
```
