# 00 — Current state audit

Workstream: Canonical Competition Adapter Contracts 14 (foundation + architecture freeze).

Baseline:

- `FRESH_ORIGIN_MAIN_SHA` recorded at start of this workstream from `git fetch origin --prune` + `git rev-parse origin/main`
- Branch: `feat/competition-canonical-adapters-14-foundation-01`
- Worktree: `C:\Users\Le Phong\PICK_VN-Workstreams\competition-canonical-adapters-14-foundation-01`
- Court PR #432 is **already merged on origin/main**. This workstream catalogs it and does not modify it.
- Referee PR #431 is merged. This workstream references it and does not modify it.

No Staging or Production mutation. No SQL authored.

## Classification legend

Exactly one per domain:

- `EXISTING_CANONICAL_CAPABILITY` — authoritative module + Competition-facing adapter already exist
- `EXISTING_PARTIAL_CAPABILITY` — domain exists; Competition adapter incomplete or not default-wired
- `CONTRACT_ONLY_NO_RUNTIME` — freeze semantics only; do not invent runtime
- `EXTERNAL_FUTURE_CAPABILITY` — outside current product runtime

## 01 Identity & Access — EXISTING_CANONICAL_CAPABILITY

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/identity/` (roles, permission matrix, auth flows) |
| B Public API | `src/features/identity/index.js` |
| C Competition integration | `integration/adapters/identityEvidenceFromIdentityAdapter.js` → CORE-02 |
| D Persistence | `public.profiles`, `public.roles`, `audit_logs` |
| E Tenant | Caller `scope.tenantId`; fail-closed; no ambient tenant |
| F Identity keys | `auth.uid` / `profiles.id`; role via `normalizeRole` |
| G Tests | identity phase B/C tests; E2E-01 identity cases (file exists) |
| H Tournament coupling | `publishScheduleEngine.js` / `publishDrawEngine.js` import identity audit/permissions directly |
| I Legacy | `src/auth/permissions.js` re-export; DB `VENUE_*` aliases |
| J Readiness | CE adapter implemented. RBAC still flag-gated |

## 02 Tenant & Organization — EXISTING_PARTIAL_CAPABILITY

| Item | Evidence |
| --- | --- |
| A Authority | Tenant: `src/features/tenant/`. Organization: **no module** |
| B Public API | `listTenants`, `resolveEffectiveTenantId`, `assertSameTenant`, `guardTenantAccess` |
| C Competition integration | `requireTenantId` / `assertTenantIsolation` only. No tenant adapter before this freeze |
| D Persistence | Local venue registry `pickleball-venues-v1`; profile-backed hydrate |
| E Tenant/org | Historical `tenantId === venueId` in `src/models/tenant.js`. Platform Core does **not** equate them |
| F Identity keys | `tenant.id`. `organizationId` optional on some competition scopes only |
| G Tests | `tests/tenant*.test.js`, club-context tenant projection tests |
| H Tournament coupling | Pages use club/tenant gates; no org adapter |
| I Legacy | `venueId` still accepted as tenant id in `normalizeTenant` |
| J Readiness | Tenant runtime exists. Distinct organization authority: **NOT_CONFIGURED** |

## 03 Participant — EXISTING_CANONICAL_CAPABILITY

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/player/` + CORE participants |
| B Public API | `getPlayerProfile`, `resolveCanonicalPlayerId` |
| C Competition integration | `playerParticipantLookupAdapter.js` |
| D Persistence | `profiles.player_id`, `player_identity_links`; canonical repo flag default OFF |
| E Tenant | Mapping evaluates tenant/club scope |
| F Identity keys | Canonical `player_id`. Display name is not identity |
| G Tests | player-management + CORE participants tests |
| H Tournament coupling | Limited; format modules do not own player internals |
| I Legacy | `DERIVED` resolution still exists in Phase 1B |
| J Readiness | Lookup adapter implemented |

## 04 Club / Team / Membership — EXISTING_CANONICAL_CAPABILITY (membership); team roster NOT_CONFIGURED in CE adapter

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/club/` |
| B Public API | club members / governance / membership reads |
| C Competition integration | `membershipStatusFromClubAdapter.js` |
| D Persistence | `clubs`, `club_members`; blob `club_data_v3`; V2 flag default OFF |
| E Tenant | Clubs filtered by `tenantId`. `organizationId` is not a club substitute |
| F Identity keys | `club.id` + `user_id` |
| G Tests | club-v3 / governance / active-membership |
| H Tournament coupling | `clubTournamentBridge.js` used by Team Portal pages |
| I Legacy | blob + local cache dual path |
| J Readiness | Membership adapter implemented. Team identity/roster/captain are Team Tournament engine concerns — **not duplicated here** |

## 05 Rating — EXISTING_PARTIAL_CAPABILITY

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/player-rating/foundation/` (not production-wired) + Pick-VN / V5 stacks |
| B Public API | snapshot / current-state ports |
| C Competition integration | `rankingRatingSnapshotFromRatingAdapter.js` (read-only). Default CE composition injects rating only if `deps.rating` provided |
| D Persistence | multiple local stores + RPC; CORE blob rating still exists |
| E Tenant | foundation requires explicit rating scope |
| F Identity keys | canonical player id |
| G Tests | player-rating-foundation + CORE rating tests |
| H Tournament coupling | registration rating panels |
| I Legacy | assessment store, Pick-VN, V5, CORE blob |
| J Readiness | Adapter exists; default DI **NOT_CONFIGURED** |

## 06 Ranking — EXISTING_PARTIAL_CAPABILITY

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/vpr-ranking/` (separate from Rating) |
| B Public API | VPR calculation, leaderboard, certification |
| C Competition integration | Inventory INT-06 PARTIAL. **No ranking adapter file** before this freeze |
| D Persistence | VPR local store + RPCs |
| E Tenant | certification resolves tenant from club |
| F Identity keys | VPR athlete links (not `player_id`) |
| G Tests | `vpr-*.test.js` |
| H Tournament coupling | Team setup VPR panel; admin ranking pages import local store |
| I Legacy | local vs RPC dual path |
| J Readiness | CE ranking adapter: **NOT_CONFIGURED** |

## 09 Finance & Payment — CONTRACT_ONLY_NO_RUNTIME (Competition-facing)

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/finance/` + `src/features/payments/` + billing/subscription |
| B Public API | finance contracts; payment gateways; `createFinanceRuntime` default **disabled** |
| C Competition integration | CORE `paymentStatusPort` null → `{ status: "UNKNOWN", requirementMet: false }`. No CE finance adapter file before this freeze |
| D Persistence | finance SQL authored; runtime default DISABLED |
| E Tenant | explicit tenantResolver when runtime exists |
| F Identity keys | obligation/invoice/payment ids |
| G Tests | finance-phase-* |
| H Tournament coupling | none to finance ledger |
| I Legacy | three stacks (finance / payments / billing) |
| J Readiness | Competition binding **NOT_CONFIGURED**. Do not invent a processor |

## 10 Notification & Communication — EXISTING_PARTIAL_CAPABILITY

| Item | Evidence |
| --- | --- |
| A Authority | `src/features/notifications/` (messaging `src/features/communication/` is separate) |
| B Public API | `emitNotificationEvent`, `emitMatchScheduledFromBoundary` |
| C Competition integration | one-way MATCH_SCHEDULED boundary. No CE notification port in runtime bag |
| D Persistence | notification inbox/jobs; communication SQL not applied |
| E Tenant | emit requires `tenantId` |
| F Identity keys | idempotency = tenant + eventType + entityId + version |
| G Tests | notification-phase-* |
| H Tournament coupling | schedule publish bridge |
| I Legacy | CRM localStorage messages classified compatibility-only |
| J Readiness | MATCH_SCHEDULED bound. Other competition events **CAPABILITY_NOT_SUPPORTED** |

## 11 File & Media — CONTRACT_ONLY_NO_RUNTIME

No dedicated file/media domain. Avatars, news media refs, comms FileStoragePort, reporting ArtifactStoragePort, broadcast VOD are scattered and not a Competition adapter. CORE-22 is package import/export, not media storage.

**PRODUCTION_BINDING=NOT_CONFIGURED**

## 12 Streaming & Scoreboard — EXISTING_PARTIAL_CAPABILITY (product UI); CE port NOT_CONFIGURED

Broadcast: `src/features/tournament-broadcast/`. Scoreboard is referee UI, not scoring authority. No CE streaming port. This adapter must not write canonical scores.

**PRODUCTION_BINDING=NOT_CONFIGURED**

## 13 Federation & External Authority — CONTRACT_ONLY_NO_RUNTIME

`src/features/ecosystem-integrations/` has descriptors, `wiredToProductionRuntime: false`, `hasRealProviders: false`. DUPR is a label, not a live federation.

**PRODUCTION_BINDING=NOT_CONFIGURED**

## 14 CRM & Sponsor — CONTRACT_ONLY_NO_RUNTIME (Competition-facing)

CRM module exists (`src/features/crm/`) with memory default; no CE CRM port. Sponsor marks deferred in CM. Do not expose sensitive CRM storage through Competition.

**PRODUCTION_BINDING=NOT_CONFIGURED**

## 15 Analytics & Reporting — EXISTING_PARTIAL_CAPABILITY (module); CE adapter NOT_CONFIGURED

Intelligence-analytics and reporting-analytics are derived views. They must not feed numbers back as canonical match truth. No CE analytics adapter before this freeze.

**PRODUCTION_BINDING=NOT_CONFIGURED**

## 16 Audit — EXISTING_PARTIAL_CAPABILITY; CE adapter NOT_CONFIGURED

Two authorities: Identity `auditService` / `audit_logs`, and CORE-20 in-memory competition audit. Tournament publish engines call identity audit directly. CE composition does not inject an audit sink. This freeze does not silently drop or replace those paths.

**PRODUCTION_BINDING=NOT_CONFIGURED**

## Court (07) and Referee (08) — not owned here

- Court: `Competition Court Adapter Contract` version `1` at `src/features/competition-core/contracts/competitionCourtAdapterContract.js` (PR #432 merged on main)
- Referee: `competition.referee.adapter.v1` version `1.0.0` under `integration/referee/` (PR #431)

## Existing CE integration bag (`createCompetitionRuntimePorts`)

Wired: identity evidence, membership (if club deps), player lookup, rating snapshot **only if injected**, venue/court eligibility/descriptors.

Not in that bag: ranking, finance, CRM, notification, file/media, streaming, federation, analytics, audit, organization.

This workstream does **not** change that runtime bag. It freezes contracts and compatibility bindings beside it.
