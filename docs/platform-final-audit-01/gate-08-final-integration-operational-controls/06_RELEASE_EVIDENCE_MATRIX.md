# Gate 8 — Release Evidence Matrix

**Baseline SHA:** `1c595fc73ee405e626f46373fe465c8bed338314`  
**Environments:** repo / CI / Vercel Production / Supabase Production (read evidence only)

| Control ID | Requirement | Evidence source | SHA / project / env | Result | Severity | Owner | Next action | Release impact |
|------------|-------------|-----------------|---------------------|--------|----------|-------|-------------|----------------|
| REL-CLUBS-RLS-01 | Clubs RLS Production remediation complete | `docs/clubs-rls-remediation-01/**` + PR #319 | Prod `expuvcohlcjzvrrauvud`; main `1c595fc7` | PASS | — | Security/Owner | None | Unblocks prior Gate 7 security blocker |
| REL-BACKUP-01 | Scheduled backups active | Owner dashboard evidence | Prod project | PASS | — | Owner | Keep 7-day retention monitored | Residual daily RPO |
| REL-RESTORE-01 | Restore drill 01 completed | Owner recovery decision | Drill `shxzwppmgttwtwswdhouh` | PASS | — | Owner | Optional drill 02 later | Accepted gaps remain |
| REL-PITR-01 | PITR posture known | Owner cost decision | Prod | EXCEPTION | MED | Owner | Revisit cost or accept | Accepted residual risk |
| REL-STORAGE-01 | Storage object recovery | Owner + Supabase backup model | Prod Storage | EXCEPTION / GAP | MED | Owner | Separate Storage backup plan | Accepted residual risk |
| REL-LIVE-SHA-01 | Live Production SHA parity with main tip | GitHub Deployments `5620947038` | SHA `1c595fc7` | PASS | — | Platform | Re-check after next merge | Required for Gate 9 |
| REL-CATALOG-01 | Public catalog data counts posture | PC-02 post-merge + Clubs/Courts LIVE | Prod RPCs | PASS | — | Portal | Tournaments/Rankings remain LIVE_EMPTY until data publication | Honest empty OK |
| REL-RPC-01 | Public RPC posture (allowlist / SECURITY DEFINER) | PC tests + Clubs post-apply catalog checks | Prod + unit tests | PASS | — | Portal/Security | Keep contract tests | |
| REL-SVCROLE-01 | Service-role not in browser trust path | Architecture + secret pattern review | Source/tests | PASS_WITH_REVIEW | LOW | Security | Keep CI secret hygiene | Env values unread |
| REL-RBAC-01 | RBAC effective Production value | Code default + unit tests; Vercel env unread | Prod env | GAP | MED | Owner | Confirm `VITE_RBAC_ENABLED` in Vercel | Gate 9 condition candidate |
| REL-ENV-01 | Production env values readable for audit | Agent boundaries — no Vercel env read | Prod | GAP | MED | Owner | Provide redacted env inventory | Gate 9 condition candidate |
| REL-LOCK-01 | package/lock integrity | SHA256 hashes; no dirty diff | `1c595fc7` | PASS | — | Engineering | Preserve lockfile discipline | |
| REL-CI-01 | CI / verify on tip | GitHub check-runs + Vercel status | `1c595fc7` | PASS | — | Engineering | Gate 8 PR CI must pass | |
| REL-BUILD-01 | Production build | `npm run build` local Gate 8 | worktree | PASS | — | Engineering | | |
| REL-TRACE-01 | Gate 1–7 audit package on main | Repo search | main | GAP | HIGH | Audit/Owner | Reconstruct or accept missing lineage docs | Gate 9 must address before final GO narrative |
| REL-REC-EX-01 | Recovery exceptions preserved | Gate 8 register | Owner decision | EXCEPTION | MED | Owner | Do not silent-close | Visible in Gate 9 |

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_8_RELEASE_EVIDENCE_MATRIX_RECORDED`
