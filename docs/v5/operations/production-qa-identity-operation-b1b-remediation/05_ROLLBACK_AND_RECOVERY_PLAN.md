# 05 — Rollback and Recovery Plan

**Scope:** Planning for future implementation and Staging/Production operations  
**Hard delete:** Forbidden for normal operations  
**PITR:** Last resort only  
**Auth contract:** `auth_ban_state` lifecycle (not `auth_ban_applied`)

## Layers of rollback

| Layer | What rolls back | Typical trigger |
|-------|-----------------|-----------------|
| L1 Migration rollback | Drop/disable new quarantine schema objects | Failed Staging apply / bad migration |
| L2 Runtime rollback | Feature flags / filter dual-read removal | App regression after filter cutover |
| L3 Quarantine-entry rollback | `active` → `released` + conditional Auth restore | Operator rollback GO / rehearsal |
| L4 Batch-scoped rollback | All active rows for one `batch_id` | Partial or full batch undo |
| L5 Emergency / integrity recovery | Separately governed handling for Boundary 5 splits | Impossible Auth/authority divergence |
| L6 PITR | Database point-in-time | Only if irreversible corruption |

## Migration rollback

1. Revoke EXECUTE on lifecycle RPCs
2. Drop writer/read functions and active view
3. Drop policies; disable RLS if dropping table
4. Drop immutability triggers
5. Drop indexes
6. Drop table only if empty or Staging disposable
7. Verify `profiles` / `profiles_status_check` untouched

If Production quarantine rows exist, prefer L3/L4 release before any DROP.

## Runtime rollback

- Dual-read compatibility may remain during revert
- Must not require illegal `profiles.status` writes

## Quarantine-entry rollback (exact original-state restoration)

For each identity:

1. Load authority row + recovery snapshot
2. Drift detection
3. If `lifecycle_state='active'`: `qa_quarantine_release` (expected-state + `lifecycle_version`)
4. Auth restore rule:

```text
UNBAN_ONLY_IF auth_ban_state='applied' AND original_auth_banned=false
NEVER_UNBAN_IF original_auth_banned=true
NEVER_UNBAN_IF auth_ban_state='not_required_preexisting'
```

5. Verify `profiles.status === original_profile_status` (do not rewrite unless separate incident)
6. Audit event

Exact original state means: profile status unchanged; Auth ban restored to pre-batch reality; authority no longer active.

## Compensation for dual-write boundaries (rollback/recovery relevance)

### Boundary 1 — Prepare failed

No Auth mutation; nothing to unban; zero active rows.

### Boundary 2 — Prepare ok; Auth ban failed

Pending → failed via controlled writer; no unban; no active quarantine.

### Boundary 3 — Auth ban succeeded; activation failed (**explicit**)

1. Immediate deterministic unban if `original_auth_banned=false`
2. Independent Auth readback must prove restored original unbanned state
3. `qa_quarantine_record_compensated_failure` → `auth_ban_state='reverted'` (or `failed` + `compensation_incomplete`)
4. Assert **no** `lifecycle_state='active'`
5. If unban or failure recording unverifiable → **critical compensation incomplete**; stop batch; separately governed recovery
6. GO and batch are **consumed** because Auth mutation occurred; retry requires **new** authority

### Boundary 4 — Activation ok; postcheck fails

Controlled release/compensate; unban only when B1B applied the ban; unresolved drift = critical.

### Boundary 5 — Impossible split (Auth banned, no expected authority)

- Security/integrity incident classification
- Stop all remaining identities
- Do not silently recreate or infer authority rows
- Use exact recovery snapshot + separately governed recovery Owner handling

## Batch-scoped rollback

1. Select `lifecycle_state='active'` for `batch_id`
2. Fail closed if count ≠ expected (unless documented partial set)
3. Release deterministically; conditional unban per `auth_ban_state`
4. Stop on first unresolved failure
5. Postcheck: zero active rows; Auth matches originals

Also inventory non-active terminal rows (`failed`/`reverted`) for the batch in evidence — retained under indefinite append-only retention.

## Drift detection

| Drift code | Condition |
|------------|-----------|
| `profile_missing` | Profile absent |
| `auth_missing` | Auth user absent |
| `identity_bind_mismatch` | Live bind mismatch |
| `email_mismatch` | Live email ≠ expected |
| `profile_status_drift` | Live status ≠ `original_profile_status` |
| `auth_ban_drift` | Live ban disagrees with (`auth_ban_state`, `original_auth_banned`) |
| `lifecycle_version_conflict` | Optimistic concurrency mismatch |
| `batch_mismatch` | Row batch ≠ authorized batch |
| `not_active` | Expected active missing / unexpected state |
| `impossible_auth_authority_split` | Boundary 5 |
| `allowlist_hash_mismatch` | Artifact hash mismatch |

## Fail-closed behavior

- Missing/wrong/reused GO → zero mutations
- Drift / Boundary 5 → abort; no silent inference
- Never invent `profiles.status='quarantined'`
- Never unban originally banned users

## Retention during rollback

Released/failed/reverted rows remain; no hard delete; no automatic purge.

## Rollback acceptance gates

- [ ] All targeted active rows released
- [ ] Auth states match recovery originals under `auth_ban_state` rules
- [ ] `profiles.status` equals originals
- [ ] No non-allowlisted identity mutated
- [ ] Boundary 3 compensations (if any) verified or escalated critical
- [ ] Audit events present
- [ ] Evidence package written (sanitized)
- [ ] Independent review of evidence

## Recovery artifact requirements

Fresh artifacts only (never reuse retired B1 paths/hashes):

| Artifact | Contents |
|----------|----------|
| Exact-eight allowlist | bind fields, label, refs |
| Recovery snapshot | `original_profile_status`, `original_auth_banned`, captured_at |
| SHA-256 of both files | Byte hashes |
| Batch UUID | New; not retired |
| Postcheck report | Masked ids/emails only in shareable evidence |

## PITR limitations

Not for routine unquarantine. Emergency Owner GO only. High collateral risk.

## Conditions requiring separate rollback / recovery Owner GO

1. Forward Production quarantine GO consumed (incl. Auth mutation on Boundary 3)
2. Production migration reverse needed
3. Boundary 5 integrity incident
4. Emergency PITR
5. Out-of-band profile status incident repair

Forward GO never authorizes rollback.

```text
OLD_OWNER_GO_REUSABLE=NO
OLD_BATCH_REUSABLE=NO
```
