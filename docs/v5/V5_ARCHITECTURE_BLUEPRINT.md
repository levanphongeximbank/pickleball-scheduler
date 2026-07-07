# Pickleball Scheduler Pro v5.0 — Architecture Blueprint

Status: Phase 0 complete. No production rollout. No new feature implementation yet.

## 1. Objective

Build v5 as a controlled SaaS platform re-architecture that preserves v4 as a stable baseline. The target is a multi-tenant, production-ready platform for clubs, venues, players, courts, booking, tournament, payments, analytics, mobile, and AI.

This document is the required Phase 0 gate before Phase 1 begins.

---

## 2. Current state of v4

### 2.1 What is already strong

- React + Vite + MUI app is already functional and builds successfully.
- The codebase has a mature set of business features: players, courts, bookings, tournaments, statistics, mobile routes, referee flows, and AI assistant modules.
- There is already a partial multi-tenant foundation under src/features/tenant/ and identity modules.
- The project contains several newer feature modules that can be reused as migration seams:
  - src/features/tenant/
  - src/features/tournament-engine/
  - src/features/mobile/
  - src/features/ai-assistant/
  - src/features/identity/
  - src/features/subscription/

### 2.2 Current architecture reality

v4 is not a single clean architecture. It is a mature but layered evolution:

- Core pages live under src/pages/ and are still the main UI surface.
- Feature modules are added in parallel and not always fully integrated into one canonical architecture.
- Domain/data logic is split across src/domain/, src/models/, src/data/, src/context/, and features.
- Persistence is mostly local-first and storage-driven, with club blobs and localStorage as the dominant mechanism.
- Auth, RBAC, tenant, and subscription logic are present but still partially layered and not fully production-safe by default.

### 2.3 Validation baseline from this audit

- Build: npm run build passed.
- Lint: npm run lint currently reports 1 error and 111 warnings.
- Test suite: repository contains a large test suite, but Phase 0 does not require a full green test run before documentation. The next phase should establish a controlled regression gate.

---

## 3. Main architectural issues in v4

### 3.1 Domain fragmentation

The app mixes several business representations for the same concepts:

- tenant vs venue
- club vs venue
- ~~court ownership and club ownership~~ → **resolved in** [`CLUB_GOVERNANCE_SPEC.md`](./CLUB_GOVERNANCE_SPEC.md) (Chủ sở hữu / Chủ tịch / Phó chủ tịch CLB; quyền chủ sân theo `ownerUserId`)
- role names and aliases
- tournament models in legacy and modern folders

This creates ambiguity and makes cross-module behavior hard to reason about.

### 3.2 Storage model is still local-first and implicit

The current persistence model is heavily centered on club blobs and localStorage keys. This is suitable for a product prototype or local MVP, but it is not sufficient for a true SaaS platform with secure multi-tenant data boundaries.

### 3.3 RBAC and tenancy are present but not yet platform-default

RBAC exists, but enforcement is still conditional and not the default production posture. The current implementation in src/auth/rbac.js and src/context/AuthContext.jsx relies on runtime flags and still allows fallback behavior when RBAC is disabled.

### 3.4 Routing and page structure are still monolithic

src/router.jsx contains a large route map, and many page components remain large and feature-rich. This makes the app harder to evolve without carrying accidental dependencies.

### 3.5 Engine logic is partially separated but still coupled to legacy flows

The tournament engine and court engine have newer feature-module implementations, but they still coexist with legacy engine paths. The migration needs a single canonical engine layer.

### 3.6 Mobile and AI are additive, not platform-native

Mobile/PWA, QR, notification, and AI features are present, but they are not yet treated as part of a unified product architecture with clear tenant data boundaries and feature flags.

### 3.7 Duplicate code and dependency crossing

There is overlap between:

- src/pages/ and src/features/
- src/legacy/ and active pages
- old tournament logic and the newer tournament-engine module
- tenant-aware guards and older club storage assumptions

This increases maintenance cost and makes migration risky.

---

## 4. Modules to keep as-is or preserve

These modules should be preserved because they already provide working product value and are suitable for reuse in v5:

| Area | Recommendation | Notes |
|---|---|---|
| Tournament subsystem | Keep and refactor | Existing tournament concepts are mature and valuable. |
| Court booking concepts | Keep and refactor | Court workflows are already well developed. |
| Tenant foundation | Keep and harden | Multi-tenant seams already exist. |
| Identity module | Keep and refactor | Roles/permissions/audit foundations are already present. |
| Mobile feature module | Keep and refactor | PWA, QR, offline, and notifications are already in place. |
| AI assistant module | Keep and refactor | AI suggestions already exist but should be feature-flagged and isolated. |
| Subscription foundation | Keep and refactor | Trial/plan logic already exists and should evolve into full SaaS billing. |

---

## 5. Modules to refactor

These modules should stay but need architectural cleanup before v5:

| Module | Why refactor |
|---|---|
| src/domain/clubStorage.js | It is central but currently mixes normalization, migration, storage, and tenant stamping concerns. |
| src/context/AuthContext.jsx | Auth and RBAC should become a more explicit platform core. |
| src/context/TenantContext.jsx | Tenant resolution and switching should be standardized around one canonical tenant contract. |
| src/context/ClubContext.jsx | Club visibility and tenant partitioning need clearer ownership boundaries. |
| src/router.jsx | Route structure should move to a modular route layer with permission guards. |
| src/auth/rbac.js | RBAC should be enforced by default and use canonical role/permission definitions. |
| src/features/tournament-engine/ | Should become the single engine layer for tournament operations. |
| src/features/mobile/ | Should become a true mobile product shell, not only responsive UI. |
| src/features/identity/ | Should become the canonical identity and audit service layer. |

---

## 6. Modules to rewrite for v5

These should be rebuilt rather than patched in place:

| Module | Rationale |
|---|---|
| Data persistence layer | Current storage model is too implicit and not SaaS-safe. |
| Tenant-aware domain model | Need a single canonical tenant, venue, club, and user model. |
| Auth/RBAC/RLS layer | Production security must be foundational rather than optional. |
| Page-level monoliths | Large page components should be replaced by module-based UI shells. |
| Core business services | Service layer should own all business operations, not pages and components. |
| Event/audit/notification layer | Required for operational traceability and future analytics. |

---

## 7. Major risks during migration

1. Breaking existing v4 workflows while refactoring the core storage and auth stack.
2. Cross-tenant leakage if the tenancy model is not enforced consistently.
3. Data migration risk from localStorage and legacy club blobs to a new schema.
4. Overlapping naming conventions such as tenant/venue/club aliases causing hidden inconsistencies.
5. Large bundle size and page complexity increasing the difficulty of migrating UI modules safely.
6. AI and mobile features becoming ungoverned if they are implemented without tenant-scoped access controls.
7. Feature flag sprawl if v5 introduces new capabilities without a clear platform boundary.

---

## 8. Proposed v5 architecture

### 8.1 Target architecture principles

- Preserve v4 as the stable product baseline.
- Introduce v5 as a new platform architecture, not a patch over v4.
- Use a canonical domain language across the stack.
- Treat tenant as the first-class security and data boundary.
- Keep UI thin and delegate business logic to services and engines.
- Keep AI as an optional assist layer, not a core dependency.
- Make mobile, payments, and notifications first-class platform services.

### 8.2 Target folder structure

```text
src/
  app/
  core/
  modules/
  shared/
  layouts/
  routes/
  services/
  stores/
```

### 8.3 Platform layers

1. App shell
2. Core platform services
3. Domain services
4. Engine layer
5. UI modules
6. Feature modules

### 8.4 Architectural contract

- Pages should not own business logic.
- Components should not call persistence directly.
- Engines should be pure and testable.
- Services should own validation, persistence, and orchestration.
- UI should only consume services and view models.

---

## 9. Database strategy for v5

### 9.1 Database direction

The v5 database should be a proper relational or relational-friendly platform with:

- tenant_id on all tenant-scoped business tables
- created_at / updated_at on all tables
- deleted_at for soft delete where needed
- foreign keys and integrity constraints
- explicit indexes for common lookups
- seed data for roles, permissions, plans, and sample tenants

### 9.2 Recommended data domains

- tenants
- venues
- clubs
- users
- roles
- permissions
- subscriptions
- bookings
- courts
- players
- tournaments
- leagues
- matches
- payments
- notifications
- audit_logs
- events
- settings

### 9.3 Database rules

- No tenant-scoped data without tenant_id.
- No orphan business records without explicit ownership.
- No production RLS bypass.
- No mock security policy in production.

### 9.4 Migration strategy

- Phase 1 should define the schema contract.
- Phase 2 should define canonical domain mappings.
- Phase 3 should implement migration SQL and staging tests.
- Migration from v4 must be explicit, reversible, and audited.

---

## 10. RBAC / RLS strategy for v5

### 10.1 Target roles

The platform should standardize the following minimum roles:

1. SUPER_ADMIN
2. TENANT_OWNER
3. VENUE_MANAGER
4. CLUB_OWNER
5. STAFF
6. CASHIER
7. REFEREE
8. PLAYER

### 10.2 Target behavior

- RBAC is enabled by default in production.
- All tenant-scoped access is restricted by tenant_id.
- Users cannot read or write another tenant’s data.
- Every important action is logged to audit logs.
- The identity layer becomes the single source of truth for roles and permissions.

### 10.3 RLS policy model

- Row-level security should be applied at the data access layer.
- Policies should be tenant-aware and role-aware.
- The app should not rely on client-side filtering as the only protection.

---

## 11. Frontend strategy for v5

### 11.1 Frontend principles

- Replace page monoliths with module-oriented shells.
- Make dashboards the entry point for most users.
- Use permission-based navigation and route guards.
- Separate UI state from business state.
- Keep responsive and mobile-first design as a product requirement, not an afterthought.

### 11.2 UI architecture

- App shell for global navigation and bootstrap
- Auth layout for login, password, and auth recovery
- Dashboard layout for owner/manager views
- Mobile layout for player, staff, and referee flows
- Protected routes and permission-aware menus

### 11.3 Frontend migration approach

- Keep existing v4 routes stable during the transition.
- Move feature logic into services and hooks gradually.
- Introduce new module folders and migrate one domain at a time.

---

## 12. Engine layer strategy for v5

### 12.1 Canonical engine boundaries

v5 should formalize the following engine families:

- Tournament Engine
- Court Engine
- League Engine
- Ranking Engine
- Billing Engine
- AI Engine

### 12.2 Engine contract

Every engine should expose:

- input contract
- output contract
- validator
- service wrapper
- test suite
- explicit error handling

### 12.3 UI rule

UI components should not contain engine logic. UI should call services and engines, not implement business logic inline.

---

## 13. Mobile strategy for v5

### 13.1 Mobile scope

Mobile should be treated as a first-class product experience, not just responsive UI.

Required flows:

- PWA installation and offline-first behavior
- QR check-in
- push notification
- role-based mobile screens
- referee scoreboard
- player shell
- owner dashboard
- staff booking screen

### 13.2 Mobile architecture

- Dedicated mobile shell and navigation
- Platform-aware forms and touch targets
- Offline queue with safe reconciliation
- Tenant-scoped data access
- Explicit sync strategy when connectivity returns

---

## 14. AI strategy for v5

### 14.1 AI posture

AI must remain an optional advisory layer. It should not bypass core system rules or write protected data without confirmation.

### 14.2 Required AI modules

- AI Tournament Designer
- AI Court Scheduler
- AI Pairing Assistant
- AI Time Predictor
- AI Revenue Advisor
- AI Risk Detector
- AI Rule Advisor

### 14.3 AI controls

- Each module must have a feature flag.
- AI must be tenant-scoped and explain its outputs.
- AI logs should be separate from production operational logs.
- AI should be disabled-safe; core system operation must continue without it.

---

## 15. Commercial SaaS strategy for v5

### 15.1 Commercial scope

v5 should support:

- tenant onboarding
- plan selection and trial
- subscription lifecycle
- billing events
- invoice and payment hooks
- plan limits
- lockout / grace rules
- owner self-service management

### 15.2 SaaS rules

- Tenant state must be explicit and audited.
- Plan limits must be enforced by service layer.
- Expired subscriptions must have predictable business behavior.
- Billing changes should be logged with event history.

---

## 16. Release strategy

### 16.1 Release gates

v5 should only move to staging and production after:

- architecture blueprint approval
- Phase 1 core platform completion
- migration tests pass
- RBAC and RLS verification complete
- staging checklist passed
- regression coverage established

### 16.2 Recommended branch strategy

- Keep v4 stable on the current main line.
- Create a dedicated branch for v5 work, for example v5-platform-edition, before Phase 1.
- Do not merge v5 into production until staging acceptance is complete.

---

## 17. Detailed Phase plan

### Phase 0 — Discovery and audit
- Complete architecture audit
- Document current gaps and migration risks
- Produce the blueprint and phase checklist

### Phase 1 — Core platform
- Canonical tenant, venue, user, role, permission, subscription, audit, notification, and setting model
- Standardize tenant_id and UUID / text contract
- Implement seed roles and permissions
- Turn on production-safe RBAC defaults
- Define RLS policy matrix

### Phase 2 — Domain redesign
- Create canonical domain model and naming rules
- Separate entity, DTO, service input, service output, and UI view model
- Define business rules and module ownership

### Phase 3 — Database v5
- Introduce canonical schema
- Implement migrations, seed SQL, RLS, indexes, and rollback strategy
- Validate migration from v4 to v5 in staging

### Phase 4 — Frontend architecture
- Introduce app/core/modules/shared structure
- Replace page monoliths with module-based shells
- Add permission-based navigation and route protection

### Phase 5 — Engine layer
- Formalize tournament, court, league, ranking, billing, and AI engines
- Isolate them from UI and define service contracts

### Phase 6 — Event system
- Implement event logging for audit, analytics, notifications, rollback, and AI use cases

### Phase 7 — AI 5.0
- Introduce feature-flagged AI modules with tenant-scoped data access and explainability

### Phase 8 — Mobile 5.0
- Build a proper mobile product shell and offline / QR / notification workflows

### Phase 9 — Commercial SaaS
- Add subscription, limits, invoices, payments, and owner self-service flow

### Phase 10 — QA and release
- Complete lint, test, build, RLS, RBAC, migration, mobile, security, and performance validation

---

## 18. Phase 1 readiness checklist

The following checklist must be satisfied before Phase 1 starts:

- [x] Phase 0 architecture audit completed
- [x] Current v4 state documented
- [x] Major risks identified
- [x] Modules to keep / refactor / rewrite listed
- [x] Proposed v5 architecture documented
- [x] Database strategy documented
- [x] RBAC / RLS strategy documented
- [x] Frontend strategy documented
- [x] Engine strategy documented
- [x] Mobile and AI strategy documented
- [x] Release strategy documented
- [ ] Review and approval of blueprint by the product owner / engineering lead
- [ ] Branch created for v5 work (recommended: v5-platform-edition)
- [ ] Phase 1 implementation plan approved

---

## 19. Implementation note

This document intentionally avoids starting Phase 1 implementation. The next step is review and approval of the blueprint, then a controlled Phase 1 launch with the core platform model and migration contract.
