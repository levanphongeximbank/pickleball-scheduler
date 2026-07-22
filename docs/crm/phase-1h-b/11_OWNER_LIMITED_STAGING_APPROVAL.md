# 11 — Owner Limited Staging Approval (recorded)

**Recorded:** 2026-07-22
**Machine-readable:** `OWNER_LIMITED_STAGING_APPROVAL.json`
**Secrets included:** none

## Granted (Staging only)

| Decision | Status |
|----------|--------|
| Phase 1G CRM persistence migrations | **APPROVED** for controlled Staging apply |
| Phase 1H CRM permission seed | **APPROVED** for controlled Staging apply |
| Limited Staging apply umbrella (approved subset only) | **APPROVED** |

## Explicitly not approved

| Decision | Status |
|----------|--------|
| Phase 1H role-permission matrix (`20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql`) | **NOT APPROVED — DEFER** |
| Production apply | **NOT APPROVED** |
| Durable CRM runtime activation | **NOT APPROVED** |
| Deployment | **NOT APPROVED** |
| Background workers / provider delivery | **NOT APPROVED** |
| Backup / restore | **NOT APPROVED** (do not infer readiness) |

## Expected migration subset

**Approved for apply (when all remaining gates pass):**

1. `docs/crm/phase-1g/10_CRM_PHASE_1G_TABLES.sql`
2. `docs/crm/phase-1g/20_CRM_PHASE_1G_INDEXES.sql`
3. `docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql`
4. `docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql`
5. `docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql`
6. `docs/crm/phase-1g/60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql`
7. `docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql`

**Deferred:**

8. `docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql`
