# Tournament Remediation Plan

**Status:** IMPLEMENTATION-READY (not implemented)  
**Audit date:** 2026-08-05  
**Commit-gate correction:** 2026-08-05 — WP1–WP8 reorder  
**Production GO:** NO  
**Production mutations:** 0  

## Explicit sequencing rules

| Rule | Statement |
|------|-----------|
| HIDING_THE_MISSING_TENANT_BANNER_IS_NOT_A_VALID_FIRST_REMEDIATION | Clearing or hiding the missing-tenant / pairing-scope banner is **not** a valid first remediation step. |
| LOCAL_BROWSER_TOURNAMENT_PRESERVATION_PRECEDES_RUNTIME_CHANGES | Owner browser-local tournament objects must be inventoried, exported, checksummed, and verified **before** any runtime, route, or cloud authority changes. |
| PRODUCTION_DATA_MIGRATION_REQUIRES_SEPARATE_OWNER_GO | Any Production write that migrates or reconciles local-only tournaments into cloud tables requires a **separate** Owner Production mutation GO. Audit Production GO remains NO. |

**Live evidence:** Owner tournament IDs absent from Production cloud; ACCC `tenant_id=venue-prod-main`; proven localStorage key `pickleball-club-data-v3::{clubId}`.

---

## Work-package order (mandatory)

### WP1 — PRESERVE AND EXPORT BROWSER-LOCAL TOURNAMENTS

| Field | Content |
|-------|---------|
| **Findings addressed** | All three Owner IDs classified `LOCAL_BROWSER_ONLY_OBJECT`; risk of silent loss if browser storage cleared or deploy changes persistence before export. |
| **Files likely affected** | Export tooling / Owner runbook only (no Production runtime change required in WP1). Evidence under `docs/v5/qa-evidence/tournament-production-remediation/`. |
| **Database objects** | None (read/export of browser localStorage only). |
| **Production mutation requirement** | NO |
| **Dependency** | None — **first** work package. |
| **Risks** | Incomplete export; Owner clears storage before checksum; export misses referee/schedule/draw payloads. |
| **Rollback** | Retain pre-export local blob copies; do not clear browser storage. |
| **Tests** | Export completeness checklist; SHA-256 of export archives; ID inventory match for three Owner tournaments. |
| **Acceptance criteria** | Inventory of three Owner local tournament objects complete; full local payload preserved (definitions, participants, teams, settings, referee data, schedules, draws, results, related identifiers); checksum + rollback copy established; browser storage **not** cleared; Owner-assisted export procedure documented; migration **prohibited** until export verification passes. |
| **Owner GO requirement** | Owner assists export/verification; no Production mutation GO. |

### WP2 — ESTABLISH CLOUD TOURNAMENT DURABLE AUTHORITY

| Field | Content |
|-------|---------|
| **Findings addressed** | Production durable tournament records for Owner IDs = 0; localStorage acting as Production SSOT. |
| **Files likely affected** | Tournament services, cloud sync adapters, club blob writers/readers (`src/domain/clubStorage.js`, tournament feature services). |
| **Database objects** | Canonical cloud tables/RPCs (e.g. `club_data_v3` and/or dedicated tournament tables); ownership columns `tenant_id`, `club_id`, `venue_id`. |
| **Production mutation requirement** | Schema/RPC only with separate Owner GO; no Owner local-ID migration in WP2. |
| **Dependency** | WP1 export verified. |
| **Risks** | Dual SSOT during transition; wrong ownership mapping (`default-tenant`). |
| **Rollback** | Feature-flag cloud authority off; retain local export from WP1. |
| **Tests** | Reload persistence; cross-device read of cloud-backed tournament; tenant/club/venue ownership assertions. |
| **Acceptance criteria** | Canonical cloud tables/RPCs/services selected; tenant_id/club_id/venue_id ownership defined; one durable writer authority; one durable reader authority; localStorage removed as Production SSOT; reload and cross-device persistence required. |
| **Owner GO requirement** | Staging GO for authority cutover; Production schema GO separate if needed. |

### WP3 — MIGRATE OR RECONCILE EXISTING LOCAL-ONLY TOURNAMENTS

| Field | Content |
|-------|---------|
| **Findings addressed** | Three Owner local-only tournaments must land in durable cloud without data loss or duplicates. |
| **Files likely affected** | Migration/reconciliation scripts or Owner-assisted import paths (constrained; not audit package). |
| **Database objects** | Target durable tournament tables/RPCs from WP2. |
| **Production mutation requirement** | YES — **separate Owner Production mutation GO** required. |
| **Dependency** | WP1 verified export; WP2 durable authority live on staging (and Production only after GO). |
| **Risks** | ID collision; partial migrate; relationship loss; premature Production write. |
| **Rollback** | Reconciliation evidence + reverse mapping from dry-run artifacts; restore from WP1 export. |
| **Tests** | Dry-run validation; duplicate prevention; post-migrate relationship integrity. |
| **Acceptance criteria** | Local IDs mapped to canonical cloud IDs; business data and relationships preserved; duplicate prevention; dry-run validation; separate Production mutation GO; rollback and reconciliation evidence defined. |
| **Owner GO requirement** | PRODUCTION_DATA_MIGRATION_REQUIRES_SEPARATE_OWNER_GO |

### WP4 — PROPAGATE TENANT, CLUB AND VENUE SCOPE

| Field | Content |
|-------|---------|
| **Findings addressed** | TP-UI-001, TP-UI-002, TP-UI-003 (missing/invalid tenant scope; `default-tenant` ambiguity). |
| **Files likely affected** | `DailyPlaySetup.jsx`, `InternalTournamentSetup.jsx`, `OfficialTournamentSetup.jsx`, `useTournamentEngine.js`, scope resolvers, `prepareLivePrivatePairingOptions` call sites. |
| **Database objects** | Scope validation on RPCs/mutations (tenant_id/club_id/venue_id). |
| **Production mutation requirement** | App deploy only after staging; no data migrate in WP4. |
| **Dependency** | WP2 (and WP3 if migrating live Owner objects first). |
| **Risks** | Hiding banner without real scope; UI/backend disagree. |
| **Rollback** | Revert app deploy; restore prior resolvers. |
| **Tests** | Scope unit/integration; fail-closed when scope missing; ACCC `venue-prod-main` path. |
| **Acceptance criteria** | tenantId/clubId/venueId propagated through Daily, Internal, Official, Team flows; default-tenant ambiguity removed; UI and backend scope validation agree; mutation controls disabled before valid scope exists. |
| **Owner GO requirement** | Staging certification GO before Production app deploy. |

### WP5 — ELIMINATE DUAL WRITERS AND DUAL READERS

| Field | Content |
|-------|---------|
| **Findings addressed** | 3 dual-writer conflicts (DW-01..DW-03); 4 dual-reader conflicts; 3 localStorage/mock/fallback Production authorities (LMF-01..LMF-03). |
| **Files likely affected** | Tournament writers/readers, Engine 4.0 services, mock/fallback adapters. |
| **Database objects** | Single writer/reader paths against durable authority from WP2. |
| **Production mutation requirement** | App/RPC only; no Owner ID migrate in WP5. |
| **Dependency** | WP2; preferably WP4. |
| **Risks** | Compatibility break for unread adapters. |
| **Rollback** | Re-enable explicit compatibility adapters behind flags. |
| **Tests** | Dual-writer/reader conflict matrix regression to zero. |
| **Acceptance criteria** | 3 dual-writer conflicts resolved (DW-01..DW-03); 4 dual-reader conflicts resolved; Production localStorage/mock/fallback authorities LMF-01..LMF-03 removed or constrained to explicit adapters; compatibility only via explicit adapters. |
| **Owner GO requirement** | Staging GO; Production app deploy GO. |

### WP6 — CONTROLLED LEGACY ROUTE MIGRATION

| Field | Content |
|-------|---------|
| **Findings addressed** | TP-UI-004; LEGACY_ACTIVE_RUNTIME; dual menus. |
| **Files likely affected** | `src/router.jsx`, `src/config/tournamentRoutes.js`, redirect shim components. |
| **Database objects** | None required. |
| **Production mutation requirement** | App deploy only. |
| **Dependency** | WP4–WP5 dependency proof that canonical `/tournaments/:id/*` can serve same authority. |
| **Risks** | Broken deep links; dual active menus. |
| **Rollback** | Disable redirect; serve legacy routes temporarily. |
| **Tests** | Redirect preserves IDs, query params, deep links, public links. |
| **Acceptance criteria** | Canonical family `/tournaments/:id/*`; legacy `/tournament/*` controlled redirects only after dependency proof; IDs/query/deep/public links preserved; independent legacy runtime authority removed; dual active menus prevented. |
| **Owner GO requirement** | Staging e2e GO; Production deploy GO. |

### WP7 — COMPLETE RBAC AND TENANT ISOLATION

| Field | Content |
|-------|---------|
| **Findings addressed** | Cross-tenant / unauthorized read-write risks; frontend-only guards insufficient. |
| **Files likely affected** | Identity/RBAC guards, tournament access asserts, RLS/RPC policies. |
| **Database objects** | RLS policies / RPCs enforcing tenant isolation. |
| **Production mutation requirement** | SQL/policy apply requires separate Owner GO. |
| **Dependency** | WP2, WP4. |
| **Risks** | Over-lock SUPER_ADMIN; under-lock cross-tenant. |
| **Rollback** | Revert policy migration; restore prior RLS. |
| **Tests** | SUPER_ADMIN, CLUB_OWNER, CLUB_MANAGER, REFEREE, PLAYER; cross-tenant denial; unauthorized R/W denial; backend enforcement independent of frontend. |
| **Acceptance criteria** | Role matrix covered; cross-tenant denial; unauthorized read/write denial; backend enforcement independent of frontend guards. |
| **Owner GO requirement** | Staging + Production policy GO. |

### WP8 — PRODUCTION-SAFE ROLLOUT AND ROLLBACK

| Field | Content |
|-------|---------|
| **Findings addressed** | Controlled Production cutover without data loss. |
| **Files likely affected** | Deploy config, runbooks, evidence packages. |
| **Database objects** | As authorized by prior WPs. |
| **Production mutation requirement** | Only after separate Owner GOs for each mutation class. |
| **Dependency** | WP1–WP7 acceptance. |
| **Risks** | Partial rollout; unverified persistence. |
| **Rollback** | See `TOURNAMENT_ROLLBACK_PLAN.md` (same WP order). |
| **Tests** | Post-deploy persistence; cross-browser; forward-fix gates. |
| **Acceptance criteria** | Local tournament export verified; cloud migration dry-run verified; separate Owner Production mutation GO; constrained deployment; post-deploy persistence verification; cross-browser verification; rollback and forward-fix conditions defined. |
| **Owner GO requirement** | Explicit Production deploy GO + any mutation GOs. |

---

## Out of scope (this workstream until GO)

- Production SQL apply during audit
- Production deploy during audit
- Gender normalization schema migration (TP-UI-005 dependency only)
- Hiding the missing-tenant banner as a standalone fix

## Success criteria (program)

- WP1 export verified before any runtime change
- Cloud durable authority is Production SSOT (WP2+)
- Owner local tournaments migrated only under separate mutation GO (WP3)
- TP-UI-001–004 not reproducible on staging after WP4–WP6
- RBAC isolation proven (WP7)
- Rollout/rollback evidence complete (WP8)
