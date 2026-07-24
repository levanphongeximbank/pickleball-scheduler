# COMMS-07 — Staging Activation Runbook

**Status:** Persistence SQL steps **EXECUTED** in COMMS-ACT-02 (`GO_STAGING_PERSISTENCE`) — client RLS open / realtime / Production still **NOT** executed.
**Purpose:** Owner-operated Staging activation after Communication Foundation structure certification.

Do **not** apply to Production until every Staging gate passes with evidence.

Canonical SQL package: `docs/supabase-communication-comms05.sql` — Staging applied 2026-07-24; Production still blocked.

**Operational readiness package (COMMS-ACT-01):**
[`../activation/comms-act-01/01_STAGING_ACTIVATION_READINESS.md`](../activation/comms-act-01/01_STAGING_ACTIVATION_READINESS.md)
**ACT-02 certification:**
[`../activation/comms-act-02/02_STAGING_APPLY_CERTIFICATION.md`](../activation/comms-act-02/02_STAGING_APPLY_CERTIFICATION.md)
Preflight: `node scripts/communication/comms-act-01-staging-preflight.mjs --offline`

---

## 1. Preflight

- [ ] Owner GO recorded (date, approver, target project ref)
- [ ] Branch / release tag that includes COMMS-00…07 identified
- [ ] Confirm `getCommunicationActivationSnapshot()` still shows Staging gates blocked **before** apply
- [ ] Confirm Production build resolves to `UNAVAILABLE` without certified remote deps
- [ ] Confirm no Notification delivery wiring is claimed
- [ ] Confirm client RLS remains deny-all until membership mapping certified

## 2. Backup evidence

- [ ] Staging database backup / PITR evidence captured
- [ ] Backup identifier stored in activation evidence note
- [ ] Restore drill or documented recovery path referenced

## 3. Target environment verification

- [ ] Staging Supabase project URL / ref confirmed (not Production)
- [ ] Service-role credentials available only to Owner-operated apply path (never browser)
- [ ] App Staging preview env points at Staging project
- [ ] `VITE_COMMUNICATION_RUNTIME_MODE` not set to `demo` on Staging preview that should exercise production composition

## 4. SQL apply order

1. Dry-run / static validation of `docs/supabase-communication-comms05.sql`
2. Apply schema tables / constraints / indexes
3. Apply deny-all client RLS policies (fail-closed)
4. Apply helper RPCs / grants for trusted backend only
5. **Do not** enable `supabase_realtime` publication in this step

Record exact statements / migration job id in evidence.

## 5. RLS verification

- [ ] Anon / authenticated client cannot `SELECT`/`INSERT`/`UPDATE`/`DELETE` Communication tables directly
- [ ] Trusted backend adapter (injected service client) can read/write intended tables
- [ ] No permissive `USING (true)` / open tenant policies introduced

## 6. Negative authorization tests

- [ ] Unauthenticated actor denied
- [ ] Actor outside Club membership denied for Club channels
- [ ] Actor without Community access evidence denied
- [ ] Cross-tenant / cross-club conversation access denied
- [ ] UI-supplied actorId cannot override authenticated actor

## 7. Seed / smoke data strategy

- [ ] Minimal Staging seed (Direct pair, one Club channel, one Community lobby) owned by test identities
- [ ] No production user PII in seed
- [ ] Seed teardown / isolation documented

## 8. Direct smoke

- [ ] Open/resolve Direct conversation
- [ ] Send / reply / mark read
- [ ] Request accept / decline / cancel
- [ ] Block / report paths (as implemented)
- [ ] Unread badge updates without Notification inbox coupling

## 9. Club smoke

- [ ] List accessible Club channels only
- [ ] Send / pin / unpin per policy
- [ ] Suspended / removed membership reflected as deny
- [ ] Membership SoT unchanged in Club Management

## 10. Community smoke

- [ ] Lobby + topic list under tenant
- [ ] Join / leave / send / report
- [ ] Moderation actions when allowed
- [ ] Missing membership/access evidence → deny

## 11. Realtime enablement (separate gate)

Only after persistence + RLS + negative tests pass:

- [ ] Publication scope inventory finalized (conversation-scoped only)
- [ ] Table / event inventory finalized
- [ ] Authorize-before-subscribe + catch-up / reload smoke pass
- [ ] Malformed / out-of-scope events dropped
- [ ] Disable / rollback procedure rehearsed
- [ ] Flip `REALTIME_ACTIVATION_READY` only with Owner GO

## 12. Disable / rollback procedure

1. Disable realtime publication (if enabled)
2. Revoke temporary grants if any
3. Restore deny-all client policies if altered
4. Restore DB from backup if schema apply is unsafe
5. Force app runtime to `UNAVAILABLE` / deactivate Staging feature flag
6. Capture incident note

## 13. Evidence capture

Store:

- Approver + timestamps
- Backup id
- Apply job / SQL checksum
- RLS negative test output
- Direct / Club / Community smoke results
- Realtime decision (enabled / deferred)
- Explicit statement that Production remains BLOCKED

## 14. Production promotion gate

Production may proceed **only when**:

- [ ] All Staging sections 1–13 complete with evidence
- [ ] Client RLS membership mapping certified
- [ ] Realtime decision recorded (enabled with rollback OR deferred)
- [ ] Owner Production GO recorded
- [ ] Production backup + apply order mirrored from Staging
- [ ] Communication runtime `PRODUCTION` mode certified with injected trusted client

Until then: **Production = BLOCKED**.
