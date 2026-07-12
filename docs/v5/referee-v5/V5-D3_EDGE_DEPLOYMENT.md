# V5-D.3 — Edge Deployment

**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Production ref:** `expuvcohlcjzvrrauvud` (not targeted)

---

## Architecture choice

**Single Edge Function:** `referee-v5-match` with action router.

| Action | Purpose |
|--------|---------|
| `get-state` | Load match snapshot + recent events |
| `apply-command` | V5-B engine + atomic commit RPC |
| `finalize` | Finalize + outbox |

**Reason:** Shared JWT verification, shared error model, shared `RefereeV5EdgeCommandHandler` — simpler than three separate functions.

---

## Files

| File | Role |
|------|------|
| `src/features/referee-v5/server/edgeEntry.js` | Bundle entry |
| `src/features/referee-v5/server/edgeHttpHandler.js` | HTTP router + auth |
| `src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js` | DB reads (service role) |
| `src/features/referee-v5/persistence/RefereeV5RpcAtomicCommitService.js` | Single commit RPC |
| `supabase/functions/referee-v5-match/index.ts` | Deno entry |
| `scripts/bundle-referee-v5-edge-shared.mjs` | esbuild bundle |
| `scripts/deploy-referee-v5-edge-staging.mjs` | Staging deploy |

---

## Deploy command

```bash
# Requires SUPABASE_ACCESS_TOKEN (not committed)
node scripts/bundle-referee-v5-edge-shared.mjs
node scripts/deploy-referee-v5-edge-staging.mjs
```

---

## Status

| Step | Status |
|------|--------|
| Bundle script | **READY** — `refereeV5Server.mjs` builds |
| Deploy script | **READY** |
| Edge deployed | **PENDING** — `SUPABASE_ACCESS_TOKEN: MISSING` locally; HTTP probe returns 404 |
| JWT server verify | **IMPLEMENTED** — `auth.getUser()` in handler |

---

## Secrets (no values logged)

```
SUPABASE_ACCESS_TOKEN: MISSING (local shell)
SUPABASE_SERVICE_ROLE_KEY: CONFIGURED (.env.staging-qa.local)
```

Service role key is used only in Edge Function runtime secrets (Supabase dashboard), not in frontend.
