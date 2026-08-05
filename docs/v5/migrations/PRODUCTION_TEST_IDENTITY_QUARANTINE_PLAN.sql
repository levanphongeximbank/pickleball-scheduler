-- ============================================================================
-- TEST IDENTITY QUARANTINE PLAN (NOT APPLIED)
-- Source audit: docs/v5/qa-evidence/production-player-data-remediation/
-- Production GO = NO. Do not execute until owner review.
-- ============================================================================

-- Preferred reversible quarantine for SAFE_TO_QUARANTINE (9):
--   1) profiles.status = 'quarantined' (or soft flag)
--   2) auth.users banned_until far future (optional)
--   3) exclude via app filter (qaTestIdentityFilter) — already implemented in app
-- Hard delete is NOT the default.

-- For REFERENCED_CONTROLLED_CLEANUP_REQUIRED (2):
--   memberships currently status='removed' on club-219e4a7cbd73437eb6271f02a53314c3
--   Ordered plan:
--     a) confirm no active tournament/team refs (audit: teamRefCount=0)
--     b) quarantine profile
--     c) leave removed membership rows as historical evidence OR archive
--     d) hard-delete auth user only after explicit GO + backup

-- Smoke script safeguard (code change separate from this SQL):
--   Production smoke must either cleanup ephemeral users OR mark email domains
--   @pickleball-scheduler.qa / @prod-qa.local and rely on excludeQaTestIdentities.
