# Phase 5 Identity Coverage — Owner Decisions Recorded

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Identity coverage for Preview acceptance  
**Recorded at HEAD:** `087c61c7d8bb1efdae343685269e53aa75767e21`  
**Branch:** `feature/canonical-navigation-phase5-preview-acceptance`  
**Source discovery:** [`PHASE5_STAGING_IDENTITY_DISCOVERY.md`](./PHASE5_STAGING_IDENTITY_DISCOVERY.md)  
**Machine-readable:** [`PHASE5_IDENTITY_COVERAGE_OWNER_DECISIONS.json`](./PHASE5_IDENTITY_COVERAGE_OWNER_DECISIONS.json)  
**COACH backlog:** [`PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md`](./PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md)

## Verdict

**`CANONICAL_NAVIGATION_PHASE5_IDENTITY_COVERAGE_OWNER_DECISIONS_RECORDED`**

`PREVIEW_IDENTITY_COVERAGE_GO=YES`

No Auth / database / schema / migration mutations were performed by this recording.

---

## Binding decisions

| Decision ID | Owner code | Status | Binding |
|-------------|------------|--------|---------|
| OD-P5-PLATFORM-ADMIN | `APPROVED_PACKAGE_A_REUSE_EXISTING_SUPER_ADMIN` | **APPROVED** | Use existing non-Production Staging **SUPER_ADMIN** as PLATFORM_ADMIN-equivalent. No new user. No literal `PLATFORM_ADMIN` in `profiles.role`. No constraint/schema/migration changes. |
| OD-P5-COACH | `APPROVED_PACKAGE_D_WAIVE` | **APPROVED** | Waive COACH execution for Phase 5 Preview acceptance. Classification: **`WAIVED_WITH_KNOWN_SCHEMA_GAP`**. Follow-up backlog for canonical COACH DB support. |

---

### OD-P5-PLATFORM-ADMIN — APPROVED_PACKAGE_A_REUSE_EXISTING_SUPER_ADMIN

- Phase 5 PLATFORM_ADMIN cells use the existing Staging SUPER_ADMIN identity (app `normalizeRole(SUPER_ADMIN) → PLATFORM_ADMIN`).
- **Forbidden:** create new PLATFORM_ADMIN user; write literal `PLATFORM_ADMIN` into `public.profiles.role`; change role constraints; modify schema; run migrations.
- Credentials remain in operator vault only (never in Git / reports / logs / screenshots / PR comments).

### OD-P5-COACH — APPROVED_PACKAGE_D_WAIVE

**Classification:** `WAIVED_WITH_KNOWN_SCHEMA_GAP`

| Fact | Evidence |
|------|----------|
| COACH exists in app role model | `src/features/identity/constants/roles.js` |
| COACH absent from Staging `public.roles` | Discovery read-only |
| COACH excluded from `profiles_role_check` | Discovery read-only |
| Correct provision needs schema + migration | Discovery Package C |
| Phase 5 will not broaden into role-schema remediation | Owner binding |

Preview acceptance must **not** require a COACH login. Unrelated-role denial cells may use other non-admin Staging roles already available (e.g. VENUE_MANAGER / PLAYER) and mark COACH-specific rows **WAIVED**.

Backlog: [`PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md`](./PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md)

---

## GO tokens

| Token | Value |
|-------|-------|
| `PREVIEW_IDENTITY_COVERAGE_GO` | **YES** |
| `STAGING_AUTH_MUTATION_GO` | **NO** |
| `STAGING_DATABASE_MUTATION_GO` | **NO** |
| `STAGING_SCHEMA_MUTATION_GO` | **NO** |
| `MIGRATION_GO` | **NO** |
| `PRODUCTION_GO` | **NO** |
| `PRODUCTION_MUTATION_GO` | **NO** |
| `PRODUCTION_DEPLOYMENT_GO` | **NO** |

Note: Full `PREVIEW_GO` for Draft PR still also requires env/isolation preflight rows (Vercel Preview flag attestation + Production isolation) per [`PHASE5_IDENTITY_ENV_PREFLIGHT.md`](./PHASE5_IDENTITY_ENV_PREFLIGHT.md). Identity coverage gate is **closed YES**.

---

## Safety attestation

| Check | Value |
|-------|------:|
| Auth mutations | **0** |
| Database mutations | **0** |
| Schema mutations | **0** |
| Migrations | **0** |
| Production mutations | **0** |
| Credentials exposed | **NO** |
| Commit / push / PR | **NO** |
