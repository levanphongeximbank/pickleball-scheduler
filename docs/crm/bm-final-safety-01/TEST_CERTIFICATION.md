# Test Certification

## Phase B certification (before Staging mutation)

| Command | Result | Duration |
|---------|--------|----------|
| `node --test tests/crm-bm-final-safety-01-apply-authorization.test.js` | PASS 22/22 | 0.755s |
| `node --test tests/crm-phase-1h-b-staging-apply.test.js tests/crm-phase-1h-staging-readiness.test.js` | PASS 32/32 | 0.457s |
| `npm run test:unit` | PASS 6665/6665 | 24.457s |
| `npm run ci:foundation-lock` | PASS | 3.107s |
| `npm run lint:no-new` | PASS | 50.101s |
| `npm run build` | PASS | 63.348s |
| `git diff --check` | PASS | 0.05s |
| Secret scan over changed CRM safety artifacts | PASS | — |
| package.json / package-lock.json hash verification | UNCHANGED | — |

## Post-remediation recertification (after Staging grant remediation)

| Command | Result | Duration |
|---------|--------|----------|
| `node --test tests/crm-bm-final-safety-01-apply-authorization.test.js` | PASS 24/24 | 0.19s (suite) |
| `node --test tests/crm-phase-1h-b-staging-apply.test.js` | PASS 16/16 | 0.40s (suite) |
| `npm run test:unit` | PASS 6667/6667 (257 suites) | 24.715s |
| `npm run ci:foundation-lock` | PASS (ownership 0 new, competition-architecture 0 new) | 2.843s |
| `npm run lint:no-new` | PASS (0 new violations) | 54.767s |
| `npm run build` | PASS (PWA precache 457 entries) | 61.806s |
| `git diff --check` | PASS (exit 0) | — |
| Secret scan over BM-FINAL-SAFETY-01 artifacts | PASS (17 files, 0 hits) | — |
| package.json / package-lock.json hash verification | UNCHANGED | — |

Package hashes (identical before and after):

- `package.json` — `CF0361BF8FC7F4AE6AA39587AB8489F4C1D3489C04B2E980EEC8E6EB396AFE0E`
- `package-lock.json` — `844840CA58B3EADCC4A1D090ABDCFCD057B7562F48BB1450D4A8AD1A1763B448`

## Replay-rejection evidence

| Attempt | Verdict | DB writes |
|---------|---------|-----------|
| Reuse retired authorization path | `CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED` | 0 |
| Reuse `.consumed` marker | `CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REPLAYED` | 0 |
| SQL hash drift | refused before authorization / DB contact | 0 |
| No authorization | `CRM_PHASE_1H_B_BLOCKED_ONE_TIME_AUTHORIZATION_REQUIRED` | 0 |

## New tests added in this wave

- `grant remediation authorization is bound to its own operation` — a Staging
  *apply* authorization cannot unlock grant remediation; consumed remediation
  authorization is replay-rejected; unknown operations cannot be issued.
- `grant remediation SQL package stays byte-stable and DCL-only` — the approved
  SQL contains no DML, no DDL, no `GRANT`, and no Production ref in executable
  SQL.

## Notes

- Secret-scan patterns match credential-shaped *values* (JWT, `Bearer`,
  `sbp_…`, connection strings, long opaque values). A name-only pattern also
  flags `ACCESS_TOKEN: "SUPABASE_ACCESS_TOKEN"` in `phase1hBGates.js`, which is
  an env-variable *name* map and contains no secret; that hit was verified by
  inspection and is a confirmed false positive.
- Focused and adjacent CRM tests use mocked apply executors only; no test
  connects to a real database and no test mutates Staging or Production.
- Test 14 exposed a real precedence weakness (Production verdict overwritten by
  a later expiry check). The source was fixed so the Production block is
  terminal; the test expectation was not changed.
- `npm ci` was required once to restore missing `node_modules` in this worktree;
  package manifests were not modified.
