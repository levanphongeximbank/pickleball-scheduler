# 02 — Canonical QA Quarantine Data Model

**Selected model:** C2 — Dedicated authority table  
**Canonical object:** `public.qa_identity_quarantines`  
**`profiles.status` change required:** NO  
**`profiles_status_check` change required:** NO

## Design intent

QA quarantine is an **operations control** over certified test identities. It must not overload real account lifecycle values on `public.profiles.status` (`active | suspended | invited`).

Auth ban remains a complementary access control (`auth.users` / Admin API `ban_duration`), recorded and correlated by this authority, not by mutating `profiles.status`.

## Selected canonical data model (planning — not executable SQL)

### Table: `public.qa_identity_quarantines`

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `id` | `uuid` | NO | Primary key; default `gen_random_uuid()` |
| `profile_id` | `uuid` | NO | FK → `public.profiles(id)` ON DELETE RESTRICT |
| `auth_user_id` | `uuid` | NO | FK → `auth.users(id)` ON DELETE RESTRICT |
| `venue_id` | `text` | YES | Tenant snapshot at quarantine time (`profiles.venue_id`) |
| `batch_id` | `uuid` | NO | Execution batch correlation |
| `state` | `text` | NO | `active` \| `released` |
| `reason` | `text` | NO | Human/operator reason (non-empty) |
| `created_at` | `timestamptz` | NO | Quarantine applied at |
| `created_by` | `text` | NO | Actor identity (service principal / operator subject id) |
| `released_at` | `timestamptz` | YES | Set when released |
| `released_by` | `text` | YES | Actor who released |
| `release_reason` | `text` | YES | Optional release rationale |
| `original_profile_status` | `text` | NO | Snapshot only — must remain unchanged on profiles row |
| `original_auth_banned` | `boolean` | NO | Pre-quarantine Auth ban flag |
| `auth_ban_applied` | `boolean` | NO | Whether this operation applied Auth ban |
| `expected_email` | `text` | NO | Allowlist email binding (for drift checks; store masked in artifacts only) |
| `allowlist_label` | `text` | YES | e.g. QA-04…QA-11 label |
| `metadata` | `jsonb` | NO | Default `{}`; audit extras only — **not** primary quarantine authority |
| `updated_at` | `timestamptz` | NO | Row maintenance timestamp |

### Primary and foreign keys

- **PK:** `id`
- **FK:** `profile_id` → `public.profiles(id)`
- **FK:** `auth_user_id` → `auth.users(id)`
- **Binding invariant:** `profile_id = auth_user_id` (Pick_VN identity alignment: `profiles.id` references `auth.users.id`). Enforce with CHECK.

### Uniqueness rules

1. **At most one active quarantine per profile:**
   - Unique partial index on `(profile_id)` WHERE `state = 'active'`
2. **At most one active quarantine per auth user:**
   - Unique partial index on `(auth_user_id)` WHERE `state = 'active'`
3. Historical released rows may accumulate (append-style history). Re-quarantine creates a **new** active row only after prior active row is released.

### Check constraints (planned)

| Constraint | Rule |
|------------|------|
| `qa_identity_quarantines_state_check` | `state in ('active', 'released')` |
| `qa_identity_quarantines_identity_bind_check` | `profile_id = auth_user_id` |
| `qa_identity_quarantines_reason_nonempty_check` | `length(trim(reason)) > 0` |
| `qa_identity_quarantines_release_consistency_check` | `(state = 'active' AND released_at IS NULL AND released_by IS NULL) OR (state = 'released' AND released_at IS NOT NULL AND released_by IS NOT NULL)` |
| `qa_identity_quarantines_original_status_check` | `original_profile_status in ('active', 'suspended', 'invited')` |

### Timestamps and actor identity

- `created_at` / `created_by` required on insert
- `released_at` / `released_by` required on release transition
- Actors are operator/service subjects recorded by controlled writers — never arbitrary end-user self-attribution without service-role / SUPER_ADMIN path

### Reason and batch correlation

- `reason` mandatory on quarantine
- `batch_id` mandatory — ties every row to one execution batch
- Batch-scoped rollback and drift detection use `(batch_id, state)`

### Active versus released state

| State | Meaning |
|-------|---------|
| `active` | Identity is QA-quarantined for directory/ops purposes; Auth ban expected if `auth_ban_applied` |
| `released` | Quarantine ended; Auth restored per original snapshot rules |

No hard delete of quarantine rows in normal operations (append + release).

### Exact Auth / profile binding

Writers must verify **before insert**:

1. `profiles.id = profile_id`
2. `auth.users.id = auth_user_id`
3. `profile_id = auth_user_id`
4. Live email matches allowlist expected email (certified QA predicate)
5. Identity is on the exact-eight allowlist for the batch

Ambiguous mapping ⇒ fail closed (no insert, no Auth ban).

### Tenant relationship

- `venue_id` is a **snapshot** for audit and tenant-scoped audit reads
- Quarantine authority is platform ops (SUPER_ADMIN / service-role), not tenant self-service
- Tenant owners must **not** create or release quarantine rows

### Indexes (planned)

| Index | Purpose |
|-------|---------|
| PK on `id` | Primary access |
| Unique partial `(profile_id) WHERE state = 'active'` | One active quarantine |
| Unique partial `(auth_user_id) WHERE state = 'active'` | Identity bind uniqueness |
| `(batch_id, state)` | Batch rollback / postcheck |
| `(state, created_at desc)` | Active inventory |
| `(venue_id)` optional | Tenant audit filters |

### Lifecycle

```text
[eligible allowlisted identity]
        │
        ▼
 INSERT state=active (idempotent if already active for same bind+batch)
        │
        ▼
 apply Auth ban (if not already banned)
        │
        ▼
 postcheck: active row + Auth state match snapshot rules
        │
        ▼
 RELEASE → state=released (restore Auth if this op banned and original was unbanned)
```

`profiles.status` is **read for snapshot only** and never written by B1B quarantine writers.

### Invariants

1. `profiles.status` unchanged by quarantine/release writers.
2. Exactly zero or one `state='active'` row per identity.
3. Active row implies certified QA allowlist membership at create time (enforced in writer, not by email CHECK alone).
4. Release restores Auth only when `auth_ban_applied = true` and `original_auth_banned = false`.
5. No hard delete of Auth users or profiles.
6. Real-user emails / non-allowlisted ids never insert.

### Idempotency behavior

| Situation | Behavior |
|-----------|----------|
| Active row already exists for same profile/auth and same `batch_id` | No-op success (`already_quarantined`) |
| Active row exists for different `batch_id` | Fail closed (`active_quarantine_other_batch`) unless explicit release first |
| Released row exists; new quarantine | Insert new active row (new id) under new or same batch per GO rules |
| Auth already banned and active row exists | Skip ban; mark `auth_ban_applied` consistent with truth |

### Drift behavior

Detect and fail closed when:

- Active quarantine exists but profile_id/auth_user_id/email no longer match snapshot
- `profiles.status` differs from `original_profile_status` (external lifecycle change during quarantine)
- Auth ban state disagrees with `(auth_ban_applied, original_auth_banned)` expectations
- Allowlist hash / batch id mismatch on rollback

Drift ⇒ no automatic mutate; require operator investigation and separate rollback GO when needed.

### Compatibility projectors (non-authority)

For temporary runtime compatibility only (see `07_RUNTIME_AND_FILTER_MIGRATION_MAP.md`):

- Virtual `qaQuarantined = true` when an active quarantine row exists
- Do **not** write `profiles.status = 'quarantined'`
- Do **not** treat `privacy_settings` or unstructured profile JSON as quarantine SSOT

### Explicit non-goals

- Extending `profiles_status_check`
- Using `suspended` as quarantine
- Storing quarantine solely in `privacy_settings` / ad-hoc metadata
- Hard-delete Auth or profiles
