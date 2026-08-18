-- ═══════════════════════════════════════════════════════════════════
-- 90_ROLLBACK.sql
-- Package: shared-referee-match-execution-init-capability-01
-- LOCAL AUTHORING ONLY. Do NOT execute on Staging/Production.
-- Drops only the new initializer RPC. Does not drop match_live_states.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.referee_v5_initialize_match_execution_state(
  text, text, text, text, text, text, text, jsonb, text, text
);
