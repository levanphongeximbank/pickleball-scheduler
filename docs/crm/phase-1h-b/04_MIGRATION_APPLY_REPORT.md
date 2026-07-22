# 04 — Migration Apply Report

**Mode executed:** controlled Staging apply via verified MCP
**SQL applied:** **YES** (orders 1–7 only)
**Apply channel:** MCP `supabase-staging` (`project-0-crm-supabase-staging`)
**Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production connected:** **NO**
**Deploy:** **NO**
**Local `SUPABASE_ACCESS_TOKEN` required:** **NO** (MCP path)
**Credentials logged:** **NO**
**Automatic rollback:** **NO** (not invoked)
**Role matrix applied:** **NO**

## Final apply verdict

`CRM_PHASE_1H_B_STAGING_APPLY_COMPLETE_QA_IDENTITIES_REQUIRED`

## Pre-apply gates proven

| Gate | Result |
|------|--------|
| MCP server exactly `supabase-staging` | PASS |
| Target project ref exactly `qyewbxjsiiyufanzcjcq` | PASS (MCP URL `project_ref`) |
| Production MCP / Production project not selected | PASS |
| Manifest SHA-256 match for orders 1–7 | PASS (re-verified immediately before apply) |
| Apply subset orders 1–7 only | PASS |
| Deferred role matrix order 8 excluded | PASS |
| Recovery evidence + rollback SQL present | PASS |
| Durable runtime OFF | PASS |
| No deploy / worker activation | PASS |

## Exact migrations applied

| Order | Migration name (MCP) | Path | SHA-256 | Result |
|------:|----------------------|------|---------|--------|
| 1 | `crm_phase_1g_10_tables` | `docs/crm/phase-1g/10_CRM_PHASE_1G_TABLES.sql` | `0b722ad23be05d3e7985fe077c61d4e9f8cc163bd140c75b8f9f321b92945d8a` | success |
| 2 | `crm_phase_1g_20_indexes` | `docs/crm/phase-1g/20_CRM_PHASE_1G_INDEXES.sql` | `426faa1e0df05a9affce4aa8bd216aef18ce6cd30c392109f6072a7802fa4979` | success |
| 3 | `crm_phase_1g_30_rls` | `docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql` | `a15c49cf38ba2ec03c3d3da6352f3dff63b6966c5d283b134ec8916bc045d50a` | success |
| 4 | `crm_phase_1g_40_claim_release_rpcs` | `docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql` | `e0479ee060d484f13c8fd17384c7cd971c940f26eafa44f0f9d1ba3613c6ba2a` | success |
| 5 | `crm_phase_1g_50_grants` | `docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql` | `834d2d8757d11ddeba443e39e3bee1ebc5aa98b7e1f428053204b474330b8dfd` | success |
| 6 | `crm_phase_1g_60_consent_immutable` | `docs/crm/phase-1g/60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql` | `12a80394d5730e0d3b4ae462a6b5aa6ea00720fc8e8a8d63e03629c2ffdcb274` | success |
| 7 | `crm_phase_1h_10_permission_seed` | `docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql` | `2db66238391d39de992c2848d142ef0f42a515be2e252d67de2ff178e891512b` | success |

Stop-on-first-error: no failures; all seven returned MCP `{"success":true}`.

## Exact migrations deferred

| Order | Path | Reason |
|------:|------|--------|
| 8 | `docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql` | Deferred / not approved; not executed |

## Sanitized execution evidence

- MCP migration versions recorded on Staging include:
  `crm_phase_1g_10_tables` … `crm_phase_1h_10_permission_seed` (20260722002325–20260722002537).
- No Production MCP calls.
- No secrets / connection strings printed.
