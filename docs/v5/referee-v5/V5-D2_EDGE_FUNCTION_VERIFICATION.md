# V5-D.2 — Edge Function Verification

**Staging ref:** `qyewbxjsiiyufanzcjcq`

---

## Planned functions

| Function | Route | Purpose |
|----------|-------|---------|
| `referee-v5-get-match-state` | GET/POST state | Read via verified JWT |
| `referee-v5-apply-command` | POST command | V5-B engine + commit RPC |
| `referee-v5-finalize` | POST finalize | Finalize + outbox |

---

## Trust boundary requirements

| Requirement | Implementation status |
|-------------|----------------------|
| Read Authorization bearer | `edgeEntry.js` + Deno handlers (draft) |
| Verify user via Auth server (`getUser`) | `verifyBearerToken` in `edgeEntry.js` |
| Derive `actor_id` from verified user | ✅ Designed |
| Reject body `actor_id` / `tenant_id` | `rejectClientIdentityFields` |
| Load assignment from DB | Repository draft |
| Run V5-B engine | `RefereeV5EdgeCommandHandler` |
| Single atomic commit RPC | `commitTransitionViaRpc` |
| No token logging | Code review PASS |
| Service role only in Edge secrets | ✅ |

---

## Deploy status

| Step | Status |
|------|--------|
| Bundle script `scripts/bundle-referee-v5-edge-shared.mjs` | ✅ Added |
| Shared bundle `supabase/functions/_shared/refereeV5Server.mjs` | ⏸ Run bundle before deploy |
| Deploy script | ⏸ `deploy-referee-v5-edge-staging.mjs` — follow `deploy-v5b1e-edge-staging.mjs` pattern |
| Management API deploy | **NOT PERFORMED** — `SUPABASE_ACCESS_TOKEN` missing locally |
| JWT verification HTTP test | **NOT PERFORMED** |

---

## Verdict

| Gate | Status |
|------|--------|
| Edge JWT verification | **P1** — deploy blocked |
| Edge bundle ready | **PARTIAL** |
| Production deploy | **NOT PERFORMED** |

---

## Next step

```bash
export SUPABASE_ACCESS_TOKEN=...   # staging PAT
node scripts/bundle-referee-v5-edge-shared.mjs
node scripts/deploy-referee-v5-edge-staging.mjs
node scripts/verify-phase-v5d2-edge-http-staging.mjs
```
