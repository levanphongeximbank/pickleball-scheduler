# Wave 5 — service_role direct Club DML guard (design only)

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
SQL_EXECUTED=NO
RLS_EXECUTED=NO
SERVICE_ROLE_DIRECT_DML_GUARD_DESIGNED=YES
PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE
```

Do **not** execute. This is a temporary maintenance-window guard for the Wave 5 Club cutover, **not** a permanent revoke of `service_role` table privileges, and **not** platform-default ACL hardening.

## Authority

```
ONE_ACTIVE_CUTOVER_BATCH=YES
CUTOVER_STATE_MACHINE=YES
```

One durable cutover batch authority: `public.wave5_club_cutover_batch`. No parallel state machine.

## Lifecycle (ordered)

```
Q0A_SERVICE_ROLE_DIRECT_DML_QUIESCE
  → Q1A_RPC_ENTRYPOINT_QUIESCE
  → Q1B_POST_COMMIT_QUIESCED_SEAL
  → DRAIN
  → APPLY
  → VERIFY
  → RESTORE
```

| Step | Artifact | Batch role |
|---|---|---|
| Q0A | `10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql` | **Creates** the single `PREPARED` batch; snapshots + REVOKEs `service_role` Club table DML |
| Q1A | `07A_QUIESCE_WRITES_DESIGN.sql` | Requires existing `wave5.cutover_batch_id` in `PREPARED`; does **not** create a second batch; RPC EXECUTE quiesce |
| Q1B | `07A2_QUIESCE_SEAL_DESIGN.sql` | Reasserts RPC **and** direct DML quiesced; `PREPARED` → `QUIESCED`; sets `quiesce_visible_at` |
| Drain / APPLY / VERIFY | `07B` / `07B2` / `02` / `03` / `03B` | APPLY prelock + VERIFIED gate require `service_role` still DENIED on Club table DML |
| Pre-APPLY restore | `07C_RESTORE_WRITES_DESIGN.sql` | Exact restore of RPC ACL **and** snapshotted `service_role` table DML (PREPARED/QUIESCED/DRAINED only) |
| Post-VERIFIED restore | `07D_RESTORE_INTENDED_WRITES_DESIGN.sql` | Intended public command surface + exact `service_role` table DML from snapshot |

```
QUIESCED_MEANS_ALL_KNOWN_WRITER_SURFACES_CLOSED=YES
APPLY_PRELOCK_SERVICE_ROLE_DIRECT_DML=DENIED
VERIFIED_BEFORE_SERVICE_ROLE_RESTORE=YES
POST_APPLY_VERIFY_FAILURE_KEEP_QUIESCED=YES
```

Post-APPLY VERIFY failure keeps `service_role` quiesced. Do **not** run `07C` from `APPLIED` / `VERIFIED`.

## Scope (exact)

| Dimension | Value |
|---|---|
| Grantee | `service_role` only |
| Tables | `public.clubs`, `public.club_members`, `public.club_governance_assignments`, `public.club_membership_requests_v42` |
| Privileges | `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` |

Out of scope for this guard: `SELECT` / `REFERENCES` / `TRIGGER`, non-Club tables, `anon` / `authenticated` / `PUBLIC` table DML (those must already be DENIED; Q0A aborts if not), RPC EXECUTE (Q1A), `ALTER DEFAULT PRIVILEGES`.

```
PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE
WAVE5_DEFAULT_ACL_MUTATION=NO
```

## Snapshot table

`public.wave5_cutover_table_privilege_snapshot`

| Column | Notes |
|---|---|
| `batch_id` | FK → `wave5_club_cutover_batch(batch_id)` ON DELETE/UPDATE RESTRICT |
| `captured_at` | Capture timestamp |
| `schema_name` | Catalog `name` |
| `table_name` | Catalog `name` |
| `grantee_name` | Role name (`service_role` only in this package) |
| `privilege_type` | `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` only |
| `is_grantable` | Exact grant-option bit from `aclexplode` |

```
PRIMARY KEY (batch_id, schema_name, table_name, grantee_name, privilege_type)
```

Control-plane ACL: `REVOKE ALL` from `PUBLIC` / `anon` / `authenticated`; RLS enabled; no application policies. Same denial posture as `wave5_club_cutover_batch` and `wave5_cutover_rpc_privilege_snapshot`.

Capture uses `aclexplode(relacl)`. Helpers must refuse unknown tables or privilege types outside the certified set.

## Effective deny (not catalog-only)

Q0A REVOKEs then verifies with `has_table_privilege('service_role', table, priv) = false` for every scoped table × privilege. If privilege remains via `PUBLIC`, role inheritance, or ownership side-effects, **ABORT** — do not seal quiesce on a false sense of revoke.

## BYPASSRLS

```
SERVICE_ROLE_BYPASSRLS_UNCHANGED=YES
```

Q0A does **not** change `rolbypassrls`. BYPASSRLS alone does **not** grant table DML when privileges are DENIED. Direct DML still requires the privilege bits this guard removes for the window.

## Canonical mutation authority

```
SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO
```

`service_role` direct Club table DML is an infrastructure / ops capability class, **not** Club business-domain canonical mutation authority. Canonical Club writes remain the reviewed mutation RPC surface (Q1A/Q1B/07D intended command path).

## Restore semantics

- **07C**: GRANT only privileges present in `wave5_cutover_table_privilege_snapshot` for the explicit batch; respect `is_grantable`; verify final effective privileges equal snapshot; no generic full-DML `GRANT`. Reconstruction failure → rollback / abort; keep writers quiesced.
- **07D**: Same exact table-DML restore from snapshot after `VERIFIED` only; `anon` / `authenticated` remain DENIED on Club table DML; restore is infrastructure capability restore, not domain authority.

## Operator note

After Q0A COMMIT, operator must:

```sql
SET wave5.cutover_batch_id = '<batch_id from Q0A NOTICE>';
```

before Q1A / Q1B / drain / APPLY.
