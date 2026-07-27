# PROD-OPS-24H-01 — Production Deployment Parity

## Verdict

```text
SOURCE_TO_PRODUCTION_PARITY=PASS
```

Fresh `origin/main` SHA equals live Production deployment SHA.

## Comparison

| Source | SHA |
|--------|-----|
| Fresh `origin/main` | `edca457748be3ef3a160b68076a69535b2ab6e3f` |
| GitHub Production deploy `5625433697` | `edca457748be3ef3a160b68076a69535b2ab6e3f` |
| Prior Gate 10 observed deploy (pre-merge tip) | `5624421605` → `e78bb8b6116049b58590e6243d89eb519ea71463` |

## Evidence sources

- `git fetch origin main` + `git rev-parse origin/main`
- GitHub Deployments API (`environment=Production`)
- `npx vercel ls` Production list (Ready)
- `npx vercel inspect` on `pickleball-scheduler-6aj80ow4e-…` → aliases include `pickvn.app`

## Post–Gate 10 change ledger (Production deploys)

| When (UTC) | Deploy ID | SHA (12) | Notes |
|------------|-----------|----------|-------|
| 2026-07-27T15:44:11Z | `5625433697` | `edca457748be` | Gate 10 merge auto-deploy — **current live** |
| 2026-07-27T14:41:22Z | `5624421605` | `e78bb8b61160` | Gate 9 tip (Gate 10 baseline) |
| 2026-07-27T13:08:22Z | `5622952921` | `4c72d4541c7f` | Gate 8 merge era |
| 2026-07-27T10:33:19Z | `5620947038` | `1c595fc73ee4` | Clubs RLS Production cert merge |

Agent of PROD-OPS-24H-01 initiated **no** Production deploy.

## Env / config readability

| Item | Status |
|------|--------|
| Vercel Production env **values** | **UNREADABLE** to this audit (`RC-ENV-01` preserved) |
| Effective `VITE_RBAC_ENABLED` | **NOT_VERIFIED** independently (`RC-RBAC-01` preserved) |
| Code default when unset in PROD build | `isRbacEnabledFromEnv()` returns `import.meta.env.PROD === true` — **code default only; not proof of live effective value** |

## Marker

`PROD_OPS_24H_01_PRODUCTION_DEPLOYMENT_PARITY_RECORDED`
