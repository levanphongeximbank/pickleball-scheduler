# 04 — RLS Security Certification (Phase 1G tables / Phase 1H-A review)

**Status:** CERTIFIED (static). No SQL applied. No live DB.

## Tables reviewed

- `crm_tags`
- `crm_tag_assignments`
- `crm_consent_records`
- `crm_pending_events`

Source: `docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql`, `50_CRM_PHASE_1G_GRANTS.sql`, `60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql`

## Certification matrix

| Rule | Result |
|------|--------|
| RLS enabled | PASS — ENABLE + FORCE on all four |
| Same tenant and venue required | PASS — `crm_phase1g_scope_allows` |
| Required permission checked | PASS — `user_has_permission` / `is_super_admin` |
| No anonymous access | PASS — policies `TO authenticated`; REVOKE anon |
| No broad PUBLIC grants | PASS — REVOKE ALL FROM PUBLIC |
| No role-name-only authorization | PASS — permission keys, not role strings |
| No existence leakage across scope | PASS — scope predicate on all policies |
| No unsafe nullable helper fallback | PASS — null `user_venue_id` denies |
| INSERT WITH CHECK scoped | PASS |
| UPDATE USING + WITH CHECK scoped | PASS (tags, pending events) |
| DELETE restricted to tag assignments | PASS — only assignments DELETE policy |
| Consent UPDATE/DELETE blocked | PASS — no policies + immutability trigger |
| Pending-event mutation restricted | PASS — `crm.audit.view` / super-admin only |

## Corrective migration

**None required.** Phase 1G SQL meets fail-closed criteria under `SAME_SCOPE_MODEL_VERIFIED`. Prefer additive Phase 1H corrective migration only if future Identity dual-scope lands.

## Permission seeding dependency

Non–super-admin JWT access requires Phase 1H permission seeds (`crm.tag.*`, `crm.consent.*`, `crm.audit.view`) before Staging apply. Catalog + role matrix remain unapplied in Phase 1H-A.
