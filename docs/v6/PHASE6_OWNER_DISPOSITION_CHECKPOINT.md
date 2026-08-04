# Phase 6 Owner disposition checkpoint

Production GO remains `NO`. This checkpoint accepts readiness observations and
the pre-cutover stop conditions; it does **not** authorize Production mutation.

## Evidence now closed

- Canonical M0–M11 / M9 / TT5D provenance and checksum gates pass.
- Staging Security Advisor ERROR = 0.
- Staging mutable-search-path and broad-policy warnings = 0.
- Anonymous `SECURITY DEFINER` exposure reduced from 204 to the exact seven
  tested public/token-scoped overloads; pseudo-`PUBLIC` exposure = 0.
- Authenticated Tenant A/B isolation regression passes.
- Production REST/Storage read-only preflight passes with one expected M9 table
  delta and zero anonymous visibility in all present protected tables.
- Fresh-namespace Storage restore and independent verify pass; measured and
  Owner-accepted RTO = 6.656 seconds; temporary keys revoked.
- Dependency audit reduced from six HIGH to two reports sharing one React Router
  RSC-only advisory; this Vite SPA contains no RSC/SSR/server-action runtime.
- Canary/monitoring/abort thresholds are defined.

## Observations requiring Owner disposition

1. Seven intentional anonymous RPC Advisor WARNs remain as the exact allowlist.
2. 271 authenticated `SECURITY DEFINER` WARNs remain; authenticated RPC execution
   is architectural and is controlled by function authorization plus role/tenant
   QA. This is not permission for future unreviewed RPC exposure.
3. The React Router RSC advisory remains until a stable fixed release exists;
   RSC/SSR/server actions must stay disabled.
4. Production lacks `team_tournament_referee_correction_requests`; this is the
   expected pre-cutover M9 delta, not permission to apply it yet.
5. Direct Production `pg_catalog` inventory is deferred to the mandatory
   stop-before-mutation gate. Any mismatch aborts before the first DDL statement.
6. The two cutover flags and canonical-domain/CORS reconciliation are mandatory
   deployment steps, initially OFF/fail-closed until their runbook gate.
7. Supabase leaked-password protection remains a dashboard WARN and must be
   enabled before broad traffic, or retained as an explicitly accepted
   post-cutover observation.

## Acceptance text

To accept these dispositions and the canary/abort runbook without authorizing
Production mutation, Owner must send exactly:

`OWNER ACCEPT — PHASE6 READINESS OBSERVATIONS AND PRE-CUTOVER STOP GATES; PRODUCTION GO REMAINS NO`

After acceptance, canonical reconciliation may issue
`PHASE6_READINESS_PASS_WITH_OBSERVATIONS`. A separate later checkpoint is still
required for any Production mutation.

