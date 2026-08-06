# Owner Decision Packages — Production Activation Planning

**Program:** PICK_VN Canonical Navigation  
**Purpose:** Bind Owner decisions required before Production canonical flag enablement  
**Status:** **UNBOUND** (planning audit only)  
**Production GO today:** **NO**  
**Do not invent a phase number** — bind a charter name/path when Owner chooses.

Related: `docs/ui-ux/canonical-navigation/production-activation-readiness/`

---

## Package OD-PA-01 — Activation charter

| Field | Required value |
|-------|----------------|
| Decision | Authorize creation of a Production activation execution package (docs + runbook), still without enabling the flag |
| Options | A) Proceed under `production-activation-readiness/` only · B) Owner-named next phase directory (Owner supplies name) |
| Default audit recommendation | **A** until Owner names a phase |
| GO token | `PRODUCTION_ACTIVATION_PLANNING_GO` = YES/NO |

---

## Package OD-PA-02 — Production GO tokens

| Token | Required before flag ON |
|-------|-------------------------|
| `PRODUCTION_GO` | YES |
| `PRODUCTION_FLAG_CHANGE_GO` | YES |
| `PRODUCTION_REDEPLOY_GO` | YES |
| `PRODUCTION_ENV_CHANGE_GO` | YES |
| `PRODUCTION_BROWSER_ACCEPTANCE_GO` | YES |
| `STAGING_AUTH_MUTATION_GO` | NO (default) |
| `STAGING_DATABASE_MUTATION_GO` | NO (default) |
| `SCHEMA_MUTATION_GO` / `MIGRATION_GO` | NO unless COACH schema chosen |

---

## Package OD-PA-03 — Identity matrix

| Decision | Options |
|----------|---------|
| Production identity source | A) Owner-bound Production QA identities · B) Accept Preview/Staging evidence transfer with named gaps · C) Hybrid (admin Production + waive others) |
| SUPER_ADMIN / PLATFORM_ADMIN-eq | Required for B03/pairing admin cells unless waived |
| VENUE_OWNER / VENUE_MANAGER / CLUB_* / REFEREE / PLAYER | Minimum set for GO or explicit waiver per role |
| Unauthenticated | Required public smoke |
| COACH | Continue `WAIVED_WITH_KNOWN_SCHEMA_GAP` **or** require `BL-P5-COACH-ROLE-SCHEMA` before GO |
| Writes | Default no-write; list any unavoidable write cells |

**GO token:** `PRODUCTION_IDENTITY_COVERAGE_GO`

---

## Package OD-PA-04 — Phase 5 limitation disposition for Production

Recommended Production dispositions below are planning guidance only. They do **not** authorize Production flag enablement or execution.

| Limitation | Recommended disposition |
|------------|-------------------------|
| Browser refresh NOT_TESTED | **RETEST_ON_PRODUCTION** |
| Browser back/forward NOT_TESTED | **RETEST_ON_PRODUCTION** |
| High contrast NOT_TESTED | **RETEST_ON_PRODUCTION** |
| Manual Tournament Engine UI | **RETEST** one authorized allow spot and one unauthorized deny spot |
| Manual Rating V5 shadow UI | **RETEST** admin allow and non-admin deny |
| Manual Private Pairing UI | **RETEST** admin allow and non-admin deny |
| Non-admin Preview roles limited | **RETEST** selected critical Production-safe roles or bind an explicit role waiver |
| OBS-UI-01 tenant overlap | **ACCEPT_RESIDUAL_RISK** |
| OBS-RUNTIME-01/02 messaging/CRM | **ACCEPT_OUT_OF_SHELL_SCOPE** |
| OBS-DATA-01 MISSING_IDENTITY_LINK | **ACCEPT_DATA_RUNTIME_OBSERVATION** unless it blocks navigation |

---

## Package OD-PA-05 — Operations binding

| Field | Owner fills |
|-------|-------------|
| Deployment owner | |
| Rollback owner | |
| Monitoring owner | |
| Operator identity (Production-safe) | |
| Maintenance window (start/end TZ) | |
| Acceptance window | |
| Monitoring duration + interval | |
| Rollback thresholds | white screen >0; auth loop ≥1; public outage ≥1; privilege bypass ≥1; other: |
| Merge freeze during window | YES/NO (recommended YES due to OBS-P5-PM-01) |

**GO token:** `PRODUCTION_OPS_BINDING_GO`

---

## Package OD-PA-06 — Flag and deploy mechanics attestation

| Check | Owner attests |
|-------|---------------|
| Vercel project | `pickleball-scheduler` (confirm) |
| Production flag current state | OFF_OR_ABSENT (live screenshot/export) |
| Evaluation mode understood | Vite build-time; redeploy required |
| Auto Production deploy on `main` merge understood | OBS-P5-PM-01 retained |
| Rollback = flag OFF + Production redeploy | Confirmed |

**GO token:** `PRODUCTION_FLAG_MECHANICS_GO`

---

## Package OD-PA-07 — COACH disposition

| Option | Effect |
|--------|--------|
| A) Continue waiver | COACH cells WAIVED for Production activation |
| B) Block activation on COACH | Requires schema/catalog/fixture workstream + separate GOs |

Audit recommendation: **A** unless coaching Production nav is in-scope for the same window.

---

## Binding record (empty until Owner signs)

| Package | Decision code | Bound by | Date | SHA/window |
|---------|---------------|----------|------|------------|
| OD-PA-01 | _unbound_ | | | |
| OD-PA-02 | _unbound_ | | | |
| OD-PA-03 | _unbound_ | | | |
| OD-PA-04 | _unbound_ | | | |
| OD-PA-05 | _unbound_ | | | |
| OD-PA-06 | _unbound_ | | | |
| OD-PA-07 | _unbound_ | | | |

---

## Explicit non-actions until GOs bound

- Do not set Production `VITE_CANONICAL_APP_SHELL_ENABLED=true`  
- Do not Redeploy Production for this flag  
- Do not promote Preview  
- Do not mutate Staging Auth/DB/schema  
- Do not open activation PR that changes runtime unless separately scoped  

---

## Safety

This file records required decisions only. No environment or Production mutation performed by the audit that authored it.
