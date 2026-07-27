# Production Runtime Verification (read-only)

## Domains

- `https://pickvn.app` and public routes → HTTP 200
- `https://pickleball-scheduler-eight.vercel.app` and public routes → HTTP 200
- Bundle host: `expuvcohlcjzvrrauvud.supabase.co` (staging host count = 0)

## Clubs / Courts

| Surface | Provenance | Result |
|---------|------------|--------|
| Clubs RPC | LIVE | 1 row — **CLB ACCC** (`clb-accc`) |
| Courts RPC | LIVE | 4 rows — **Sân 3–6** |
| Portal pages | REMOTE_RPC | no mock fallback |

## Tournaments / Rankings

| Surface | Provenance | Result |
|---------|------------|--------|
| Tournaments RPC | LIVE_EMPTY | 0 rows |
| Rankings RPC | LIVE_EMPTY | 0 rows |
| Remote adapters | Ready | PC-02 |
| Independent selector | `VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE` | default `local` |
| Page loaders | Wired in this PR | honor selector |

Production env for T/R remote was **not** changed (no Owner GO). LIVE + EMPTY is valid for source readiness.

## Security probes (read-only)

- Anon EXECUTE on public list RPCs: allowed
- Anon SELECT on projection tables: denied
- Anon mutation: denied
- Invalid limit → `INVALID_PAGINATION`
- Invalid sort → `INVALID_SORT`

Evidence: `evidence/CLUBS_RUNTIME.json`, `COURTS_RUNTIME.json`, `TOURNAMENTS_RUNTIME.json`, `RANKINGS_RUNTIME.json`, `PUBLIC_ROUTES_SMOKE.json`
