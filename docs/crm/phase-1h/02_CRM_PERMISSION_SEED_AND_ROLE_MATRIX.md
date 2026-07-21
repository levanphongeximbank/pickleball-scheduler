# 02 — CRM Permission Seed and Role Matrix (Phase 1H-A)

**Status:** PROPOSED — awaiting Owner apply approval. Not applied.

## Permission seed set

Source: exact strings from `CRM_PERMISSION_VALUES` in
`src/features/crm/constants/permissions.js`.

SQL: `docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql`
JS mirror: `src/features/crm/identity/crmPermissionSeedDefinitions.js`

| Permission | Seeded |
|------------|--------|
| crm.lead.view / create / update / assign | yes |
| crm.opportunity.view / create / update | yes |
| crm.pipeline.manage | yes |
| crm.interaction.view / create | yes |
| crm.task.view / create / update / assign | yes |
| crm.tag.create / view / update / assign | yes |
| crm.consent.create / view / revoke | yes |
| crm.campaign.view / manage | yes |
| crm.audit.view | yes (pending-event / audit; reused, not invented) |

**Not invented:** `crm.opportunity.assign` (absent from CRM constants).

Properties:

- Seed each permission once
- Idempotent re-run (`WHERE NOT EXISTS`)
- No role grants in permission seed file
- No Production IDs / real user IDs / secrets

## Proposed role matrix (separately reviewable)

SQL: `docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql`
JS: `src/features/crm/identity/crmRolePermissionMatrix.js`

| Role (DB id) | CRM grants |
|--------------|------------|
| SUPER_ADMIN | All `crm.%` (platform convention) |
| TENANT_OWNER / VENUE_OWNER / COURT_OWNER | All CRM permissions |
| VENUE_MANAGER / COURT_MANAGER | All except `crm.campaign.manage`, `crm.pipeline.manage` |
| STAFF | Limited view + create (lead/opportunity view, interaction/task create, tag/consent/campaign view) |
| PLAYER / CUSTOMER / others | **None** (explicit deny) |

### Fail-closed guarantees

- No anonymous assignment
- No authenticated-global grant
- No Customer/Player CRM administration by default
- No invented CRM_OPERATOR role
- Venue roles remain JWT venue-scoped via RLS (`user_venue_id`)
- Owner approval required before any future apply

## Owner review checklist

- [ ] Permission catalog strings match CRM constants
- [ ] Role matrix acceptable for Staging
- [ ] STAFF scope acceptable
- [ ] No unintended roles granted
- [ ] Apply approval recorded for Phase 1H-B
