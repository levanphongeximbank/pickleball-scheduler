# Pre-Staging Capability Remediation

**Branch target:** `feature/platform-hard-cutover-01-pre-staging-capability-remediation`
**Base:** `origin/main` @ `52af9241` (PR #329 merged)
**Marker:** `PLATFORM_HARD_CUTOVER_01_PRE_STAGING_CAPABILITY_REMEDIATION_PR_READY`

## Workstreams delivered (code/docs/tests only)

1. Authority matrix expansion (`runtimeAuthorityMatrix.js`) — 26 domains
2. Coaching hard cutover — never LEGACY under HC; UNAVAILABLE if durable not activated
3. Messaging hard cutover — never DEMO under HC; PRODUCTION or UNAVAILABLE
4. Dashboard analytics hard cutover — no mock/LS SoT under HC; typed UNAVAILABLE
5. Executable reseed packages under `sql/reseed/` — **not executed**
6. Staging acceptance expansion — `STAGING_ACCEPTANCE_EXPANDED.md`

## Absolute restrictions honored

- Database writes = 0
- Staging mutations = 0
- Production mutations = 0
- No feature flag changes
- No deploy
- No Auth mutation
- No wipe / DROP / reseed execution
