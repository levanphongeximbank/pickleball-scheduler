# COMMS-ACT-02 — Gate A Live Preflight Evidence

**Verdict:** `COMMS_ACT_02_READY_FOR_STAGING_SQL_EDITOR_APPLY`
**Recorded (local):** 2026-07-24 21:30+07
**SQL applied:** NO
**Realtime enabled:** NO
**Client RLS opened:** NO
**Clipboard prepared:** YES (`docs/supabase-communication-comms05.sql`, SHA256 match)
**Owner SQL Editor action:** READY (Staging project only)

## Worktree / branch

| Check | Result |
|-------|--------|
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\communication-foundation\comms-act-02-staging-apply` |
| Branch | `ops/communication-foundation-comms-act-02-staging-apply` |
| Tracking | `origin/main` (behind 53; no push performed) |
| `git fetch origin` | OK |
| Working tree | untracked Gate A evidence only (this file); no package/lockfile changes |

## Target

| Check | Result |
|-------|--------|
| Active Staging ref | `qyewbxjsiiyufanzcjcq` |
| Production block | `expuvcohlcjzvrrauvud` absent as active target |
| Live URL inventory ref | `qyewbxjsiiyufanzcjcq` (PASS) |
| `COMMS_STAGING_TARGET_CONFIRM` | `qyewbxjsiiyufanzcjcq` (PASS) |

## Backup (PASS — filesystem re-verified)

Canonical path:

`C:\Users\Le Phong\PICK_VN-Backups\supabase-staging\pickleball-scheduler-staging-qyewbxjsiiyufanzcjcq-20260724-211725`

| Check | Result |
|-------|--------|
| Directory exists | YES |
| Logical dump artifacts (5) | `roles.sql` (297), `schema.sql` (1240231), `data.sql` (2096365), `migration-history-schema.sql` (1116), `migration-history-data.sql` (893838) — all > 0 |
| `backup-manifest.csv` | 5 entries |
| Recomputed SHA-256 vs manifest | **PASS** (all 5 match) |
| Archive `.zip` | exists, 547959 bytes, opens |
| ZIP SHA-256 | `1024bd3d7fbdee4e523dbfae9f85f306a2afa32609b8b4fbba1029ebcf5896fc` (matches evidence) |
| ZIP entries | **7** / none empty |
| `backup-evidence.txt` | ACT-01 contract fields present; `targetProjectRef=qyewbxjsiiyufanzcjcq`; no Production ref free-text |
| Marker | `BACKUP_COMPLETE` (Owner) |

Manifest SHA-256 (recomputed):

| File | Bytes | SHA256 |
|------|------:|--------|
| roles.sql | 297 | `25873cec56a2cc6514e204f420231777f85c03da818caa7090cdcdfa89776ecd` |
| schema.sql | 1240231 | `f19427551ecdf1a039c896051fd48984d8289bdf6059c6078cc2eaed3ba8dd50` |
| data.sql | 2096365 | `5621046a52643005fe5da97e7bcc04f19cdf694c618686bbcd823a4b40b604f8` |
| migration-history-schema.sql | 1116 | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| migration-history-data.sql | 893838 | `d08d90cd2d52ffaa9e012801b4c4b882a03dac6a4385fbff03c357aa3a4f7851` |

## Owner GO (PASS — SQL bind)

File: `comms-act-02-owner-go-evidence.txt`

| Field | Owner GO file | Computed from repo |
|-------|---------------|--------------------|
| `SQL_SHA256` | `74f04eed7fdecbadca0a20d0f57605a921b22974ca9305d1b042a3528deffef3` | match |
| `SQL_BYTES` | `35996` | match |
| `SCOPE` | `STAGING_ONLY` | OK |
| `STAGING_PROJECT_REF` | `qyewbxjsiiyufanzcjcq` | OK |
| `PRODUCTION_PROJECT_REF_BLOCKED` | `expuvcohlcjzvrrauvud` | OK |
| `SQL_RELATIVE_PATH` | `docs\supabase-communication-comms05.sql` | exists |

Hash bind gate: **PASS**.

## SQL static package (PASS)

| Check | Result |
|-------|--------|
| Path | `docs/supabase-communication-comms05.sql` |
| SHA256 | `74f04eed7fdecbadca0a20d0f57605a921b22974ca9305d1b042a3528deffef3` |
| Bytes | `35996` |
| Tables | 14 / 14 |
| RLS enable | 14 / 14 |
| Deny-all policies | 14 / 14 |
| Revoke anon/authenticated | present |
| Realtime publication alter | absent |
| Permissive `USING (true)` | absent |
| Client GRANTs | absent |
| Destructive outside `communication_*` | absent |

Expected objects:

- 14 tables (`communication_*`)
- 2 RPCs: `communication_allocate_message_position`, `communication_advance_read_cursor`
- 2 triggers: `communication_messages_reply_same_conversation_trg`, `communication_pinned_same_conversation_trg`

## Live preflight commands

```bash
node scripts/communication/comms-act-01-staging-preflight.mjs --offline --json
# verdict: COMMS_ACT_01_READY_FOR_OWNER_GO · pass: true · sqlStatus: PASS

# With COMMS_STAGING_TARGET_CONFIRM + OWNER_GO + BACKUP_* pointing at backup-evidence.txt:
node scripts/communication/comms-act-01-staging-preflight.mjs --live-gates --json
# verdict: COMMS_ACT_01_READY_FOR_OWNER_GO · pass: true
# target: PASS · ownerGo: PASS · backup: PASS · findings: []
```

## Remote current-state snapshot (read-only)

Staging URL ref verified = `qyewbxjsiiyufanzcjcq`.
Production ref active = NO.

All 14 expected `communication_*` tables: **absent** (HTTP 404 / PGRST205 schema cache miss).

`PRESENT_COUNT=0` `ABSENT_COUNT=14`

Verdict: `NO_COMMUNICATION_TABLES_DETECTED` (expected pre-apply).

## Stop conditions honored

- No agent-side SQL apply
- No Production touch
- No realtime enable
- No client RLS open (Club/Community remain deny-all)
- No deploy
- No commit / push before post-apply verification
- No package/lockfile change

## Owner next step (SQL Editor only)

Canonical SQL is on the local clipboard (SHA256 verified).

1. Open **Supabase Dashboard → project `qyewbxjsiiyufanzcjcq` (Staging)** — refuse if Production `expuvcohlcjzvrrauvud`.
2. Open **SQL Editor → New query**.
3. Paste clipboard (must be `docs/supabase-communication-comms05.sql`).
4. Run once.
5. Do **not** alter `supabase_realtime` publication.
6. Do **not** open Club/Community client RLS / GRANTs.
7. Reply with apply completion marker for Agent post-apply verification.
