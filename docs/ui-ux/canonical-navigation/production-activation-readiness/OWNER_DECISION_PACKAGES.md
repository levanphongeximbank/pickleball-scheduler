# Owner Decision Packages — Production Activation Planning

**Program:** PICK_VN Canonical Navigation  
**Purpose:** Bind Owner decisions required before Production canonical flag enablement  
**Status:** **PLANNING DECISIONS BOUND** (2026-08-06) — not an execution package  
**Production GO today:** **NO**  
**Planning path:** `docs/ui-ux/canonical-navigation/production-activation-readiness/` (no numbered Phase 6)

**Bound against:** planning PR #388 · head `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` · Bound by: Owner · Date: 2026-08-06

These bindings authorize planning continuity only. They do **not** authorize Production flag enablement, env change, redeploy, or browser acceptance execution.

---

## Package OD-PA-01 — Activation charter

| Field | Value |
|-------|--------|
| Decision code | **OPTION_A** |
| Meaning | Continue under `production-activation-readiness/` only |
| Numbered Phase 6 | **Not created** |
| GO token | `PRODUCTION_ACTIVATION_PLANNING_GO` planning path authorized; execution package still separate |

---

## Package OD-PA-02 — Production GO tokens

| Field | Value |
|-------|--------|
| Decision code | **PLANNING_ONLY_EXECUTION_GOS_REMAIN_NO** |
| Meaning | Planning may continue; all Production execution GO tokens remain **NO** |
| Later requirement | Execution GO must bind exact package, SHA, target, and time window |

| Token | Current value |
|-------|---------------|
| `PRODUCTION_GO` | **NO** |
| `PRODUCTION_FLAG_CHANGE_GO` | **NO** |
| `PRODUCTION_REDEPLOY_GO` | **NO** |
| `PRODUCTION_ENV_CHANGE_GO` | **NO** |
| `PRODUCTION_BROWSER_ACCEPTANCE_GO` | **NO** |
| `STAGING_AUTH_MUTATION_GO` | **NO** |
| `STAGING_DATABASE_MUTATION_GO` | **NO** |
| `SCHEMA_MUTATION_GO` / `MIGRATION_GO` | **NO** |

---

## Package OD-PA-03 — Identity matrix

| Field | Value |
|-------|--------|
| Decision code | **HYBRID** |
| Required | Production SUPER_ADMIN or equivalent; unauthenticated public smoke; minimum additional Production-safe identities; explicit waivers for unavailable roles |
| Identity creation | **Not authorized** by this decision |
| Execution matrix | Incomplete until Production-safe identities / waivers are named for the execution window |
| GO token | `PRODUCTION_IDENTITY_COVERAGE_GO` remains **NO** |

---

## Package OD-PA-04 — Phase 5 limitation disposition for Production

| Field | Value |
|-------|--------|
| Decision code | **APPROVE_RECOMMENDED_DISPOSITIONS** |
| Authorization | Dispositions approved for planning/execution design only — **not** Production activation |

| Limitation | Bound disposition |
|------------|-------------------|
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

| Field | Value |
|-------|--------|
| Decision code | **APPROVE_PARTIAL_BINDING_MERGE_FREEZE_AND_DEFAULT_THRESHOLDS** |
| GO token | `PRODUCTION_OPS_BINDING_GO` remains **NO** until owners/window bound |

### Bound now

| Field | Bound value |
|-------|-------------|
| Merge freeze during window | **YES** |
| Rollback if white screens | **> 0** |
| Rollback if auth redirect loop | **≥ 1** |
| Rollback if public route outage | **≥ 1** |
| Rollback if privilege bypass | **≥ 1** |
| Rollback if wrong-tenant exposure | **≥ 1** |
| Rollback if critical navigation route failure | **≥ 1** |

### Remain unbound until execution window

| Field | Status |
|-------|--------|
| Deployment owner | **UNBOUND** |
| Rollback owner | **UNBOUND** |
| Monitoring owner | **UNBOUND** |
| Exact maintenance / acceptance window | **UNBOUND** |
| Monitoring duration | **UNBOUND** |
| Monitoring interval | **UNBOUND** |
| Operator identity (Production-safe) | **UNBOUND** |

---

## Package OD-PA-06 — Flag and deploy mechanics attestation

| Field | Value |
|-------|--------|
| Decision code | **MECHANICS_ACKNOWLEDGED_LIVE_ATTESTATION_PENDING** |
| GO token | `PRODUCTION_FLAG_MECHANICS_GO` remains **NO** until live attestation |

| Check | Status |
|-------|--------|
| Vite build-time flag evaluation | **Acknowledged** |
| Redeploy required after flag change | **Acknowledged** |
| Auto Production deploy on `main` merge (OBS-P5-PM-01) | **Acknowledged** |
| Rollback = flag OFF + Production redeploy | **Acknowledged** |
| Live Production flag attestation (Vercel OFF/absent) | **PENDING** |
| Vercel project / Production target confirmation | Confirm at execution window |

---

## Package OD-PA-07 — COACH disposition

| Field | Value |
|-------|--------|
| Decision code | **OPTION_A_CONTINUE_COACH_WAIVER** |
| COACH | Remains **`WAIVED_WITH_KNOWN_SCHEMA_GAP`** |
| Backlog | `BL-P5-COACH-ROLE-SCHEMA` remains a separate workstream |
| Schema / identity mutation in nav activation window | **Not authorized** |

---

## Binding record

| Package | Decision code | Bound by | Date | SHA / reference |
|---------|---------------|----------|------|-----------------|
| OD-PA-01 | OPTION_A | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |
| OD-PA-02 | PLANNING_ONLY_EXECUTION_GOS_REMAIN_NO | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |
| OD-PA-03 | HYBRID | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |
| OD-PA-04 | APPROVE_RECOMMENDED_DISPOSITIONS | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |
| OD-PA-05 | APPROVE_PARTIAL_BINDING_MERGE_FREEZE_AND_DEFAULT_THRESHOLDS | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |
| OD-PA-06 | MECHANICS_ACKNOWLEDGED_LIVE_ATTESTATION_PENDING | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |
| OD-PA-07 | OPTION_A_CONTINUE_COACH_WAIVER | Owner | 2026-08-06 | PR #388 @ `1a5d54d6e3a1796a408db3334c0f7a8b0f303b86` |

---

## Explicit non-actions (still in force)

- Do not set Production `VITE_CANONICAL_APP_SHELL_ENABLED=true`  
- Do not Redeploy Production for this flag  
- Do not promote Preview  
- Do not mutate Staging Auth/DB/schema  
- Do not treat this planning package as a Production execution package  
- Do not open an activation PR that changes runtime unless separately scoped and GO-bound  

---

## Safety

This file records Owner planning decisions only. No environment or Production mutation is authorized or performed by binding these packages.
