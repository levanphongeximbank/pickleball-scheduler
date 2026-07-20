# CORE-03 Phase 1F — Persistence Foundation and Migration Authoring

**Wave:** 1 / CORE-03  
**Phase:** 1F — Persistence Foundation and Migration Authoring  
**Module:** `src/features/competition-core/registration-eligibility/persistence/`  
**Branch intent:** `feature/competition-core-03-persistence`  
**Persistence version:** `PERSISTENCE_FOUNDATION_VERSION` = `core03-persistence-1.0.0`

---

## 1. Persistence ownership

| Aggregate | Owner | Storage object |
|-----------|-------|----------------|
| Competition registration | **Core-03** | `core03_competition_registrations` |
| Registration / eval / capacity idempotency | **Core-03** | `core03_registration_idempotency` |
| Eligibility evaluation evidence | **Core-03** | `core03_eligibility_evidence` |
| Capacity state | **Core-03** | `core03_capacity_state` |
| Capacity reservations | **Core-03** | `core03_capacity_reservations` |
| Waitlist entries | **Core-03** | `core03_waitlist_entries` |
| Registration audit events | **Core-03** | `core03_registration_audit_events` |
| Partial-success reconciliation | **Core-03** | `core03_persistence_reconciliation` |
| Core-02 Entry | **Core-02** (deferred) | not created |
| Legacy Phase 3C tables | Integrator / legacy | **not modified** |

Core-02 Entry creation and APPROVED→Entry handoff remain **DEFERRED_FAIL_CLOSED**.  
Phase 1F may persist `handoff_pending` / approval state only.

---

## 2. Table and aggregate model

Each persisted aggregate includes, where applicable:

- stable primary ID
- competition ID / division ID / registration ID
- optional `tenant_id` (future binding; not inferred)
- `created_at` / `updated_at` (ClockPort-owned values)
- `state_version` / `source_version`
- correlation / request IDs

Missing mandatory scope **fails closed** (`PERSISTENCE_SCOPE_REQUIRED`).

### Uniqueness

| Constraint | Object |
|------------|--------|
| Registration ID PK | `core03_competition_registrations.id` |
| Registration request ID | unique index |
| Namespaced idempotency key | unique PK on `core03_registration_idempotency` |
| Active target identity | partial unique on competition + division + target (non-terminal) |
| Evaluation request ID | unique |
| Canonical evaluation fingerprint | unique where present |
| One ACTIVE reservation per registration | partial unique |
| One ACTIVE waitlist entry per registration | partial unique |

### Capacity checks

- no negative used/reserved/limit
- `used + reserved <= configured_limit`
- optimistic concurrency via `state_version` (no silent last-write-wins)

### Waitlist

- ordering fields (`priority_rank`, `waitlisted_at`, `waitlist_entry_id`) preserved
- position is **derived** from ordered ACTIVE rows (not authoritative mutable position)

### Audit

- append-only
- UPDATE/DELETE blocked by trigger + repository methods that reject mutation
- no secrets, tokens, stack traces, or unbounded provider payloads

---

## 3. Repository adapters

Factory:

```js
import { createCore03PersistenceRepositories } from "../registration-eligibility/index.js";

const persistence = createCore03PersistenceRepositories();
// persistence.registration  → RegistrationRepositoryPort
// persistence.audit         → RegistrationAuditPort (+ immutable guards)
// persistence.eligibilityEvidence → EligibilityEvidenceLookupPort (+ fingerprint)
// persistence.capacityState / capacityReservations / waitlist
```

Adapters:

- use explicit scope identifiers
- return defensive normalized copies
- preserve / enforce `stateVersion`
- reject stale writes
- avoid hidden retries that could duplicate writes
- never call `Date.now()` or generate random IDs

SQL helpers (`buildInsertRegistrationSql`, etc.) produce **parameterized** `{ text, values }` plans only.  
**No database connection is opened by Phase 1F code.**

---

## 4. Optimistic concurrency

| Aggregate | Mechanism |
|-----------|-----------|
| Registration | `state_version` + `expectedStateVersion` on save |
| Capacity state | `state_version` + `expectedStateVersion` |
| Waitlist scope | `waitlist_version` / `expectedWaitlistVersion` |
| Reservation | `state_version` on row |

Stale writes fail closed (`STALE_REGISTRATION_VERSION`, `STALE_CAPACITY_VERSION`, `STALE_WAITLIST_VERSION`).

---

## 5. Transaction boundaries

Documented multi-step boundaries:

1. create draft + idempotency + audit  
2. submit + audit  
3. eligibility evidence + evaluation idempotency + audit  
4. reserve capacity + counters + idempotency + audit  
5. release capacity + counters + audit  
6. waitlist placement + registration transition + waitlist entry + audit  
7. promotion + reservation + registration transition + waitlist mutation + audit  

Memory store **supports** begin/commit/rollback.  
`runPersistenceTransaction` claims atomicity **only** when the store supports transactions.

---

## 6. Partial-success and reconciliation

When a real transaction cannot be provided:

- steps may complete partially
- result includes `partialSuccess` + `reconciliationRequired`
- optional row in `core03_persistence_reconciliation`

Do **not** claim atomicity unless implemented.

---

## 7. Tenant / RLS design

**Owner decision (accepted deferred condition, not a commit blocker):**

`TENANT_CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED`

Tenant-scoped client RLS remains deferred until the canonical
tenant-to-competition ownership model is approved.

Phase 1F SQL (fail-closed default for every Phase 1F table):

- optional `tenant_id` columns for future binding only (never inferred)
- RLS enabled
- deny-all policies only (`USING (false) WITH CHECK (false)`)
- no `USING (true)` / `WITH CHECK (true)`
- revoke `anon` / `authenticated` grants
- audit and privileged mutation tables are not client-writable
- no tenant inference from first row, `auth.uid()` without approved mapping,
  default tenant, venue fallback, or unscoped request
- missing competition / division / registration / target scope fails closed in adapters

No policy is authored that pretends the tenant ownership model is already approved.

**SQL was not applied to any environment.**  
`MIGRATION_STATUS = AUTHORED_NOT_APPLIED`

---

## 8. Migration order / safety

### Order

1. Preflight + backup  
2. Dry-run SQL parse / plan  
3. Staging apply (future owner-approved phase)  
4. Verification queries  
5. Production apply only after Staging GO + owner approval  

### Preflight checks

- Phases 1A–1E present  
- No Phase 3C table collision  
- Backup taken  
- Service-role credentials available to operator (not stored in app)  

### Dry-run

- Review `supabase-core03-phase1f-persistence.sql` in SQL editor without execute  
- Confirm no DROP/RENAME of legacy tables  

### Rollback

- Prefer restore-from-backup  
- Destructive DROP script is Staging-lab only (`*-rollback.sql`, fully commented)
- Rollback docs warn about irreversible data loss (especially audit history)

### Verification queries (future apply)

```sql
select count(*) from public.core03_competition_registrations;
select count(*) from public.core03_registration_audit_events;
-- confirm triggers exist for audit immutability
```

### Explicit no-apply status

| Item | Value |
|------|-------|
| `MIGRATION_STATUS` | **AUTHORED_NOT_APPLIED** |
| Migration authored | **yes** |
| Applied to Staging | **no** |
| Applied to Production | **no** |
| App DB connection in Phase 1F | **none** |

Statements use `create table if not exists`, `create ... if not exists`, and
`drop policy if exists` guards. No destructive Phase 3C / sibling DDL.

---

## 9. Accepted deferred gaps (Owner-closed)

| Gap | Status | Commit blocker? |
|-----|--------|-----------------|
| Tenant-scoped client RLS | `DEFERRED_FAIL_CLOSED` | **No** (Owner-accepted) |
| SQL apply / Staging rollout | deferred separate gate | **No** |
| Core-02 Entry creation / handoff | `DEFERRED_FAIL_CLOSED` | **No** |
| Live Supabase executor wiring | deferred | **No** |

---

## 10. Phase 1G boundary (documentation only — not started)

Phase 1G **may** include (with later Owner instruction to start the phase):

- repository contract integration tests
- migration dry-run planning
- Staging rollout checklist
- runtime composition readiness
- reconciliation and recovery QA
- operational verification queries
- Production-readiness documentation

Phase 1G **must not** include without a **separate explicit Owner instruction**:

- SQL apply
- database connection
- deploy
- Production mutation
- client RLS activation
- Core-02 Entry handoff activation

This Phase 1F condition-closure task does **not** start Phase 1G.

---

## 11. Public exports

Exported via `registration-eligibility/index.js` only (not protected root barrel):

- `createCore03PersistenceRepositories`
- `createCore03MemoryPersistenceStore`
- repository adapter factories
- parameterized SQL helpers
- `PERSISTENCE_FOUNDATION_VERSION`
- `CORE03_PHASE_1F_MIGRATION_STATUS`

Not exported: store maps, credentials, live clients, connection handles.
