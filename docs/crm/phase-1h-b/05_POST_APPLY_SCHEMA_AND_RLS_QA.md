# 05 — Post-Apply Schema and RLS QA

**Status:** **EXECUTED** (structural live Staging via MCP)
**Environment:** Staging `qyewbxjsiiyufanzcjcq`
**Production probes:** never
**QA identities / JWT behavioral probes:** **NOT AVAILABLE** (`CRM_STAGING_QA_IDENTITIES_READY` unset)

## Checklist (live Staging)

| # | Verification | Result |
|---|--------------|--------|
| 1 | Four CRM tables exist | **PASS** (`crm_tags`, `crm_tag_assignments`, `crm_consent_records`, `crm_pending_events`) |
| 2 | Required indexes exist | **PASS** (claim/list indexes + PK/UQ indexes present) |
| 3 | Constraints exist | **PASS** (PK/UQ/CHECK/FK as authored) |
| 4 | RLS enabled | **PASS** (all four) |
| 5 | RLS forced | **PASS** (all four `relforcerowsecurity=true`) |
| 6 | Expected policies | **PASS** (11 authenticated policies; names match authored SQL) |
| 7 | Same-scope tenant/venue enforcement | **PASS** (`crm_phase1g_scope_allows` requires both ids = `user_venue_id()`) |
| 8 | Consent immutability trigger | **PASS** (`crm_consent_records_immutable_trg` enabled) |
| 9 | No PUBLIC/anon table grants | **PASS** (0 rows) |
| 10 | Claim/release RPC no PUBLIC/anon EXECUTE | **PASS** |
| 11 | Scope helper anon EXECUTE residual | **OBSERVED** (`crm_phase1g_scope_allows` still executable by `anon`; function remains fail-closed on `auth.uid()` / `user_venue_id()`) |
| 12 | Authenticated table privilege surplus vs grant SQL | **OBSERVED** (default privileges leave extra DML bits on `authenticated`; RLS + missing DELETE policies still constrain) |

## Indexes confirmed (non-exhaustive)

Includes: `crm_tags_tenant_venue_normalized_code_idx`, `crm_tags_tenant_venue_active_idx`, `crm_tags_tenant_venue_normalized_name_tag_id_idx`, `crm_tag_assignments_tenant_venue_target_idx`, `crm_tag_assignments_tenant_venue_tag_id_idx`, consent contact/channel/purpose + time indexes, `crm_pending_events_claim_queue_idx`, `crm_pending_events_claim_expires_at_idx`, plus PK/UQ indexes.

## Policies confirmed

| Table | Policies |
|-------|----------|
| `crm_tags` | select, insert, update |
| `crm_tag_assignments` | select, insert, delete |
| `crm_consent_records` | select, insert |
| `crm_pending_events` | select, insert, update |

No anon policies. No DELETE policy on tags/consent/pending_events.

## Blockers remaining for identity-bound QA

Cross-tenant JWT denial and permission-positive paths require dedicated Staging QA identities (see doc 08). Structural schema/RLS QA above is complete without them.
