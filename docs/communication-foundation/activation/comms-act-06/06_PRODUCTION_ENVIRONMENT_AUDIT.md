# COMMS-ACT-06 — Production Environment Audit

**Target Production ref:** `expuvcohlcjzvrrauvud`  
**Staging must not leak:** `qyewbxjsiiyufanzcjcq`  
**Policy:** metadata/presence only — never log or commit secret values.

## Worktree observation (2026-07-25)

| Check | Result |
|-------|--------|
| `.env` / `.env.local` / `.env.production` | ABSENT in worktree |
| `.vercel` project link | ABSENT in worktree |
| Local Production secret env binding | NOT AVAILABLE to agent (Owner-operated) |
| Secrets printed | NO |

## Required Production bindings (Owner verify)

| Binding | Env name(s) | Presence rule |
|---------|-------------|---------------|
| Supabase URL | `VITE_SUPABASE_URL` / `SUPABASE_URL` | Must contain `expuvcohlcjzvrrauvud` only |
| Anon/public key | `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Present on Production + Preview correctly separated |
| Service role | `SUPABASE_SERVICE_ROLE_KEY` | Server-only on Vercel Production; never `VITE_*` |
| System producer key | `COMMS_SYSTEM_PRODUCER_KEY` | Server-only; distinct from Staging |
| Trusted backend flag | `VITE_COMMUNICATION_TRUSTED_BACKEND` | `false` until Gate D enablement |
| Runtime mode | `VITE_COMMUNICATION_RUNTIME_MODE` | optional; kill switch → `UNAVAILABLE` |
| Production enable | `COMMS_PRODUCTION_RUNTIME_ENABLE` | **ABSENT** until ACT-07 Owner GO |

## Deploy mapping

| Surface | Expected Supabase ref |
|---------|----------------------|
| Vercel Production | `expuvcohlcjzvrrauvud` |
| Vercel Preview | `qyewbxjsiiyufanzcjcq` (Staging) — must not share Production service-role |

## Owner action (required)

1. Open Vercel Production project → Environment Variables.
2. Confirm presence (yes/no only) of rows above — do not paste values into chat/git.
3. Confirm no Staging URL/ref on Production env.
4. Confirm service-role not exposed to browser/`VITE_*`.
5. Record evidence in `evidence/OWNER_ENV_METADATA_YYYY-MM-DD.md` (presence only).

## Classification

| Item | Class |
|------|-------|
| Env metadata not Owner-verified in this worktree | `RELEASE_BLOCKER` |
| Preview vs Production separation (design) | documented; Owner confirm |
| Secret rotation readiness | `REQUIRED_BEFORE_SCALE` |
