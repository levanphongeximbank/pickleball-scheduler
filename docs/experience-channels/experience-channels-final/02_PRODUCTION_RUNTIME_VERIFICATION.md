# Production Runtime Verification (read-only)

## Deployment (post Owner T/R env cutover)

| Field | Value |
|-------|-------|
| Deployment | `dpl_CnzXXCMDcZN8SFa5kD5E4BDDXnDS` |
| URL | `https://pickleball-scheduler-2jxnbk9k6-pickleball-scheduler.vercel.app` |
| Target | production |
| Status | **Ready** |
| Current aliases | `pickvn.app`, `pickleball-scheduler-eight.vercel.app` |
| Bundle | `assets/index-DAe0BsM0.js` |
| Supabase host | `expuvcohlcjzvrrauvud.supabase.co` |
| `VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE` | **remote** (baked) |
| `VITE_PUBLIC_CLUBS_COURTS_SOURCE` | **remote** (baked) |

## Clubs / Courts regression

| Surface | Provenance | Result |
|---------|------------|--------|
| Clubs | LIVE | CLB ACCC |
| Courts | LIVE | Sân 3–6 |
| Portal pages | REMOTE_RPC | PASS |

## Tournaments / Rankings

| Check | Result |
|-------|--------|
| Tournament RPC | LIVE_EMPTY (0) |
| Ranking RPC | LIVE_EMPTY (0) |
| Env baked remote | YES |
| Production pages use `loadPublic*PageResult` | **NO** (still sync local getters) |
| UI empty honest / no mock | **FAIL** on current Production |
| Remote ERROR path exercised by Production pages | **NO** |

### Exact blocker

Production is serving **main** (page wiring from PR #316 not deployed). Env `remote` is baked into the bundle but `/tournaments` and `/rankings` still call sync local getters, so selector is unused.

Evidence: `PRODUCTION_DEPLOYMENT_CUTOVER.json`, `TOURNAMENTS_RUNTIME.json`, `RANKINGS_RUNTIME.json`
