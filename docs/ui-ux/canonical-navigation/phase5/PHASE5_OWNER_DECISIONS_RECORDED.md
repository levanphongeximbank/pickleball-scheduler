# Phase 5 Owner Decisions — Recorded

**Program:** PICK_VN Canonical Navigation  
**Phase:** 5 — Preview flag-ON acceptance  
**Recorded at HEAD:** `087c61c7d8bb1efdae343685269e53aa75767e21`  
**Branch:** `feature/canonical-navigation-phase5-preview-acceptance`  
**Fresh `origin/main`:** `087c61c7d8bb1efdae343685269e53aa75767e21`  
**Machine-readable:** [`PHASE5_OWNER_DECISIONS_RECORDED.json`](./PHASE5_OWNER_DECISIONS_RECORDED.json)  
**Preflight gate:** [`PHASE5_IDENTITY_ENV_PREFLIGHT.md`](./PHASE5_IDENTITY_ENV_PREFLIGHT.md)

## Verdict

**`CANONICAL_NAVIGATION_PHASE5_OWNER_DECISIONS_RECORDED_PREVIEW_GO_YES`**

Program OD-P5 decisions remain **APPROVED**.  
Identity coverage: [`PHASE5_IDENTITY_COVERAGE_OWNER_DECISIONS.md`](./PHASE5_IDENTITY_COVERAGE_OWNER_DECISIONS.md).  
Owner attestation: [`PHASE5_OWNER_ATTESTATION.md`](./PHASE5_OWNER_ATTESTATION.md) → **`PREVIEW_GO=YES`**.  
Authorized next step: **Draft PR** (docs only).

---

## Binding decisions

| Decision ID | Owner code | Status | Binding rule |
|-------------|------------|--------|--------------|
| OD-P5-ENV | `APPROVED_VERCEL_PREVIEW_ONLY` | **APPROVED** | Primary acceptance environment = **Vercel Preview** only. Netlify is **out of scope** for the first execution pass. |
| OD-P5-TRIGGER | `APPROVED_DRAFT_PR_TRIGGER` | **APPROVED** | Use a **Draft PR** to trigger Preview and bind deployment to an exact commit SHA. |
| OD-P5-FLAG | `APPROVED_PREVIEW_FLAG_ON` | **APPROVED** | Set `VITE_CANONICAL_APP_SHELL_ENABLED=true` for **Vercel Preview** only. Production must remain OFF/absent. No Production redeploy. |
| OD-P5-IDENTITIES | `APPROVED_NONPROD_TEST_IDENTITIES` | **APPROVED** | Non-Production identities only; credentials never exposed in Git/reports/logs/screenshots/PR. |
| OD-P5-PLATFORM-ADMIN | `APPROVED_PACKAGE_A_REUSE_EXISTING_SUPER_ADMIN` | **APPROVED** | Reuse Staging SUPER_ADMIN as PLATFORM_ADMIN-equivalent. No new user / no literal PLATFORM_ADMIN / no schema. |
| OD-P5-COACH | `APPROVED_PACKAGE_D_WAIVE` | **APPROVED** | COACH = **`WAIVED_WITH_KNOWN_SCHEMA_GAP`**. Backlog: `PHASE5_BACKLOG_COACH_ROLE_SUPPORT.md`. |
| OD-P5-LIMITED_ROLES | `APPROVED_DOCUMENT_LIMITATIONS` | **APPROVED** | Use available **CLUB_MANAGER** and **REFEREE** identities with **documented limitations**. |
| OD-P5-OBSERVABILITY | `APPROVED_MANUAL_BROWSER_ACCEPTANCE` | **APPROVED** | Manual browser acceptance + evidence only. No bypass secrets. No automated authenticated probes in Phase 5. |
| OD-P5-ROLLBACK | `APPROVED_PREVIEW_ROLLBACK` | **APPROVED** | After flag-ON acceptance: Preview flag OFF → Redeploy Preview only → verify legacy shell restored. |

---

## GO tokens

| Token | Value |
|-------|-------|
| `PREVIEW_IDENTITY_COVERAGE_GO` | **YES** |
| `PREVIEW_GO` | **YES** |
| `STAGING_AUTH_MUTATION_GO` | **NO** |
| `STAGING_DATABASE_MUTATION_GO` | **NO** |
| `STAGING_SCHEMA_MUTATION_GO` | **NO** |
| `MIGRATION_GO` | **NO** |
| `PRODUCTION_GO` | **NO** |
| `PRODUCTION_FLAG_CHANGE` | **NO** |
| `PRODUCTION_DEPLOYMENT` | **NO** |
| `SQL` | **NO** (no mutations; read-only verify allowed for preflight) |

---

## Execution binding (updated from audit)

| Topic | Audit default | Owner binding |
|-------|---------------|---------------|
| Acceptance host | Vercel + Netlify | **Vercel Preview only** (first pass) |
| Deploy trigger | PR or Redeploy | **Draft PR only** |
| Flag scope | Preview (either provider) | **Vercel Preview only** |
| Observability | Manual or bypass-assisted | **Manual browser only** |
| Rollback | Preview flag OFF + redeploy | **Confirmed** |

---

## Preflight status

| Gate | Status |
|------|--------|
| Identity coverage | **CLOSED** — Package A; COACH waived |
| Vercel Preview flag | **PASS** — Owner attestation Preview `true` |
| Production isolation | **PASS** — flag OFF_OR_ABSENT; no Production env/redeploy/promote |
| Draft PR | **AUTHORIZED** (`PREVIEW_GO=YES`) |

CLUB_MANAGER / REFEREE remain **LIMITED** per OD-P5-LIMITED_ROLES.

---

## Owner actions still required before full PREVIEW_GO

~~Closed by Owner attestation.~~ Next: open Draft PR; then manual Preview acceptance.

---

## Safety attestation (this recording)

| Check | Value |
|-------|------:|
| Runtime code changed | **NO** |
| Tests changed | **NO** |
| Environment variables changed | **NO** |
| Deployments | **0** |
| SQL mutations | **0** |
| Production mutations | **0** |
| Production feature flag changes | **0** |
| Draft PR opened | **NO** |
| Commit / push | **NO** |
| Credentials exposed | **NO** |
