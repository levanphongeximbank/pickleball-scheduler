# CC-10 Stage 1 — Environment Verification

## Staging identity (verified)

| Item | Value | Verified |
|---|---|---|
| Staging Supabase project ref | `qyewbxjsiiyufanzcjcq` | MCP staging server + `.env.staging-qa.local` URL host |
| Production Supabase | Separate project | **Not used** |
| Staging Vercel preview URL (reference) | `pickleball-scheduler-tt6-realtime-sync-8oeaq3xk6.vercel.app` | From local QA env file only |
| Target branch | `feature/competition-core-standardization` | Documented |
| Service-role credentials | Staging ref embedded in JWT `ref` claim | Confirmed staging-only |

## Production safety

- Production project ref: **not accessed**
- Production flags: **OFF / NOT CHANGED**
- Production deploy: **NOT PERFORMED**

## Tooling gaps (deployment blocker)

| Tool | Status |
|---|---|
| Vercel CLI | Not installed on agent host |
| `gh` CLI | Not installed |
| Vercel API token | Not available in integration worktree |

**Result:** Staging Vercel environment variables could not be positively mutated from this agent session. Shadow matrix executed locally against the same adapter code paths with `SHADOW_ENV` injection.

## Database prerequisites (Rating V2)

Verified on staging project `qyewbxjsiiyufanzcjcq` via MCP `execute_sql`:

| Prerequisite | Status |
|---|---|
| `player_ratings` | EXISTS |
| `rating_history` | EXISTS |
| `rating_applications` | EXISTS |
| Indexes | 10 on rating tables |
| RLS policies | 4 on rating tables |
| `competition_core_apply_match_rating_v2` RPC | EXISTS |

**Rating V2 shadow flag:** eligible when Staging deploy applies flags; live browser rating cases deferred until Preview deploy.
