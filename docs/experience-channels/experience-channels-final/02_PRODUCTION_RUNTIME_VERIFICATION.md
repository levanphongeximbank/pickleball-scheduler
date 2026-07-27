# Production Runtime Verification (post-merge)

## Deployment

| Field | Value |
|-------|-------|
| Merge commit | `9f176bfd` (PR #316) |
| Deployment | `dpl_CmPS8eFSiZ4U3vARqQBAT851BibU` |
| Status | **Ready** + Current |
| Aliases | `pickvn.app`, `pickleball-scheduler-eight.vercel.app` |
| Bundle | `assets/index-CuKsi_FE.js` |
| `VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE` | **remote** |
| Supabase host | `expuvcohlcjzvrrauvud.supabase.co` |

## Tournaments / Rankings (Production UI)

| Check | Result |
|-------|--------|
| Pages use async `loadPublic*PageResult` | YES (`useEffect` + `.then`) |
| Env remote honored | YES |
| RPC | LIVE_EMPTY (0 rows) |
| UI empty honest / no mock | YES |
| Remote ERROR path | ERROR without mock (unit + code path) |
| Retry | caller-controlled |

## Clubs / Courts regression

- Clubs LIVE — CLB ACCC
- Courts LIVE — Sân 3–6
