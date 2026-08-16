# Security / secret boundary

SERVICE_ROLE_SECRET_IN_CLIENT_BUNDLE=NO  
PRIVILEGED_SUPABASE_CLIENT_IMPORTED_BY_BROWSER=NO  
INTERNAL_COMMIT_RPC_DIRECT_BROWSER_CALL=NO

## Hard lock

This cutover does **not** put `SUPABASE_SERVICE_ROLE_KEY`, a service-role client, or internal commit RPC execution into the Vite/React bundle.

Browser may send authenticated user intent only (`auth.uid()` via user JWT).

Privileged internal commit RPC (`referee_v5_commit_match_transition` / finalization) remains server/Edge.

## How composition stays server-side

`createDefaultCompetitionRefereeRuntime`:

- does not read `import.meta.env`
- does not construct a Supabase client
- refuses client/Vite env bags that contain service-role keys (`assertNoClientServiceRoleEnv`)
- if `rpcClient` is supplied, rejects browser runtime (`assertServerOnlyPrivilegedRefereeComposition`)
- `createLiveRpcCanonicalRefereeDurableDriver` also rejects browser

The host (Edge / serverless / Node) injects `rpcClient` created from **server** env (`SUPABASE_SERVICE_ROLE_KEY` in Deno/Node, never `VITE_*`).

## Existing privileged boundary (reuse, not a new runtime)

`supabase/functions/referee-v5-match` already creates a service-role client from `Deno.env`. That Edge path is Referee V5 compatibility I/O, not CORE-16/17 authority for E2E-04.

This workstream does not add a new Edge function and does not deploy Staging.

Staging application-path GO (later) should host `createDefaultCompetitionRefereeRuntime` on a server/Edge process with injected service-role `rpcClient`.

## Static proof (local)

Pages, referee-v5 components/hooks, and `refereeV5EdgeClient.js` do not:

- reference `SUPABASE_SERVICE_ROLE_KEY` / `VITE_*SERVICE_ROLE` / `sb_secret_`
- import `createDefaultCompetitionRefereeRuntime`
- import `createLiveRpcCanonicalRefereeDurableDriver`
- call `referee_v5_commit_match_transition` from the Edge HTTP client

`refereeV5InternalRpcService.js` keeps the existing `typeof window !== "undefined"` internal-RPC forbidden guard.

## Canonical identity

Writes require `actor.actorId` aligned with `auth.uid`. Name/email/phone is not authority.
