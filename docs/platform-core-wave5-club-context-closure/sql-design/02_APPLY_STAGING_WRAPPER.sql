-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Reviewed Staging wrapper. Sets wave5.target_env only.
-- Does not SET lock_timeout. APPLY derives STAGING_LOCK_TIMEOUT=5s
-- and statement_timeout=60s via SET LOCAL set_config after BEGIN.
-- Run this in the same session before 02_APPLY_DESIGN.sql.
-- STAGING_LOCK_TIMEOUT=5s
-- UNBOUNDED_LOCK_WAIT=NO

SET wave5.target_env = 'staging';
