# COACHING-04 — Staging Runtime Activation Pin

**Status:** `AWAITING_OWNER_GO`  
**Classification:** `COACHING_04_STAGING_RUNTIME_ACTIVATION_READY_AWAITING_OWNER_GO`  
**CODEX_DELETE_ALLOWED:** `NO`  
**Owner GO token:** `COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING` (**not granted**)  
**Retirement GO:** `COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT` (**not granted**)

## Pins

| Pin | Value |
|-----|-------|
| Target environment | Staging Preview only |
| Staging database | `qyewbxjsiiyufanzcjcq` |
| Production | untouched / refused (`expuvcohlcjzvrrauvud`) |
| PR #295 | MERGED |
| PR #295 head | `0e76c97a7fa9aabd9581f23c41d86f142b128feb` |
| PR #295 merge | `12b4b8592a8c06a1cf2601226178f72ae7079b5f` |
| Runtime package commit | `0e76c97a7fa9aabd9581f23c41d86f142b128feb` |
| Fresh `origin/main` (authoring) | `8ce23a6d1320d0a1c8d267ace885be227cbcd27c` |
| PR #292 certification | `fcecd79c2c0732e5bc7962fa1bfa91d6086818e6` |
| PR #292 merge | `98dedfc9814c4b81a6f3a5ffeae81aff9bf3bddd` |
| Mapping rows | `0` |
| PLAYER expected | `UNMAPPED` |
| `runtimeActivated` | `false` |
| `localStorageRetired` | `false` |
| `COACHING_DURABLE_RUNTIME_DEFAULT` | `false` |

## Staging gate (all required after Owner GO)

1. `VITE_APP_ENV=staging`
2. `VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED=true`
3. Valid Owner GO package bound to this activation commit + manifest hash
4. `VITE_SUPABASE_URL=https://qyewbxjsiiyufanzcjcq.supabase.co` (when set)

Production / unknown / non-staging / missing GO / wrong project ref → fail closed (legacy).

## Current pre-GO env expectation

| Key | Value |
|-----|-------|
| `VITE_APP_ENV` | `staging` (Preview) |
| `VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED` | `false` / unset |
| `VITE_SUPABASE_URL` | `https://qyewbxjsiiyufanzcjcq.supabase.co` |

## Rollback

Unset or set `VITE_COACHING_STAGING_DURABLE_RUNTIME_ENABLED=false`.  
No database rollback. Legacy adapter retained. Defaults stay false.

## Owner GO binding (required)

1. Exact full 40-char **activation commit** (commit introducing this pin)
2. Exact PR #295 merge `12b4b8592a8c06a1cf2601226178f72ae7079b5f`
3. Target environment = Staging Preview only
4. Activation manifest SHA256 (reported after pin commit)
5. Exact expected env values above (non-secret)

PR merge / CI / local PASS **do not** grant activation.
