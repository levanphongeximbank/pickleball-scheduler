# COMMS-ACT-01 — Staging Preflight Checklist

**Fail-closed.** Tick only with evidence. Do **not** apply SQL in COMMS-ACT-01.

## A. Safety baseline

- [ ] Worktree: `.../comms-act-01-staging-activation-readiness` (or ACT-02 worktree)
- [ ] Branch includes COMMS-00…07 + COMMS-ACT-01 package
- [ ] Working tree clean before remote operations
- [ ] `package.json` / `package-lock.json` unchanged for activation

## B. Target identity

- [ ] Staging project ref = `qyewbxjsiiyufanzcjcq`
- [ ] Production ref `expuvcohlcjzvrrauvud` **absent** from URL/DB URL
- [ ] `STAGING_SUPABASE_URL` (or guarded `VITE_SUPABASE_URL`) points at Staging
- [ ] `STAGING_SUPABASE_DB_URL` (if used) contains Staging ref
- [ ] `COMMS_STAGING_TARGET_CONFIRM=qyewbxjsiiyufanzcjcq`
- [ ] App Staging preview env points at Staging (not Production)

## C. Backup evidence

- [ ] Backup/PITR or documented logical backup completed
- [ ] Evidence note filled from [01_BACKUP_GATE.md](./01_BACKUP_GATE.md) / evidence template
- [ ] `COMMS_STAGING_BACKUP_EVIDENCE` set (token; never commit)
- [ ] `COMMS_STAGING_BACKUP_EVIDENCE_PATH` points at evidence file
- [ ] Restore capability documented
- [ ] If backup insufficient → **STOP** (BLOCKED); consider Staging project recreate only per platform checklist

## D. Owner GO

- [ ] `COMMS_STAGING_OWNER_GO` recorded for **Staging apply only**
- [ ] Explicit statement: Production remains BLOCKED
- [ ] Explicit statement: realtime not enabled in same step

## E. SQL static preflight

```bash
node scripts/communication/comms-act-01-staging-preflight.mjs --offline
node scripts/communication/comms-act-01-post-apply-verify.mjs --offline
```

- [ ] Preflight exit 0
- [ ] Forward SQL sha256 recorded
- [ ] 14 tables / deny-all RLS / RPC / triggers inventory PASS
- [ ] No `alter publication supabase_realtime` in package
- [ ] No `USING (true)` / client GRANTs

## F. Live gates (ACT-02 only)

```bash
node scripts/communication/comms-act-01-staging-preflight.mjs --live-gates
```

- [ ] Target PASS
- [ ] Backup PASS
- [ ] Owner GO PASS
- [ ] Script still refuses `--apply`

## G. Confirmation gate (before any ACT-02 apply)

Operator must confirm aloud/in evidence:

1. Target is Staging `qyewbxjsiiyufanzcjcq`
2. Backup evidence id recorded
3. Realtime will **not** be enabled
4. Client RLS stays deny-all
5. Rollback path understood (backup restore preferred after data)

## H. Stop conditions

Stop immediately if:

- Production ref detected
- Backup evidence missing/incomplete
- Owner GO missing
- SQL static FAIL
- Need to modify unrelated modules / package lock
- Secret would be committed or logged
