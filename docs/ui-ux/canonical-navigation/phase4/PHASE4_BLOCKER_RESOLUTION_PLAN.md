# Phase 4 Blocker Resolution Plan

**Program:** PICK_VN Canonical Navigation  
**Phase:** 4 — Blocker resolution planning (read-only)  
**HEAD:** `6ece104677ec1db4ba1b19bc666a1a41ac2c2a93`  
**Branch:** `feature/canonical-navigation-phase4-runtime-cutover`  
**Prior verdict:** `CANONICAL_NAVIGATION_PHASE4_READY_WITH_BLOCKERS`  
**This verdict:** `CANONICAL_NAVIGATION_PHASE4_BLOCKER_RESOLUTION_PLAN_READY_FOR_OWNER_DECISIONS`

Machine-readable twin: [`PHASE4_BLOCKER_RESOLUTION_PLAN.json`](./PHASE4_BLOCKER_RESOLUTION_PLAN.json)  
Owner package: [`PHASE4_OWNER_DECISION_PACKAGE.md`](./PHASE4_OWNER_DECISION_PACKAGE.md)  
Authz matrix: [`PHASE4_TOURNAMENT_AUTHZ_PARITY_MATRIX.md`](./PHASE4_TOURNAMENT_AUTHZ_PARITY_MATRIX.md)

No runtime code, guards, redirects, or tests were modified in this task.

---

## BLK-B01-SEMANTIC — Messages vs CRM

### Equivalence

| Dimension | `/messages` | `/crm/messages` |
|-----------|-------------|-----------------|
| Handler | `MessagingExperiencePage` | `CrmMessagesPage` |
| Purpose | COMMS inbox (direct/club/community) | CRM outreach draft/send-local records |
| Target users | Messaging users via COMMS runtime | Club/venue customer-care / booking staff |
| Permissions | `[]` (no page PermissionGate) | `booking.view` \| `customer.view` + page gate |
| Data | COMMS gateway / `communication_*` intent | `localStorage` per `clubId` |
| Writes | send/reply, moderation, membership | draft, mark-sent-local, contact history |
| Message types | Conversational threads | SMS/Zalo/Email CRM records (not externally delivered) |
| Nav (flag ON) | Excluded (B01) | Canonical sole “messages” authority today |
| Nav (flag OFF) | V5 “Tin nhắn” leaf | V5 CRM group |
| Flags | `VITE_COMMUNICATION_RUNTIME_MODE` | `VITE_PLATFORM_HARD_CUTOVER` (local authority) |
| Tests | COMMS-06/07 + UI messaging | CRM foundation / finance-crm / hard-cutover |

**Functional + RBAC equivalence proven:** **NO**

### Recommended owner decision

**A — Keep both as separate canonical business functions**

- Reject **B** (alias) — equivalence not proven  
- Reject **C** in Phase 4 — CRM retirement needs a migration program; retiring COMMS is unacceptable  

See **OD-B01-MESSAGES**.

---

## BLK-B02-NO-MAP — 42-route decision matrix

`/tournament/entry-fee` excluded (already within-legacy alias → `/tournament/config/fee`).

| Metric | Count |
|--------|------:|
| Total unresolved routes | **42** |
| Safely mappable to plural Engine | **0** |
| Disposition `retain` | **42** |
| Disposition `redirect` | **0** |
| Disposition `unresolved` | **0** |

Full matrix (path, component, params, permission, writers, workflow, plural proof, `tournamentId` safety, disposition) is in JSON `B02.matrix`.

### Compact matrix

| Legacy path | Component | Params | Permission | Disposition |
|-------------|-----------|--------|------------|-------------|
| `/tournament` | TournamentShell | — | tournament.view | retain |
| `/tournament/list` | TournamentListPage | — | tournament.view | retain |
| `/tournament/create` | TournamentCreatePage | — | tournament.create | retain |
| `/tournament/types` | TournamentTypesHubPage | — | tournament.view | retain |
| `/tournament/types/:category` | TournamentTypePage | category | tournament.view | retain |
| `/tournament/roster` | TournamentRosterHubPage | — | tournament.view | retain |
| `/tournament/organize` | TournamentOrganizeHubPage | — | tournament.view | retain |
| `/tournament/operations` | TournamentOperationsHubPage | — | tournament.view | retain |
| `/tournament/results` | TournamentResultsHubPage | — | tournament.view | retain |
| `/tournament/config` | TournamentConfigHubPage | — | tournament.view | retain |
| `/tournament/register` | TournamentRegisterHub | — | tournament.view\|update | retain |
| `/tournament/my` | IndividualPlayerPortalPage | — | tournament.view | retain |
| `/tournament/my/:tournamentId` | IndividualPlayerPortalPage | tournamentId* | tournament.view | retain |
| `/tournament/:tournamentId/public` | IndividualTournamentPublicPage | tournamentId* | tournament.view | retain |
| `/tournament/:tournamentId/register` | IndividualRegistrationPage | tournamentId* | tournament.view | retain |
| `/tournament/bracket` | TournamentBracketHub | — | tournament.view | retain |
| `/tournament/teams` | TournamentTeamsHub | — | tournament.view | retain |
| `/tournament/teams/presets` | TournamentTeamPresetsHub | — | tournament.view | retain |
| `/tournament/teams/build/manual` | TournamentTeamBuildManualHub | — | tournament.view | retain |
| `/tournament/teams/build/random` | TournamentTeamBuildRandomHub | — | tournament.view | retain |
| `/tournament/teams/build/draft` | TournamentTeamBuildDraftHub | — | tournament.view | retain |
| `/tournament/schedule` | TournamentScheduleHub | — | tournament.view\|director.use | retain |
| `/tournament/match-reports` | TournamentMatchReportsHub | — | tournament.view | retain |
| `/tournament/config/format` | TournamentConfigFormatHub | — | tournament.update\|view | retain |
| `/tournament/config/settings` | TournamentConfigSettingsHub | — | tournament.update\|view | retain |
| `/tournament/config/age-rules` | TournamentAgeRulesPage | — | tournament.view | retain |
| `/tournament/config/gender-rules` | TournamentGenderRulesPage | — | tournament.view | retain |
| `/tournament/config/fee` | TournamentFeePage | — | tournament.view | retain |
| `/tournament/config/regulations` | TournamentRegulationsPage | — | tournament.view | retain |
| `/tournament/eligibility` | TournamentTeamEligibilityHub | — | tournament.view | retain |
| `/tournament/eligibility/check` | TournamentEligibilityPage | query? | tournament.view | retain |
| `/tournament/publish-schedule` | TournamentPublishSchedulePage | query? | tournament.view | retain |
| `/tournament/referee-assign` | TournamentRefereeAssignPage | — | tournament.view | retain |
| `/tournament/awards` | TournamentAwardsPage | query? | tournament.view | retain |
| `/tournament/withdrawal` | TournamentWithdrawalPage | query? | tournament.view | retain |
| `/tournament/daily/:tournamentId` | DailyPlaySetup | tournamentId* | tournament.view | retain |
| `/tournament/internal/:tournamentId` | InternalTournamentSetup | tournamentId* | tournament.view | retain |
| `/tournament/internal/:tournamentId/bracket` | TournamentBracketPage | tournamentId* | tournament.view | retain |
| `/tournament/official/:tournamentId` | OfficialTournamentSetup | tournamentId* | tournament.view | retain |
| `/tournament/official/:tournamentId/bracket` | TournamentBracketPage | tournamentId* | tournament.view | retain |
| `/tournament/team/:tournamentId` | TeamTournamentSetup | tournamentId* | tournament.view | retain |
| `/tournament/director/:tournamentId` | TournamentDirectorMode | tournamentId* | director.use\|tournament.update | retain |

\* `tournamentId` present only as syntactic path param — **not** a proven semantic redirect to Engine tabs.

See **OD-B02-TOURNAMENT-RETAIN**.

---

## BLK-B03-GUARD — `/player/skill-assessment-v5`

| Field | Current |
|-------|---------|
| Router guard | None (direct page) |
| authGuard | Authenticated-only |
| Permissions | `[]` |
| Feature flag | `VITE_PICK_VN_RATING_V5_ENABLED` (page-checked; default OFF) |
| Page gate | `resolveRatingV5Access` (flag + rollout + pilot enrollment) |
| Legacy menu | PLAYER leaf when V5 flag ON |
| Writes | Yes — assessment completion RPC |
| B03 text | SUPER_ADMIN direct access only |
| V5 product | PLAYER pilot self-assessment |

**Conflict:** Phase 1 B03 text vs V5 PLAYER pilot contract.

### Recommended target authorization policy

> Hide from all menus/search/mobile writers in every shell. Route access: authenticated AND (`SUPER_ADMIN`/`PLATFORM_ADMIN` OR (`PLAYER` AND flag ON AND active pilot enrollment)). Flag alone must never add a menu leaf. Others → 403. No redirect.

See **OD-B03-V5-SHADOW-AUTHZ**.

---

## BLK-PLURAL-AUTHZ — summary

| Metric | Value |
|--------|------:|
| Plural Engine routes audited | **7** |
| Authorization parity PASS | **0** |
| Authorization parity GAP | **7** |

All seven `/tournaments/:tournamentId/{engine,seed,draw,schedule,courts,ranking,logs}` routes are **weaker** than legacy `/tournament/*` because:

1. `/tournaments` public-auth prefix makes descendants public-auth  
2. No `menuAccess` matcher for `/tournaments/:id/*`  
3. No route-level tenant/ownership check before engine load  
4. Page gate `tournament.update` runs only after hook construction  

Public catalog `/tournaments` remains intentionally public (excluded from Engine parity).

See [`PHASE4_TOURNAMENT_AUTHZ_PARITY_MATRIX.md`](./PHASE4_TOURNAMENT_AUTHZ_PARITY_MATRIX.md) and **OD-PLURAL-AUTHZ-PARITY**.

---

## Owner decisions required

**4** — OD-B01-MESSAGES, OD-B02-TOURNAMENT-RETAIN, OD-B03-V5-SHADOW-AUTHZ, OD-PLURAL-AUTHZ-PARITY

Blockers remain open until Owner approves.

---

## Implementation plan (after Owner decisions)

### Order

1. Record owner decisions in docs  
2. Authz hardening (`authGuard` + `menuAccess` plural + B03 policy)  
3. B01 dual-canonical registry/menu/search (if OD-B01 = A)  
4. Optional Engine breadcrumb/back writer hygiene (no B02 redirects)  
5. Phase 4 tests  
6. Preview verification; **Production flag remains OFF**

### Proposed runtime files (11)

- `src/auth/authGuard.js`  
- `src/auth/menuAccess.js`  
- `src/config/navigationConfig.js`  
- `src/config/v5Menu/messagingMenu.js`  
- `src/features/canonical-shell/config/ownerDecisions.js`  
- `src/features/canonical-shell/config/canonicalMenuData.js`  
- `src/features/canonical-shell/config/canonicalRouteCatalog.js`  
- `src/features/canonical-shell/services/filterCanonicalMenu.js`  
- `src/features/canonical-shell/services/buildCanonicalSearchIndex.js`  
- `src/pages/tournament/TournamentEnginePage.jsx`  
- `src/router.jsx`  

### Proposed test files (4)

- `tests/canonical-shell-phase4-b01-dual-canonical.test.js`  
- `tests/canonical-shell-phase4-b03-guard.test.js`  
- `tests/canonical-shell-phase4-tournament-authz.test.js`  
- `tests/ui/canonical-shell-phase4-a11y.ui.test.jsx`  

### Proposed documentation files (4)

- `docs/ui-ux/canonical-navigation/phase4/PHASE4_OWNER_DECISIONS_RECORDED.md`  
- `docs/ui-ux/canonical-navigation/phase4/PHASE4_IMPLEMENTATION_REPORT.md`  
- `docs/ui-ux/canonical-navigation/LEGACY_ROUTE_DISPOSITION.md`  
- `docs/ui-ux/canonical-navigation/CANONICAL_ROUTE_INVENTORY.md`  

### Commit boundaries

1. Docs: owner decisions recorded  
2. Plural authz + B03 policy  
3. B01 dual-canonical registry/menu/search  
4. Tests + implementation report  

### Rollback

- Production: `VITE_CANONICAL_APP_SHELL_ENABLED` stays OFF  
- Preview: flag OFF restores legacy shell  
- Authz commits revert independently if needed  

---

## Production safety

| Check | Value |
|-------|------:|
| Production mutations | **0** |
| SQL execution | **0** |
| Deployments | **0** |
| Production feature flag changes | **0** |
| Commit / push / PR | **NO** |
