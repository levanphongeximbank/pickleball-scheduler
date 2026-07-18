# 11 — Staging Validation Plan

**Do not run now.** Future sequence after Owner-approved executable SQL.

1. **Pre-flight:** confirm Staging Supabase project ref; backup/snapshot available  
2. **Apply migration on Staging only** (idempotent script)  
3. **Schema inspection:** columns, defaults, CHECKs, comments  
4. **Constraints:** insert invalid handedness/verification/future date → reject  
5. **RLS:** anon cannot select sensitive raw; self can update own demographics; peer cannot; admin path as designed  
6. **Owner self-update test** via `updatePlayerProfile` + durable repo  
7. **Unauthorized update rejection**  
8. **Admin-authorized update** (verification status)  
9. **Private data read rejection** for public projector  
10. **Public profile read** (defaults fail-closed)  
11. **Repository write + read-after-write**  
12. **Regression:** Phase 1B facade, Phase 1C field tests, unit suite, lint, build  
13. **Rollback drill** on Staging  

Record evidence under `docs/player-management/phase-1c-migration-design/qa-evidence/` in a later task.
