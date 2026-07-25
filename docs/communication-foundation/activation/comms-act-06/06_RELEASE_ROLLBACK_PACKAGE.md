# COMMS-ACT-06 — Release & Rollback Package (ACT-07 plan)

## Gate A — Exact release binding

| Binding | Value source |
|---------|--------------|
| Exact git commit | Merge tip of ACT-06 PR after Owner review |
| Exact SQL hashes | SHA256 of COMMS-05 + ACT-03 forward/rollback (LF canonical) |
| Exact deployment artifact | Vercel Production deployment id at roll time |
| Exact capability scope | DIRECT / SYSTEM / CLUB_SELECT / CLUB_WRITE only |
| Exact Production ref | `expuvcohlcjzvrrauvud` |

## Gate B — Fresh Production backup

1. Run out-of-repo ACT-07 Production backup script
2. Manifest PASS + ZIP SHA256
3. Spot-check restore readability (roles/schema headers)
4. Owner evidence recorded

## Gate C — Production preflight (read-only)

- Schema/catalog via readonly script
- Environment presence (no secret values)
- Host = Vercel `api/communication`
- Secrets presence
- Monitoring / kill switch readiness
- Rollback SQL + deploy path ready

## Gate D — Controlled rollout (separate Owner GOs)

| Step | Mutation class | Owner GO (exact) |
|------|----------------|------------------|
| D1 Schema/RLS apply (if absent) | SQL apply | `OWNER GO COMMS-ACT-07 PRODUCTION SCHEMA_APPLY_ONLY` |
| D2 Runtime deploy | Vercel Production deploy | `OWNER GO COMMS-ACT-07 PRODUCTION DEPLOY_ONLY` |
| D3 Environment enablement | Env flags + `COMMS_PRODUCTION_RUNTIME_ENABLE` | `OWNER GO COMMS-ACT-07 PRODUCTION ENABLE` |
| D4 Smoke certification | Temporary smoke writes | `OWNER GO COMMS-ACT-07 PRODUCTION SMOKE_ONLY` |
| D5 Cleanup | Delete smoke markers | included in D4 GO or `... CLEANUP_ONLY` |
| D6 Read-only final verify | none | no GO required |

Do **not** use one vague GO for all mutation classes.

## Gate E — Rollback triggers

Stop / rollback if any:

- Schema apply failure
- Runtime health failure
- Authorization regression
- Secret/config mismatch / Staging leakage
- Data integrity risk
- Client write exposure
- Unexpected realtime enablement

## Kill switch

1. Remove `COMMS_PRODUCTION_RUNTIME_ENABLE`
2. Set `VITE_COMMUNICATION_TRUSTED_BACKEND=false`
3. Optional `VITE_COMMUNICATION_RUNTIME_MODE=UNAVAILABLE`
4. Redeploy prior artifact if needed
