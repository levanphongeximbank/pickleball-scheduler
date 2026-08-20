-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Reviewed Production wrapper. Sets wave5.target_env only.
-- Does not SET lock_timeout. APPLY derives PRODUCTION_LOCK_TIMEOUT=15s
-- and statement_timeout=180s via SET LOCAL set_config after BEGIN.
-- Run this in the same session before 02_APPLY_DESIGN.sql.
-- PRODUCTION_LOCK_TIMEOUT=15s
-- UNBOUNDED_LOCK_WAIT=NO

SET wave5.target_env = 'production';
