# PLATFORM-HARD-CUTOVER-01 Phase 4 — README

**Marker:** `PLATFORM_HARD_CUTOVER_01_PHASE_04_PR_READY_FOR_OWNER_MERGE`

Phase 4 authors implementation packages only:

- Destructive SQL (not applied)
- M8 Competition Remote SSOT schema/RPC/adapters (not applied)
- Runtime authority matrix + legacy fail-closed wiring
- Rating cutover policy helpers
- Migration/runtime/reseed/staging manifests
- Automated acceptance tests

**Forbidden in this phase:** Staging/Production SQL apply, wipe, drop, Vercel flag changes, Prod redeploy, Auth changes.

See `IMPLEMENTATION_MANIFEST.json` and `manifests/`.
