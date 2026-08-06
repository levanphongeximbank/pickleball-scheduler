# 08 — Runner Remediation Plan

**Target:** Future Operation B1B live operator runner (implementation WP4)  
**Planning only** — do not implement in this corrective docs commit  
**Retired B1 write target:** `profiles.status = 'quarantined'`  
**Boolean `auth_ban_applied`:** REMOVED — use `auth_ban_state`

## Design principles

1. No `profiles.status` mutation
2. First durable write = `qa_quarantine_prepare` (`pending`/`pending`)
3. Auth ban only when originally unbanned; always independent readback
4. Full activation only via controlled activation writers
5. Auth ban alone is not quarantine
6. Fail closed; stop on first unresolved live failure
7. Hard delete unavailable
8. Fresh GO / batch / hashes only — never reuse retired B1 artifacts
9. GO/batch consumed once Auth ban mutation occurs

## No `profiles.status` mutation

Forbidden: any quarantine path writing `quarantined` or using `suspended` as substitute.  
Allowed: read `profiles.status` for immutable snapshot / drift only.

## Controlled authority writers (runner adapters)

| Adapter / RPC | Purpose |
|---------------|---------|
| `qa_quarantine_prepare` | Create pending authority after gates |
| `qa_quarantine_activate_after_auth_ban` | pending→active, auth_ban_state→applied |
| `qa_quarantine_activate_preexisting_ban` | pending→active, auth_ban_state→not_required_preexisting |
| `qa_quarantine_record_compensated_failure` | Record failed/reverted; no active left |
| `qa_quarantine_release` | active→released |

All transitions carry expected-state + `lifecycle_version` guards. No direct table DML.

## Mandatory dual-write sequence (A–E)

```text
A. qa_quarantine_prepare → lifecycle_state=pending, auth_ban_state=pending
B. Apply Auth ban IFF original_auth_banned=false
C. Independently read back Auth state
D. Activation writer (after_auth_ban OR preexisting)
E. Independently read back active authority
   (lifecycle_state=active AND auth_ban_state IN (applied, not_required_preexisting))
```

## Failure boundaries and compensation

### Boundary 1 — Prepare fails before Auth ban

- No Auth mutation
- Zero active quarantine
- Fail closed

### Boundary 2 — Prepare succeeds; Auth ban fails

- Controlled transition to `failed`
- No active quarantine
- No unban required
- Fail closed

### Boundary 3 — Auth ban succeeds; activation fails (**explicit critical split**)

1. Immediate deterministic unban if `original_auth_banned=false`
2. Verify unban via independent Auth readback
3. `qa_quarantine_record_compensated_failure` → `reverted` (or `failed` + `compensation_incomplete`)
4. Assert no active quarantine
5. If unban or failure recording unverifiable → **critical compensation incomplete**; stop batch
6. **Owner GO and batch are consumed** because Auth mutation occurred
7. Retry requires **new** authority (new GO/batch/artifacts); do not reuse the same pending row as an unauthorized silent retry

### Boundary 4 — Activation succeeds; post-activation verification fails

- Controlled release/compensate
- Unban only if `auth_ban_state='applied'` AND `original_auth_banned=false`
- Verify authority + Auth; unresolved drift = critical

### Boundary 5 — Impossible split (Auth banned without expected authority)

- Security/integrity incident
- Stop all remaining identities
- Do not silently recreate/infer state
- Exact recovery snapshot + separately governed recovery

## Rollback order

1. Drift / version checks
2. `qa_quarantine_release` for actives
3. Unban only when `auth_ban_state='applied'` AND `original_auth_banned=false`
4. Never unban preexisting bans

## Idempotency

| State | Forward result |
|-------|----------------|
| Already fully activated for same bind+batch | No-op success |
| Pending awaiting activation | Continue from Auth readback/activation only under gates |
| No row | Prepare → ban path → activate |
| Failed/reverted/released history | New prepare under new authorization as required |

## Exact allowlist / artifact / batch binding

- Live bind: profile_id, auth_user_id, expected_email; `profile_id = auth_user_id`
- Certified QA email; exact-eight labels; zero forbidden refs; B2 exclusions honored
- Byte SHA-256 match for allowlist + snapshot
- New batch UUID; reject retired:
  - `b37186cf-e620-4f27-aba3-d7e8750ae7df`
  - `9c9d5fc7-648e-44c6-a959-e62157f7c970`
- Store `batch_id` + artifact hashes immutably on prepare

## Project-ref and fail-closed gates

Wrong project ref / missing fresh GO / bad hashes / dry-run default → zero mutations.

## GO consumption and batch retirement

| Event | GO/batch |
|-------|----------|
| Dry-run only | Not consumed |
| Live execute presented but zero Auth mutations and prepare never durable | Per runner evidence policy; prefer retire batch on live attempt |
| **Any Auth ban mutation occurred** | **GO and batch consumed** (even if activation fails / compensated) |
| Successful full activation batch | Consumed |
| Retry after Auth mutation | **New** GO + batch + artifacts required |

## Post-execution verification

For each target:

- Fully activated authority (`active` + successful auth_ban_state) or documented terminal failed/reverted
- `profiles.status` equals original
- Auth matches intended end state
- No non-target mutations
- Sanitized evidence

## Mapping from B1A surfaces

| B1A | B1B |
|-----|-----|
| `updateProfileStatus` | Remove |
| `banAuthUser` / `unbanAuthUser` | Keep (between prepare and activate / on release) |
| Single apply writer | Split prepare / activate / compensated_failure / release |
| Status=`quarantined` constant | Deleted from write path |
| Retired GO/batch lists | Include B1 failed batch; never authorize |

## Explicit non-goals

- Retry Operation B1 as-is
- Extend CHECK to allow `quarantined`
- Implement runner in this docs commit
