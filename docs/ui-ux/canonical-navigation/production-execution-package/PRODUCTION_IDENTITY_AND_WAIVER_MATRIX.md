# Production Identity and Waiver Matrix

**Program:** PICK_VN Canonical Navigation
**Package:** Production execution package
**Source baseline SHA:** `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b`
**Execution package local commit (pre-waiver):** `910e068fcc085bed7bc7d97d17f1ee8b2086ae22`
**Evidence timestamp:** 2026-08-06
**Production operating mode:** `OWNER_ONLY_CONTROLLED_PILOT`
**`IDENTITY_CREATION_GO`:** **NO**
**`PRODUCTION_IDENTITY_COVERAGE_PLANNING_GO`:** **YES**
**`PRODUCTION_IDENTITY_COVERAGE_GO`:** **NO** (execution token; planning GO does not imply execution)

Identity creation is **not authorized**. Staging identities are not Production-safe by default.

---

## Bound / available identities (required for pilot)

| Identity class | Binding | Status |
|----------------|---------|--------|
| SUPER_ADMIN | `EXISTING_OWNER_ACCOUNT` | Bound — **required** for pilot (`SUPER_ADMIN_TEST_REQUIRED=YES`) |
| Public unauthenticated | `AVAILABLE` | Bound — **required** for pilot (`PUBLIC_UNAUTHENTICATED_TEST_REQUIRED=YES`) |
| COACH | `WAIVED_WITH_KNOWN_SCHEMA_GAP` | Accepted waiver under OD-PA-07 / `UNAVAILABLE_ROLE_POLICY=EXPLICIT_WAIVER`; backlog `BL-P5-COACH-ROLE-SCHEMA` remains separate |

---

## Owner waivers (initial Production activation only)

### Waiver metadata

| Field | Value |
|-------|--------|
| `WAIVER_SCOPE` | `CANONICAL_NAVIGATION_INITIAL_PRODUCTION_ACTIVATION_ONLY` |
| `WAIVER_EXPIRY_CONDITION` | `BEFORE_ANY_NON_OWNER_USER_OR_SECOND_TENANT_IS_ENABLED` |
| `WAIVER_REPLACEMENT_REQUIREMENT` | `RUN_NON_ADMIN_ALLOW_DENY_AND_TENANT_ISOLATION_TESTS_BEFORE_BROADER_ROLLOUT` |
| Bound by | Owner (Le Phong) |
| Bound date | 2026-08-06 |
| Bound against package commit | `910e068fcc085bed7bc7d97d17f1ee8b2086ae22` |
| Bound against source baseline | `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b` |

These waivers authorize **planning completeness** for an Owner-only controlled pilot. They do **not** authorize Production flag change, env change, redeploy, or browser acceptance execution.

### 1. Non-admin allow — `WAIVED_BY_OWNER`

| Field | Value |
|-------|--------|
| Why needed | Prove selected non-admin authorized routes still allow under canonical shell without privilege inflation |
| Exact allow tests covered (deferred) | Selected non-admin allow routes; Tournament Engine authorized allow (non-admin ownership path if applicable); menu subset visibility for a Production-safe non-admin role |
| Current status | `WAIVED_BY_OWNER` |
| Waiver reason | `NO_PRODUCTION_NON_ADMIN_IDENTITY_AVAILABLE_OWNER_ONLY_PILOT` |
| Identity creation | **Not authorized** (`IDENTITY_CREATION_GO=NO`) |
| Acceptance cell marking | `WAIVED_BY_OWNER` — **not PASS** |

### 2. Non-admin deny — `WAIVED_BY_OWNER`

| Field | Value |
|-------|--------|
| Why needed | Prove unauthorized non-admin users are denied admin-only navigation and critical feature routes |
| Exact deny tests covered (deferred) | Selected non-admin deny routes; Tournament Engine unauthorized deny; Rating V5 non-admin deny; Private Pairing non-admin deny |
| Current status | `WAIVED_BY_OWNER` |
| Waiver reason | `NO_PRODUCTION_NON_ADMIN_IDENTITY_AVAILABLE_OWNER_ONLY_PILOT` |
| Identity creation | **Not authorized** (`IDENTITY_CREATION_GO=NO`) |
| Acceptance cell marking | `WAIVED_BY_OWNER` — **not PASS** |

### 3. Tenant isolation — `WAIVED_BY_OWNER`

| Field | Value |
|-------|--------|
| Why needed | Prove wrong-tenant navigation/data exposure remains denied under canonical shell |
| Exact deny tests covered (deferred) | Tenant-isolation denial; wrong-tenant exposure rollback trigger coverage |
| Current status | `WAIVED_BY_OWNER` |
| Waiver reason | `NO_SECOND_PRODUCTION_TENANT_IDENTITY_AVAILABLE_OWNER_ONLY_PILOT` |
| Identity creation | **Not authorized** (`IDENTITY_CREATION_GO=NO`) |
| Acceptance cell marking | `WAIVED_BY_OWNER` — **not PASS** |

---

## Residual risk and rollback thresholds (still in force)

Waiving identity-dependent tests does **not** remove rollback thresholds. If privilege bypass or wrong-tenant exposure is observed during Owner/public pilot testing, rollback applies:

| Trigger | Threshold |
|---------|-----------|
| Privilege bypass | **≥ 1** (`PRIVILEGE_BYPASS_ROLLBACK_THRESHOLD=1`) |
| Wrong-tenant exposure | **≥ 1** (`WRONG_TENANT_EXPOSURE_ROLLBACK_THRESHOLD=1`) |

---

## Policy

| Policy | Value |
|--------|--------|
| `PRODUCTION_OPERATING_MODE` | `OWNER_ONLY_CONTROLLED_PILOT` |
| `COACH_ROLE` | `WAIVED_WITH_KNOWN_SCHEMA_GAP` |
| `UNAVAILABLE_ROLE_POLICY` | `EXPLICIT_WAIVER` |
| `PRODUCTION_SUPER_ADMIN_IDENTITY` | `EXISTING_OWNER_ACCOUNT` |
| `PUBLIC_UNAUTHENTICATED_IDENTITY` | `AVAILABLE` |
| `NON_ADMIN_ALLOW_IDENTITY` | `WAIVED_BY_OWNER` |
| `NON_ADMIN_DENY_IDENTITY` | `WAIVED_BY_OWNER` |
| `TENANT_ISOLATION_IDENTITY` | `WAIVED_BY_OWNER` |
| `SUPER_ADMIN_TEST_REQUIRED` | **YES** |
| `PUBLIC_UNAUTHENTICATED_TEST_REQUIRED` | **YES** |
| `IDENTITY_CREATION_GO` | **NO** |
| `PRODUCTION_IDENTITY_COVERAGE_PLANNING_GO` | **YES** |
| `PRODUCTION_IDENTITY_COVERAGE_GO` | **NO** |

---

## Coverage verdict

Identity **planning** coverage for initial Owner-only Production activation is **complete** via bound identities + explicit Owner waivers.

Identity-dependent browser cells are **`WAIVED_BY_OWNER`**, not PASS. Before any non-Owner user or second tenant is enabled, Owner must satisfy `WAIVER_REPLACEMENT_REQUIREMENT` (run non-admin allow/deny and tenant-isolation tests).

`PRODUCTION_IDENTITY_COVERAGE_PLANNING_GO=YES` does **not** set `PRODUCTION_IDENTITY_COVERAGE_GO`, `PRODUCTION_GO`, or any Production mutation token to YES.
