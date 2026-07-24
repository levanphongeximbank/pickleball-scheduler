# EC-00 — Experience Channel Architecture & Ownership Foundation

**Phase:** EC-00  
**Module:** `src/features/experience-channels/`  
**Runtime wiring:** none

## What landed

- Stable experience-channel descriptors and classification contract
- Route / shell / provider ownership registries
- Competition E2E ownership / defer markers
- PWA / mobile / public readiness metadata (future native = metadata only)
- Architecture certification (`certifyExperienceChannelRegistry`)
- Foundation unit tests

## What did not land

- No imports into `src/main.jsx`, `src/router.jsx`, or provider trees
- No UI / navigation / auth / tenant changes
- No Competition UI edits
- No SQL / notification backend / native mobile frameworks

## Evidence

- Audit based on fresh `origin/main` in worktree `experience-channels-00-foundation`
- Competition E2E branch diff is limited to `src/features/competition-engine/**` + docs/tests (no router/shell collision)
