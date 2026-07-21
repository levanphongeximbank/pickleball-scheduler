# 04 — Phase 1B Acceptance Criteria

**Status:** Checklist

---

## Must pass

- [x] Phase 1A docs under `docs/crm/phase-1a/`
- [x] Module skeleton: ARCHITECTURE, COMPATIBILITY, index, constants, models, contracts, authorization, memory repos, adapters, projectors
- [x] Legacy pages/services not deleted
- [x] New domain not wired into existing UI
- [x] Mandatory tenantId + venueId; no demo-club in new code
- [x] `crm.*` permission constants defined (not Identity SQL)
- [x] Fail-closed authorization foundation
- [x] In-memory repos isolate tenant/venue and instances
- [x] Menu CRM paths → PARTIAL; routes intact
- [x] Focused Phase 1B tests pass
- [x] Existing CRM LS tests still pass
- [x] No SQL / Supabase / deploy / commit in this phase

## Phase 1C entry conditions

1. Phase 1B committed after owner review.
2. Lead application services may persist via memory repos first.
3. Still no SQL until 1G/1H.
4. Still no UI rewrite until 1J (unless owner expands scope).
