# 06 — Permission and Role Matrix QA

**Status:** **EXECUTED** (permission seed live; role matrix deferred)
**Staging project ref:** `qyewbxjsiiyufanzcjcq`
**MCP:** `supabase-staging` only

## Permission seed

| Item | Result |
|------|--------|
| Seed SQL path | `docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql` |
| Owner seed apply approval | **APPROVED** |
| Applied to Staging | **YES** (order 7 / `crm_phase_1h_10_permission_seed`) |
| Exact CRM permission rows (`id LIKE 'crm.%'`) | **24** — **PASS** |
| Duplicate CRM permission ids | **0** — **PASS** |
| Code marker disposition | Applied on Staging; role grants still deferred |

### Live CRM permission ids (24)

`crm.audit.view`, `crm.campaign.manage`, `crm.campaign.view`, `crm.consent.create`, `crm.consent.revoke`, `crm.consent.view`, `crm.interaction.create`, `crm.interaction.view`, `crm.lead.assign`, `crm.lead.create`, `crm.lead.update`, `crm.lead.view`, `crm.opportunity.create`, `crm.opportunity.update`, `crm.opportunity.view`, `crm.pipeline.manage`, `crm.tag.assign`, `crm.tag.create`, `crm.tag.update`, `crm.tag.view`, `crm.task.assign`, `crm.task.create`, `crm.task.update`, `crm.task.view`

## Role matrix

| Item | Result |
|------|--------|
| Matrix SQL path | `docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql` |
| Owner matrix apply approval | **DEFERRED / NOT APPROVED** |
| Applied this session | **NO** |
| Live CRM `role_permissions` rows (`permission_id LIKE 'crm.%'`) | **0** — **PASS** (deferred migration not applied) |
| Unexpected CRM role grants | **NONE observed** |

## Owner review still required

Role matrix remains Owner-gated. Do not treat Staging seed success as matrix approval.
