# 02 — Canonical QA Quarantine Data Model

**Selected model:** C2 — Dedicated authority table  
**Canonical object:** `public.qa_identity_quarantines`  
**`profiles.status` change required:** NO  
**`profiles_status_check` change required:** NO  
**`auth_ban_applied` (boolean):** REMOVED — replaced by `auth_ban_state` lifecycle

## Design intent

QA quarantine is an **operations control** over certified test identities. It must not overload real account lifecycle values on `public.profiles.status` (`active | suspended | invited`).

Auth ban is a **complementary** access control. Auth ban alone is **not** canonical quarantine state. Canonical quarantine requires a fully activated authority row (see active success invariant).

## Selected canonical data model (planning — not executable SQL)

### Table: `public.qa_identity_quarantines`

| Column | Type | Null | Mutability | Notes |
|--------|------|------|------------|-------|
| `id` | `uuid` | NO | Immutable after insert | PK; default `gen_random_uuid()` |
| `profile_id` | `uuid` | NO | **Immutable** | FK → `public.profiles(id)` ON DELETE RESTRICT |
| `auth_user_id` | `uuid` | NO | **Immutable** | FK → `auth.users(id)` ON DELETE RESTRICT |
| `venue_id` | `text` | YES | **Immutable** | Canonical tenant binding snapshot (`profiles.venue_id`) |
| `batch_id` | `uuid` | NO | **Immutable** | Execution batch correlation |
| `source_operation` | `text` | NO | **Immutable** | e.g. `OPERATION_B1B` |
| `allowlist_sha256` | `text` | YES | **Immutable** | Artifact correlation (allowlist byte hash) |
| `snapshot_sha256` | `text` | YES | **Immutable** | Artifact correlation (recovery snapshot hash) |
| `lifecycle_state` | `text` | NO | Lifecycle | `pending` \| `active` \| `released` \| `failed` |
| `auth_ban_state` | `text` | NO | Lifecycle | See state machine below |
| `reason` | `text` | NO | **Immutable** | Original quarantine reason (non-empty) |
| `created_at` | `timestamptz` | NO | **Immutable** | Prepare time |
| `created_by` | `text` | NO | **Immutable** | Actor at prepare |
| `activated_at` | `timestamptz` | YES | Lifecycle | Set on successful activation |
| `released_at` | `timestamptz` | YES | Lifecycle | Set on release |
| `released_by` | `text` | YES | Lifecycle | Actor who released |
| `release_reason` | `text` | YES | Lifecycle | Release rationale |
| `failure_classification` | `text` | YES | Lifecycle | e.g. `auth_ban_failed`, `activation_failed_compensated`, `compensation_incomplete` |
| `lifecycle_version` | `integer` | NO | Lifecycle | Optimistic concurrency token; starts at 1; increments on every controlled transition |
| `original_profile_status` | `text` | NO | **Immutable** | Snapshot only — profiles row must remain unchanged |
| `original_auth_banned` | `boolean` | NO | **Immutable** | Pre-quarantine Auth ban snapshot |
| `expected_email` | `text` | NO | **Immutable** | Allowlist email binding (minimize PII in shareable evidence) |
| `allowlist_label` | `text` | YES | **Immutable** | Exact-eight only: Production `QA-04…QA-11` **or** Staging `STG-QA-04…STG-QA-11`. Cross-environment reuse is **forbidden**. |
| `metadata` | `jsonb` | NO | Restricted | Default `{}`; must not become alternate SSOT; controlled writers may append audit keys only if explicitly allowed |
| `updated_at` | `timestamptz` | NO | Lifecycle | Row maintenance timestamp |

### `auth_ban_state` values (exact meanings)

| Value | Meaning |
|-------|---------|
| `pending` | Authority prepared; Auth ban not yet confirmed for this operation. Row is **not** fully activated. |
| `applied` | Operation B1B applied Auth ban and independent readback proved success; activation completed. |
| `not_required_preexisting` | Original snapshot proved Auth already banned; activation completed **without** claiming B1B applied that ban. |
| `reverted` | Auth ban was successfully applied by B1B then deterministically unbanned during compensation; authority is not active. |
| `failed` | Terminal non-active failure (Auth ban failed, or compensation/activation failure recorded without an active quarantine). |

### Active success invariant

A quarantine is **fully activated** (`lifecycle_state='active'`) if and only if:

```text
auth_ban_state IN ('applied', 'not_required_preexisting')
```

- Auth ban alone ≠ quarantine.
- `lifecycle_state='pending'` with any `auth_ban_state` ≠ fully activated.
- Directory/ops “quarantined” read must require `lifecycle_state='active'` **and** terminal successful Auth-ban state above.

### Primary and foreign keys

- **PK:** `id`
- **FK:** `profile_id` → `public.profiles(id)`
- **FK:** `auth_user_id` → `auth.users(id)`
- **Binding invariant:** `profile_id = auth_user_id` (CHECK)

### Uniqueness rules

1. At most one **active** quarantine per profile: unique partial index on `(profile_id)` WHERE `lifecycle_state = 'active'`
2. At most one **active** quarantine per auth user: unique partial index on `(auth_user_id)` WHERE `lifecycle_state = 'active'`
3. At most one **pending** prepare per profile per batch (recommended unique partial on `(profile_id, batch_id)` WHERE `lifecycle_state = 'pending'`)
4. Released / failed / reverted history is append-only; re-quarantine requires a **new** row under **new** authority (new GO/batch as required)

### Check constraints (planned)

| Constraint | Rule |
|------------|------|
| `qa_identity_quarantines_lifecycle_state_check` | `lifecycle_state in ('pending','active','released','failed')` |
| `qa_identity_quarantines_auth_ban_state_check` | `auth_ban_state in ('pending','applied','not_required_preexisting','reverted','failed')` |
| `qa_identity_quarantines_identity_bind_check` | `profile_id = auth_user_id` |
| `qa_identity_quarantines_reason_nonempty_check` | `length(trim(reason)) > 0` |
| `qa_identity_quarantines_original_status_check` | `original_profile_status in ('active','suspended','invited')` |
| `qa_identity_quarantines_active_success_check` | `(lifecycle_state <> 'active') OR (auth_ban_state in ('applied','not_required_preexisting') AND activated_at IS NOT NULL)` |
| `qa_identity_quarantines_release_consistency_check` | `(lifecycle_state = 'released' AND released_at IS NOT NULL AND released_by IS NOT NULL) OR (lifecycle_state <> 'released')` |
| `qa_identity_quarantines_pending_auth_check` | `(lifecycle_state <> 'pending') OR (auth_ban_state = 'pending' AND activated_at IS NULL)` |

### Immutable fields (database-enforced)

Immutable after creation (INSERT):

- `profile_id`, `auth_user_id`, `venue_id` (tenant binding)
- `batch_id`, `source_operation`
- `original_auth_banned`, `original_profile_status`
- `created_at`, `created_by`, `reason`
- `allowlist_sha256`, `snapshot_sha256`, `expected_email`, `allowlist_label`
- `id`

**Enforcement:** BEFORE UPDATE trigger (or equivalent) that rejects mutation of immutable columns. The trigger **must apply to service_role UPDATEs** as well. RLS alone is insufficient because `service_role` bypasses RLS.

Mutable lifecycle fields only via controlled writers:

- `lifecycle_state`, `auth_ban_state`, `activated_at`
- `released_at`, `released_by`, `release_reason`
- `failure_classification`, `lifecycle_version`, `updated_at`
- narrowly defined metadata append keys (if any)

Hard DELETE of quarantine rows is prohibited for normal operations (trigger/RPC deny).

### Retention policy (non-destructive)

```text
RETENTION_POLICY=INDEFINITE_APPEND_ONLY_AUDIT
AUTOMATIC_PURGE_IN_OPERATION_B1B=NO
HARD_DELETE_NORMAL_OPS=NO
```

- Released, failed, and reverted rows are **retained indefinitely** as append-only audit history unless a **separate future governance-approved retention workstream** defines archival/deletion.
- No automatic purge in Operation B1B.
- Audit and batch correlation must remain available.
- Personal data minimization: shareable evidence masks emails/ids; do not duplicate secrets or unnecessary PII into `metadata`.
- Archival/deletion outside this policy requires a separate Owner-governed workstream — not B1B execute/rollback.

### Indexes (planned) — including set-based read support

| Index | Purpose |
|-------|---------|
| PK on `id` | Primary access |
| Unique partial `(profile_id) WHERE lifecycle_state='active'` | One active quarantine; set-based join key |
| Unique partial `(auth_user_id) WHERE lifecycle_state='active'` | Identity bind uniqueness |
| `(batch_id, lifecycle_state)` | Batch rollback / postcheck |
| `(lifecycle_state, created_at desc)` | Inventory |
| `(profile_id) WHERE lifecycle_state='active'` covering/read | Directory anti-N+1 joins / batched `IN` lookups |
| `(venue_id)` optional | Tenant audit filters |

### Controlled writer transitions

Every transition requires:

- AuthZ (SUPER_ADMIN RPC or service-role runner path)
- Expected-state / optimistic concurrency: match `id` + `lifecycle_version` (+ expected `lifecycle_state` / `auth_ban_state`)
- Fail closed on version mismatch
- **No uncontrolled direct DML**

#### 1. `qa_quarantine_prepare`

Creates authority row:

- `lifecycle_state='pending'`
- `auth_ban_state='pending'`
- snapshots immutable originals
- after identity, reference, artifact, batch, and authorization gates pass

Does **not** apply Auth ban. Does **not** create an active quarantine.

#### 2. `qa_quarantine_activate_after_auth_ban`

Called **only after** independent Auth ban readback proves success.

Atomic transition:

```text
lifecycle_state: pending → active
auth_ban_state:  pending → applied
activated_at: set
lifecycle_version: +1
```

#### 3. `qa_quarantine_activate_preexisting_ban`

Used **only when** `original_auth_banned=true`.

```text
lifecycle_state: pending → active
auth_ban_state:  pending → not_required_preexisting
activated_at: set
lifecycle_version: +1
```

Must **not** claim Operation B1B applied the preexisting ban.

#### 4. `qa_quarantine_record_compensated_failure`

Records that a successful Auth ban was subsequently reverted (or that prepare/activation failed) through controlled state:

Typical transitions:

```text
pending + pending → failed   (Auth ban never succeeded; or prepare-side failure recording)
pending + pending → reverted (after Auth ban success, unban compensation verified, activation abandoned)
```

Sets `failure_classification`, increments `lifecycle_version`. Leaves **no** active quarantine.

#### 5. `qa_quarantine_release`

Releases a fully activated quarantine:

```text
lifecycle_state: active → released
released_at / released_by / release_reason set
lifecycle_version: +1
```

Runner unban rule (Auth Admin API):

```text
UNBAN_ONLY_IF auth_ban_state='applied' AND original_auth_banned=false
```

Must **never** unban an originally banned user (`original_auth_banned=true` or `auth_ban_state='not_required_preexisting'`).

### Dual-write execution sequence (mandatory)

```text
A. qa_quarantine_prepare → pending/pending
B. Apply Auth ban IFF original_auth_banned=false
C. Independently read back Auth ban state
D. Controlled activation writer (after_auth_ban OR preexisting)
E. Independently read back active authority state
```

Auth ban alone is never canonical quarantine. Activation without Auth readback is forbidden.

### Dual-write failure boundaries

#### Boundary 1 — Prepare fails before Auth ban

- No Auth mutation
- Zero active quarantine
- Fail closed

#### Boundary 2 — Prepare succeeds; Auth ban fails

- Transition pending → `lifecycle_state='failed'` / `auth_ban_state='failed'` via controlled writer
- No active quarantine
- No unban required
- Fail closed
- GO/batch consumption: if no Auth mutation occurred, batch may still be retired per runner policy once live execute was presented; retry needs new authority artifacts as defined in runner plan

#### Boundary 3 — Auth ban succeeds; activation writer fails (**critical split**)

- Immediately attempt deterministic Auth unban **only if** `original_auth_banned=false`
- Verify unban via independent readback
- Record `auth_ban_state='reverted'` (or `failed` with `failure_classification='compensation_incomplete'`) via `qa_quarantine_record_compensated_failure`
- **No active quarantine may remain**
- If unban or failure-state recording cannot be verified → classify **critical compensation incomplete**
- **Owner GO and batch are consumed once the Auth ban mutation occurred**
- Retry requires **new** authority (new GO/batch/artifacts); never reuse the same pending row as a silent retry without governance

#### Boundary 4 — Activation succeeds; post-activation verification fails

- Release or compensate through controlled writer
- Unban only when `auth_ban_state='applied'` and `original_auth_banned=false`
- Verify both authority and Auth state
- Unresolved drift → **critical**

#### Boundary 5 — Impossible split (e.g. Auth banned with no expected authority row)

- Classify as **security / integrity incident**
- Stop all remaining identities
- Do **not** silently recreate or infer state
- Use exact recovery snapshot + separately governed recovery handling

### Exact Auth / profile binding

Writers must verify before prepare:

1. `profiles.id = profile_id`
2. `auth.users.id = auth_user_id`
3. `profile_id = auth_user_id`
4. Live email matches allowlist expected email (certified QA predicate)
5. Identity is on the exact-eight allowlist for the batch

Ambiguous mapping ⇒ fail closed (no prepare, no Auth ban).

### Tenant relationship

- `venue_id` is an **immutable** tenant snapshot
- Quarantine authority is platform ops (SUPER_ADMIN / service-role), not tenant self-service
- Tenant owners must **not** create or release quarantine rows

### Idempotency behavior

| Situation | Behavior |
|-----------|----------|
| Active row already exists for same profile/auth and same `batch_id` with successful auth_ban_state | No-op success (`already_quarantined`) |
| Pending row same identity+batch awaiting activation | Continue from Auth readback/activation only if gates still valid; do not double-ban blindly |
| Active row exists for different `batch_id` | Fail closed (`active_quarantine_other_batch`) unless explicit release first |
| Failed/reverted/released history exists | New prepare requires new authorization per protocol |

### Drift behavior

Detect and fail closed when:

- Active quarantine exists but profile/auth/email no longer match snapshot
- `profiles.status` differs from `original_profile_status`
- Live Auth ban disagrees with (`auth_ban_state`, `original_auth_banned`) expectations
- Allowlist/snapshot hash or batch id mismatch
- Boundary-5 impossible splits

### Compatibility projectors (non-authority)

- Virtual `qaQuarantined = true` only when `lifecycle_state='active'` **and** `auth_ban_state in ('applied','not_required_preexisting')`
- Do **not** write `profiles.status = 'quarantined'`
- Do **not** treat Auth ban alone or `privacy_settings` as quarantine SSOT

### Explicit non-goals

- Extending `profiles_status_check`
- Using `suspended` as quarantine
- Boolean `auth_ban_applied` as success contract
- Storing quarantine solely in metadata JSON
- Hard-delete Auth or profiles
- Automatic purge of authority history in B1B
