# 07 — Runtime and Filter Migration Map

## Inventory method

Repository review (planning base `3c6c3f02`) of quarantine-related runtime signals. No Staging/Production queries performed.

## Existing `status === 'quarantined'` consumers

| Location | Role | Classification |
|----------|------|----------------|
| `src/features/player/utils/qaTestIdentityFilter.js` | Treats `status==='quarantined'` as confirmed QA | **MIGRATE** |
| B1 quarantine engine / constants / live adapters | Writes/expects status quarantined | **REPLACE** in B1B runner |
| B1 docs / historical quarantine plan SQL | Assumed status quarantine | **SUPERSEDED** (do not edit in this task) |
| B1 tests | Mock status quarantined | **REWRITE** under WP5 |

## Existing `qaQuarantined` / `quarantined` boolean consumers

| Location | Role | Classification |
|----------|------|----------------|
| `identity.quarantined === true` | Hide | **KEEP** compatibility |
| `identity.meta?.qaQuarantined === true` | Hide | **KEEP** temporary via projector |
| Durable `profiles.meta.qaQuarantined` column | N/A | **NOT SSOT** |

## Test identity exclusion / QA email domains

Certified-email helpers and `excludeQaTestIdentities` remain. Quarantine authority is an additional confirmed signal for fully activated rows.

Exclusion fixture (lookalike only): `phase1b-smith@gmail.com` — documented rejection case; not a private Production dump.

## Auth ban vs quarantine authority

| Signal | Role |
|--------|------|
| Auth `banned_until` | Complementary access control |
| Fully activated authority row | **Canonical** quarantine |
| Auth ban alone | **Not** canonical quarantine |

B1B sequence: prepare → (Auth ban if needed) → Auth readback → activate → authority readback.

## Account suspension / inactivity / archived-deleted

`profiles.status='suspended'` remains distinct and must not be reused for QA quarantine. Hard delete forbidden.

## Writers

| Writer | B1B rule |
|--------|----------|
| `identity_admin_update_user` | Real lifecycle only |
| B1A `updateProfileStatus` | Removed from quarantine path |
| Lifecycle RPCs (prepare/activate/fail/release) | **Canonical** |
| Auth Admin ban/unban | After prepare; before/with activation rules |

## Compatibility mapping

| Legacy signal | Temporary dual-read | Final canonical read |
|---------------|---------------------|----------------------|
| `status === 'quarantined'` | Legacy read only | Deprecate (expect zero legal rows) |
| `meta.qaQuarantined` | Accepted | Projector from activated authority |
| `quarantined === true` | Accepted | Projector |
| `lifecycle_state='active'` AND `auth_ban_state in ('applied','not_required_preexisting')` | New | **Canonical** |
| Certified QA email | Directory hygiene | Remains defense-in-depth |

## Anti-N+1 requirement (MANDATORY)

Directory, roster, admin list, and bulk profile consumers **must** obtain QA quarantine state through **one** of:

1. Canonical database view or read RPC joining active quarantine authority
2. One set-based join in the profile/directory query
3. One bounded batched profile-ID lookup for the **entire page/result set**

### Explicitly prohibited

- One `qa_identity_quarantines` query per profile
- One RPC per list row
- Unbounded client-side sequential lookups

### Bounded query-count acceptance gate

For any paginated directory/list read:

```text
quarantine_authority_queries_per_page = O(1)
independent_of_row_count = YES
MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE = 1
```

(plus the primary page query itself). Integration tests **must** assert this maximum query count.

Indexes supporting set-based active `profile_id` lookup/join are required (see data model / forward migration).

Single-id `is_active` helpers may exist for ops tooling only — not for list rendering loops.

## Migration sequence (runtime)

1. WP1/WP2: schema + lifecycle RPCs + set-based read interface
2. WP3a: projector/helper reading **activated** authority only
3. WP3b: update `isConfirmedQaTestIdentity` (authority first; legacy dual-read)
4. WP3c: directory/list surfaces use set-based enrichment (anti-N+1)
5. WP4: runner prepare/ban/activate (no status mutation)
6. WP5: constraint + query-count + Boundary 3 fault-injection tests
7. WP6: Staging smoke including Auth-ban rehearsal (mandatory)

## Temporary compatibility behavior

```text
isConfirmedQaTestIdentity =
  fullyActivatedQuarantineAuthority
  OR quarantined flag
  OR meta.qaQuarantined
  OR status === 'quarantined'   -- legacy read only
  OR isCertifiedQaEmail(email)
```

Never persist `status='quarantined'`.

## Final canonical read behavior

```text
isQaQuarantined =
  lifecycle_state='active'
  AND auth_ban_state IN ('applied','not_required_preexisting')

isConfirmedQaTestIdentity =
  isQaQuarantined OR isCertifiedQaEmail(email) [+ approved flags]
```

## UI / directory / auth behavior

- Directories exclude confirmed QA identities via set-based data
- Admin may show ops badge from authority read (SUPER_ADMIN)
- Account status UI continues to show legal `profiles.status` values only
- Auth ban blocks login when applied; suspended users keep existing denial paths

## No-impact proof for real users

1. Non-allowlisted profiles never receive authority rows in rehearsal
2. Non-target `profiles.status` unchanged
3. Lookalike `phase1b-smith@gmail.com` rejected by certified email predicate
4. Real suspensions remain `suspended` semantics
5. Anti-N+1 list reads do not weaken tenant isolation
