# Court Resource Phase 3A — Stage 3 certification

STAGING ONLY `project_ref=qyewbxjsiiyufanzcjcq`. Production was not mutated.
Phase 3B was not started.

## Locked payload

- File: `STAGE3_TT412_ATOMIC_RECONCILIATION.sql`
- SHA256: `911ef369af21af1fc85527a8728d3c8b5de6ac0d891445c609f1d881f5b8f5f6`
- Bytes: `10598`
- Line ending: LF, BOM: NO

## Sequence

1. First apply of the locked payload rolled back completely. No physical,
   access, cluster-mapping, legacy-mapping, or reservation rows remained.
2. Root cause: `public.court_resource_identity_guard()` evaluated
   `NEW.cluster_id` in the same `IF` expression as
   `TG_TABLE_NAME = 'court_resource_cluster_identity_mappings'` while
   inserting into `court_resource_legacy_court_identity_mappings`, which has
   no `cluster_id` column.
3. Staging was repaired with nested-IF isolation in
   `STAGE3_IDENTITY_GUARD_NESTED_IF_REPAIR.sql` (SHA256
   `b4c6b91c8fad949d993a2228d64bdfd8dce61aae21b621fa353ac0f5f57d09c9`,
   3889 bytes). Guard predicates were not weakened.
4. Second apply of the same locked payload succeeded atomically.

## Canonical identity (Staging)

| Key | Value |
| --- | --- |
| COURT_01_LEGACY_ID | tt412-court-01 |
| COURT_01_PHYSICAL_UUID | 952a6c15-a3c1-4cd4-9dee-6720bcf5e073 |
| COURT_02_LEGACY_ID | tt412-court-02 |
| COURT_02_PHYSICAL_UUID | 65c66b97-5522-4e09-b9b0-29ec61543370 |
| CLUSTER_ID | venue-staging-a-tt412-canonical-facility |
| CLUB_ID | club-ecebf64c78f948ccb2b59842441eb26c |
| PHYSICAL_COURT_ROWS | 2 |
| CLUB_ACCESS_ROWS | 2 (enabled) |
| LEGACY_MAPPING_ROWS | 2 (deterministic, club-data-v3 / 3) |
| CLUSTER_MAPPING_ROWS | 0 |
| COURT_RESERVATION_ROWS | 0 |

No secrets, JWTs, service-role tokens, or API keys are stored in this folder.
The payload only sets local `request.jwt.claim.*` GUC keys to a known actor
UUID for `auth.uid()` during the Staging transaction.
