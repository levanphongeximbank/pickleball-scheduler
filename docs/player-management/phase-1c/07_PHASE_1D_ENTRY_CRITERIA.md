# 07 — Phase 1D Entry Criteria

Phase 1D (profile migration SQL + Staging readiness) may begin when:

1. Phase 1C write contract is Owner-approved and committed
2. Durable persistence + runtime bootstrap are merged (PR #64 / PR #69)
3. Schema migration plan is approved (Phase 1C migration design)
4. Phase 1B read + 1C write tests remain green
5. No Competition / tournament selection / rating algorithm changes unless separately approved
6. Identity verification remains distinct from rating verification in APIs and UI copy

**Phase 1D deliverable:** `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` (+ verify/rollback + Staging runbook).
**Not in Phase 1D:** Production apply, Phase 1E, Competition Engine changes.
