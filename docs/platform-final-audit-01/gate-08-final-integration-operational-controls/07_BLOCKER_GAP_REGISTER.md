# Gate 8 — Blocker / Gap Register

## Security remediation (prior Gate 7)

| ID | Item | Status | Severity |
|----|------|--------|----------|
| B-CLUBS-RLS-01 | Authenticated cross-tenant clubs SELECT via `status='active'` | **RESOLVED** (PR #318 Staging, PR #319 Production) | Was HIGH |

## Open gaps (Gate 8)

| ID | Item | Status | Severity | Release impact |
|----|------|--------|----------|----------------|
| B-AUDIT-TRACEABILITY-01 | `docs/platform-final-audit-01/gate-01`…`gate-07` missing on main | OPEN GAP | HIGH | Gate 9 cannot cite committed Gate 1–7 packages; Owner claim only |
| B-RBAC-ENV-01 | Effective Production `VITE_RBAC_ENABLED` unread | OPEN GAP | MED | Condition for release decision |
| B-ENV-INVENTORY-01 | Production env values unread by agent | OPEN GAP | MED | Condition for release decision |
| B-MONITORING-01 | Platform IR monitoring SSOT not PASS in-repo | OPEN GAP | MED | Operational gap |
| B-IR-ROSTER-01 | Live incident contact roster not in-repo | OPEN GAP | LOW | Owner-maintained offline |

## Accepted exceptions (not blockers; must remain visible)

| ID | Item | Status |
|----|------|--------|
| EX-PITR-01 | PITR not enabled | ACCEPTED |
| EX-DRILL-01 | Older snapshot used for drill 01 | ACCEPTED |
| EX-SCHEMA-01 | Latest Public Catalog schema recoverability not verified | ACCEPTED |
| EX-RLS-REC-01 | Latest Clubs RLS remediation recoverability not verified on drill | ACCEPTED |
| EX-STORAGE-01 | Storage objects not in DB backups | ACCEPTED |
| EX-RPO-01 | RPO up to daily backup interval | ACCEPTED |
| EX-DRILL02-01 | Restore drill 02 deferred | DEFERRED |

## Release blockers declared by Gate 8?

**None newly declared as hard stop** beyond unresolved HIGH traceability gap treated as Gate 9 precondition for final GO narrative — not a Gate 8 execution blocker for completing operational/release evidence package.

Security blocker from Gate 7 is resolved.

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_8_BLOCKER_GAP_REGISTER_RECORDED`
