# PRIVATE-PAIRING-HARD-CUTOVER-01

**Marker:** `PRIVATE_PAIRING_HARD_CUTOVER_01_PR_READY_FOR_OWNER_MERGE`

## End state (when `VITE_PLATFORM_HARD_CUTOVER_ENABLED=true`)

- `private_pairing_rules` registered in `runtimeAuthorityMatrix`
- Four canonical tables remain Rule SSOT; RPC-only writers
- Legacy blob picker forbidden (fail-closed)
- No silent rating default `3.5`; missing rating excludes / fail-closed
- Simulation remains read-only; no Competition finalize writes
- Player Rating remains read-only input

## Mutations

No Staging/Production SQL, wipe, DROP, reseed, deploy, or flag changes in this PR.
