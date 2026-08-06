# Production Identity and Waiver Matrix

**Program:** PICK_VN Canonical Navigation  
**Package:** Production execution package  
**Source baseline SHA:** `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b`  
**Evidence timestamp:** 2026-08-06  
**Decision deadline for pending identities:** before execution window start `2026-08-07T21:00:00+07:00` (`Asia/Ho_Chi_Minh`)  
**`PRODUCTION_IDENTITY_COVERAGE_GO`:** **NO**

Identity creation is **not authorized**. Staging identities are not Production-safe by default.

`WAIVER_PENDING` is **not** an accepted waiver. Do not treat pending cells as PASS or WAIVED.

---

## Bound identities

| Identity class | Binding | Status |
|----------------|---------|--------|
| SUPER_ADMIN | `EXISTING_OWNER_ACCOUNT` | Bound — use existing Owner Production account for authenticated admin allow checks |
| Public unauthenticated | `AVAILABLE` | Bound — no account required for public smoke |
| COACH | `WAIVED_WITH_KNOWN_SCHEMA_GAP` | Accepted waiver under OD-PA-07 / `UNAVAILABLE_ROLE_POLICY=EXPLICIT_WAIVER`; backlog `BL-P5-COACH-ROLE-SCHEMA` remains separate |

---

## Pending identities (must close before identity coverage GO)

### 1. Non-admin allow — `WAIVER_PENDING`

| Field | Value |
|-------|--------|
| Why needed | Prove selected non-admin authorized routes still allow under canonical shell without privilege inflation |
| Exact allow tests covered | Selected non-admin allow routes; Tournament Engine authorized allow (non-admin ownership path if applicable); menu subset visibility for a Production-safe non-admin role |
| Current status | `WAIVER_PENDING` |
| Decision deadline | `2026-08-07T21:00:00+07:00` Asia/Ho_Chi_Minh |
| Permitted resolutions | (1) Bind an existing Production-safe identity; (2) Bind an explicit Owner waiver |
| Identity creation | **Not authorized** |
| Acceptance cell marking until resolved | `BLOCKED_PENDING_IDENTITY_OR_WAIVER` |

### 2. Non-admin deny — `WAIVER_PENDING`

| Field | Value |
|-------|--------|
| Why needed | Prove unauthorized non-admin users are denied admin-only navigation and critical feature routes |
| Exact deny tests covered | Selected non-admin deny routes; Tournament Engine unauthorized deny; Rating V5 non-admin deny; Private Pairing non-admin deny |
| Current status | `WAIVER_PENDING` |
| Decision deadline | `2026-08-07T21:00:00+07:00` Asia/Ho_Chi_Minh |
| Permitted resolutions | (1) Bind an existing Production-safe identity; (2) Bind an explicit Owner waiver |
| Identity creation | **Not authorized** |
| Acceptance cell marking until resolved | `BLOCKED_PENDING_IDENTITY_OR_WAIVER` |

### 3. Tenant isolation — `WAIVER_PENDING`

| Field | Value |
|-------|--------|
| Why needed | Prove wrong-tenant navigation/data exposure remains denied under canonical shell |
| Exact deny tests covered | Tenant-isolation denial; wrong-tenant exposure rollback trigger coverage |
| Current status | `WAIVER_PENDING` |
| Decision deadline | `2026-08-07T21:00:00+07:00` Asia/Ho_Chi_Minh |
| Permitted resolutions | (1) Bind an existing Production-safe identity; (2) Bind an explicit Owner waiver |
| Identity creation | **Not authorized** |
| Acceptance cell marking until resolved | `BLOCKED_PENDING_IDENTITY_OR_WAIVER` |

---

## Policy

| Policy | Value |
|--------|--------|
| `COACH_ROLE` | `WAIVED_WITH_KNOWN_SCHEMA_GAP` |
| `UNAVAILABLE_ROLE_POLICY` | `EXPLICIT_WAIVER` |
| `PRODUCTION_SUPER_ADMIN_IDENTITY` | `EXISTING_OWNER_ACCOUNT` |
| `PUBLIC_UNAUTHENTICATED_IDENTITY` | `AVAILABLE` |
| `NON_ADMIN_ALLOW_IDENTITY` | `WAIVER_PENDING` |
| `NON_ADMIN_DENY_IDENTITY` | `WAIVER_PENDING` |
| `TENANT_ISOLATION_IDENTITY` | `WAIVER_PENDING` |
| `PRODUCTION_IDENTITY_COVERAGE_GO` | **NO** |

---

## Coverage verdict

Identity matrix is **incomplete**. Pending identities block `PRODUCTION_IDENTITY_COVERAGE_GO` and identity-dependent browser acceptance cells.

Do **not** set `PRODUCTION_IDENTITY_COVERAGE_GO=YES` while any of non-admin allow, non-admin deny, or tenant isolation remain `WAIVER_PENDING`.
