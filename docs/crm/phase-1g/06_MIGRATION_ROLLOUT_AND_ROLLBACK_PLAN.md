# 06 — Migration Rollout and Rollback Plan (Phase 1G)

**Status:** Plan only — **SQL authored but not applied**

---

## Phase 1G confirmation

- SQL was **authored** under `docs/crm/phase-1g/*.sql`
- SQL was **not applied** anywhere
- No Staging or Production connection
- No deployment

## Apply order (future — not this phase)

1. `10_CRM_PHASE_1G_TABLES.sql`
2. `20_CRM_PHASE_1G_INDEXES.sql`
3. `30_CRM_PHASE_1G_RLS.sql`
4. `40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql`
5. `50_CRM_PHASE_1G_GRANTS.sql`
6. `60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql` (optional but recommended)

## Required before any Production apply

1. **Backup / restore point** taken and verified
2. **Staging validation** of schema, RLS, RPCs, and application adapters
3. **RLS and RPC security review** (permissions seeded, grants, search_path)
4. **Migration SHA pinning** (commit SHA of applied SQL files recorded)
5. **Rollback decision point** approved by owner
6. CRM permission keys present in Identity `role_permissions` for non-admin access

## Rollback sketch

1. Drop claim/release RPCs and grants
2. Drop RLS policies + `crm_phase1g_scope_allows`
3. Drop consent immutability trigger (required before any consent DELETE maintenance)
4. Drop indexes
5. Drop tables only if empty / approved data loss — prefer leave tables and disable app feature flags

Consent trigger rollback implication: schema maintenance that must mutate consent history requires an explicit controlled `DROP TRIGGER` path, then recreate.

## Out of scope for Phase 1G

- No deployment
- No worker enablement
- No provider delivery
