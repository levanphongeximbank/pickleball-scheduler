# 04 — Staging-safe B1B runner runbook (authorization binding)

**STAGING_APPLY_GO=NO** in WP6A — this runbook is readiness only.  
**Do not execute live Auth ban in WP6A.**

## Modes (explicit)

| Mode value | Accepted project ref | Rejected project ref |
|------------|----------------------|----------------------|
| unset / `production` | `expuvcohlcjzvrrauvud` | Staging + unknown |
| `staging_rehearsal` (required explicit) | `qyewbxjsiiyufanzcjcq` | Production + unknown |

There is **no** auto-detect from URL, env fallback, or “accept any project ref”.

## Staging rehearsal env contract (future execute — not WP6A)

```text
OPERATION_TARGET_MODE=staging_rehearsal
TARGET_PROJECT_REF=qyewbxjsiiyufanzcjcq
# or STAGING_PROJECT_REF=qyewbxjsiiyufanzcjcq
DRY_RUN=true   # default; live only after Owner Staging GO
OPERATION_B1B_BATCH_ID=c13c323a-4fec-4327-90ba-56128fb126f5
ALLOWLIST_PATH=<outside-git-staging-allowlist.json>
ALLOWLIST_SHA256=<sha256>
RECOVERY_SNAPSHOT_PATH=<outside-git-staging-snapshot.json>
SNAPSHOT_SHA256=<sha256>
OWNER_STAGING_GO=<fresh-staging-only-go>
EXPLICIT_EXECUTE_CONFIRMATION=I_UNDERSTAND_THIS_MUTATES_STAGING_QA_ONLY_VIA_B1B_STAGING_REHEARSAL
```

## Forbidden in Staging mode

- Production project ref `expuvcohlcjzvrrauvud`
- Production allowlist / Production recovery snapshot
- Production execute confirmation string
- Retired Owner GO `APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY`
- Retired batches `b37186cf-…` / `9c9d5fc7-…`
- Generic “any project ref” bypass

## Production mode preserved

Unset mode continues to require exact Production ref and Production confirmation string. Staging ref / Staging confirmation / Staging allowlist are rejected.

## Auth mutation safeguard

`mutationAllowed` remains false unless dry-run=false **and** fresh mode-matched binding **and** durable one-time claim succeeds. Authority mismatch ⇒ zero Auth mutations.
