# 07 — Staging Migration Manifest (Phase 1H-A)

**Machine-readable:** `docs/crm/phase-1h/staging-migration-manifest.json`
**Helpers:** `src/features/crm/staging/migrationManifest.js`

## Controlled sequence (order)

1. Phase 1G tables
2. Phase 1G indexes
3. Phase 1G RLS
4. Phase 1G claim/release RPCs
5. Phase 1G grants
6. Phase 1G consent immutability
7. Phase 1H permission seed
8. Phase 1H role-permission assignment

Each entry includes: relative path, SHA-256, purpose, expected objects, rollback classification, precondition, postcondition, transaction-safe flag, manual review flag.

## Verification failures

`verifyCrmStagingMigrationManifest()` fails when:

- A migration file changes after SHA pinning
- A pinned file is missing
- Order differs from contiguous 1..N
- Unknown numbered `*_CRM_PHASE_1G/H_*.sql` appears under controlled dirs

## Phase 1H-A boundary

Manifest is authored and statically verified only. **Do not apply migrations.**
