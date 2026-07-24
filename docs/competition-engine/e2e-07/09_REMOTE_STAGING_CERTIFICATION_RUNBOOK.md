# E2E-07 — Remote Staging Certification Runbook

> **Marker before any remote execution:** `E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED`  
> **Status:** DEFERRED / NOT EXECUTED in this PR.  
> Local `CERTIFIED_LOCAL_MVP` does **not** require this marker as a merge blocker.

## Purpose

Document LEVEL 3 (Remote Environment) certification steps without executing them from the E2E-07 harness. Owner must grant GO before any staging or production action.

## Preconditions (Owner checklist)

- [ ] Explicit Owner GO recorded with marker `E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED`
- [ ] Target project identity verified (staging Supabase project + Vercel Preview URL)
- [ ] Backup / snapshot evidence captured for staging data
- [ ] Environment variables inventory reviewed (no secrets committed to repo)
- [ ] Migrations / schema status vs frozen CM + Core SQL docs confirmed
- [ ] Authentication identities for organizer / player / referee prepared
- [ ] Deterministic seed dataset prepared (reuse E2E-07 fixture IDs where possible)
- [ ] Rollback plan agreed

## Target project verification

1. Confirm staging project ref and region.
2. Confirm Preview deployment tracks the merge commit of this PR (or post-merge `main`).
3. Confirm RBAC / AI / mobile feature flags match staging policy (do not enable production claims).

## Environment variables (inventory only — do not commit values)

| Variable class | Examples | Notes |
|----------------|----------|-------|
| Supabase URL / anon | `VITE_SUPABASE_*` | Staging only |
| Auth redirect | Preview URL | Must match Vercel Preview |
| Feature flags | `VITE_RBAC_ENABLED`, `VITE_ENABLE_AI_ENGINE` | Match Owner staging policy |

## Migrations / schema status

1. Diff staging schema against frozen docs under `docs/supabase-*.sql` relevant to CM/Core/Identity.
2. Do **not** invent E2E-07 SQL — certification reuses existing contracts.
3. Record schema readiness evidence (checksum / migration list) in remote evidence pack.

## Authentication identities

| Role | Purpose |
|------|---------|
| Organizer / Tournament Manager | Full operational plan + publish + complete |
| Player | Check-in + schedule/standings read |
| Referee | Assigned match score + validation |
| Cashier / unrelated | Fail-closed permission deny |

## Seed dataset

Reuse deterministic fixture identities from `createIndividualPoolKnockoutScenarioFixture`:

- `tenant-e2e07`, `comp-e2e07`, `venue-e2e07`
- players `p1`…`p8`, referees `ref-1`/`ref-2`
- seed `seed-e2e07-pool-knockout`

## Execution commands (Owner-run only)

```bash
# After Owner GO — examples only; do not run from E2E-07 harness
git fetch origin --prune
git checkout <post-merge-main-or-preview-sha>
npm ci
npm run build
# Manual staging QA against Preview URL using IND Pool+KO script
```

Do **not** apply SQL, deploy, or use production secrets from this workstream automation.

## Cleanup

1. Remove staging seed competition / tenant fixtures if policy requires.
2. Revoke temporary auth users.
3. Confirm no leftover elevated grants.

## Rollback

1. Revert Preview to previous deployment.
2. Restore staging DB from pre-run backup if mutations occurred.
3. Record rollback evidence + timestamp (Owner-captured; not committed as wall-clock into local fingerprints).

## Evidence capture (remote)

Produce remote evidence alongside local pack under Owner control:

- Staging target identity
- Schema readiness
- Auth identities used (IDs only — no tokens)
- Persistence / audit storage confirmation
- Realtime status (expect disabled until runtime exists)
- Monitoring / log / trace references
- Deployment SHA
- Owner GO checkpoint artifact

## Log / trace references

Capture request IDs / correlation IDs from staging logs. Strip tokens, emails, and private profile fields before attaching to any repository evidence.

## Owner GO checkpoint

Remote certification may claim `CERTIFIED_STAGING` only when:

1. Marker `E2E_07_REMOTE_STAGING_OWNER_GO_REQUIRED` was granted
2. All checklist items above are evidenced
3. Local `CERTIFIED_LOCAL_MVP` remains true on the same commit base

`PRODUCTION_READY` remains forbidden until explicit Production GO + deployment + smoke + backup/recovery + monitoring + incident readiness + rollback + security certification exist outside E2E-07.

## Deferred checks recorded by local harness

1. **remote-staging-certification** — NOT EXECUTED
2. **production-runtime-wiring** — INT-01/02/05/09 production adapters deferred
