# 05 — Rollback and Recovery Plan

**Scope:** Planning for future implementation and Staging/Production operations  
**Hard delete:** Forbidden  
**PITR:** Last resort only; not the primary quarantine rollback tool

## Layers of rollback

| Layer | What rolls back | Typical trigger |
|-------|-----------------|-----------------|
| L1 Migration rollback | Drop/disable new quarantine schema objects | Failed Staging apply / bad migration |
| L2 Runtime rollback | Feature flags / filter dual-read removal | App regression after filter cutover |
| L3 Quarantine-entry rollback | `active` → `released` + Auth restore | Operator rollback GO / rehearsal |
| L4 Batch-scoped rollback | All rows for one `batch_id` | Partial or full batch undo |
| L5 Emergency PITR | Database point-in-time | Only if irreversible corruption (unexpected) |

## Migration rollback

Order (reverse of forward apply):

1. Revoke EXECUTE on writer RPCs
2. Drop writer/read functions
3. Drop compatibility views
4. Drop policies; disable RLS if dropping table
5. Drop indexes
6. Drop table `public.qa_identity_quarantines` **only if empty or Staging disposable**
7. Verify `profiles` and `profiles_status_check` untouched

Production migration rollback requires a **separate rollback Owner GO** if the forward migration GO was consumed.

If Production quarantine rows exist, prefer L3/L4 release before any DROP.

## Runtime rollback

- Keep dual-read compatibility long enough to revert app filter to previous behavior without data loss
- Feature flag (future): `VITE_QA_QUARANTINE_AUTHORITY_V1` or ops equivalent — default off until Staging smoke passes
- Reverting runtime must not require illegal `profiles.status` writes

## Quarantine-entry rollback (exact original-state restoration)

For each identity in scope:

1. Load quarantine row + recovery snapshot artifact
2. Drift detection (see below)
3. If `state='active'`: transition to `released` with `released_by` / `released_at` / `release_reason`
4. Auth restore:
   - If `auth_ban_applied=true` AND `original_auth_banned=false` → unban
   - If `original_auth_banned=true` → leave Auth ban unchanged
5. Verify `profiles.status === original_profile_status` (must already match; **do not** rewrite status unless an out-of-band incident changed it — that is a separate incident)
6. Record audit event

Exact original state means:

- Profile status unchanged throughout (already original)
- Auth ban restored to pre-batch boolean reality
- Quarantine authority no longer active

## Batch-scoped rollback

1. Select all `qa_identity_quarantines` where `batch_id = :batch` and `state='active'`
2. Fail closed if count ≠ expected allowlist size (unless documented partial failure set)
3. Release each row deterministically in stable order (e.g. allowlist label sort)
4. Stop on first unresolved failure; emit compensation report
5. Postcheck: zero active rows for batch; Auth states match originals

## Drift detection

Fail closed (no mutate) when any hold:

| Drift code | Condition |
|------------|-----------|
| `profile_missing` | Profile id absent |
| `auth_missing` | Auth user absent |
| `identity_bind_mismatch` | `profile_id ≠ auth_user_id` live |
| `email_mismatch` | Live email ≠ snapshot/allowlist expected |
| `profile_status_drift` | Live `profiles.status` ≠ `original_profile_status` |
| `auth_ban_drift` | Live ban disagrees with expected post-quarantine state |
| `batch_mismatch` | Row batch_id ≠ rollback authorized batch |
| `not_active` | Row already released unexpectedly mid-batch |
| `allowlist_hash_mismatch` | Artifact SHA-256 mismatch |

## Fail-closed behavior

- Missing GO / wrong GO / reused GO → zero mutations
- Drift → skip identity, abort batch (configurable stop-on-first)
- Writer errors → no best-effort status hacks
- Never invent `profiles.status='quarantined'` during recovery

## Rollback acceptance gates

- [ ] All targeted active rows released
- [ ] Auth states match recovery snapshot originals
- [ ] `profiles.status` equals originals for all targeted ids
- [ ] No non-allowlisted identity mutated
- [ ] Audit events present for release actions
- [ ] Evidence package written (sanitized)
- [ ] Independent review of evidence

## Recovery artifact requirements

Future execution must create **fresh** artifacts (never reuse B1 retired paths/hashes):

| Artifact | Contents (sanitized in Git; full in secure backup) |
|----------|-----------------------------------------------------|
| Exact-eight allowlist | profile_id, auth_user_id, expected_email, label, refs |
| Original-state recovery snapshot | original_profile_status, original_auth_banned, captured_at |
| Allowlist SHA-256 | Byte hash of allowlist file |
| Snapshot SHA-256 | Byte hash of snapshot file |
| Batch UUID | New UUID; not retired ids |
| Postcheck report | Masked ids/emails only in shareable evidence |

## PITR limitations

- PITR restores **entire project state** — collateral risk to unrelated Production data
- Not suitable for routine unquarantine
- Use only under Owner emergency GO when authority table/Auth Admin API cannot restore integrity
- Document RPO/RTO and forbidden if only quarantine rows are wrong but DB otherwise healthy

## Conditions requiring separate rollback Owner GO

A distinct rollback GO is required when:

1. Forward Production quarantine GO was consumed (success or partial)
2. Production migration forward apply was consumed and must be reversed
3. Emergency PITR is considered
4. Drift repair needs out-of-band profile status correction (should be rare; treat as incident)

Forward GO must **never** authorize rollback (preserve B1A lesson: separate rollback GO string).

## Retired artifacts cannot authorize rollback

```text
OLD_OWNER_GO_REUSABLE=NO
OLD_BATCH_REUSABLE=NO
```

Retired B1 GO/batch must not authorize L3/L4 Production rollback or re-apply.
