# NEWS-05 — Production Readiness Decision

## Decision (exactly one)

**B. PRODUCTION_GO_WITH_CONDITIONS**

Not `PRODUCTION_GO` (backup/PITR + Owner apply GO still open).  
Not `PRODUCTION_NO_GO` (code/Staging certified; Production inventory complete and shows clean ABSENT state).

## Evidence summary

| Gate | Status |
|------|--------|
| Local architecture / public boundary | PASS |
| Staging NEWS-03 live cert | PASS (`NEWS_03_LIVE_CERT_PASS`) |
| Staging NEWS-04 LIVE-only cert | PASS (`NEWS_04_STAGING_LIVE_ONLY_ALREADY_APPLIED_CERTIFIED`) |
| Production identity | PASS (`expuvcohlcjzvrrauvud`, `ACTIVE_HEALTHY`) |
| Production News presence | **ABSENT** (safe first-apply candidate) |
| Production mutated by NEWS-05 | **No** |
| Backup / PITR verified by harness | **No** (condition) |
| Rollout SQL package idempotent | **Yes** (IF NOT EXISTS / CREATE OR REPLACE patterns in NEWS-02/03/04) |
| Rollback package authored | **Yes** (`news-02/90_*`, `news-03/90_*`) |
| Staging “PASS ⇒ Production GO” | **Rejected** — Staging alone is insufficient |

## Conditions (closeable; not vague)

1. **Owner GO phrase** for Production database apply (separate from this PR merge).
2. **Confirm Production backup/PITR** (or accepted risk waiver) in Supabase dashboard before apply.
3. **Maintenance window** agreed for Production apply + post-verify.
4. **Credential isolation check**: Production deploy env URL/ref = `expuvcohlcjzvrrauvud` only; Staging keys never mixed.
5. **Apply order** (idempotent packages, stop-on-first-error, no auto-rollback):
   - NEWS-02 package (`10`→`60` + verify)
   - NEWS-03 permission seed + verify
   - NEWS-04 `10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql` + boundary verify
6. **Post-apply verify**: public RPC LIVE-only, anon grants unchanged beyond EXECUTE on query RPC, RLS forced, PREVIEW/MOCK leak = 0, portal `/news` smoke against Production anon.
7. **Rollback readiness**: keep authored rollback SQL reviewed; do not execute unless Owner GO for rollback.

## Inventory verdict

`NEWS_05_PRODUCTION_INVENTORY_ABSENT`

Harness: `node scripts/news/news-05-production-readonly-inventory.mjs`

## What this decision does *not* authorize

- Applying SQL to Production in this workstream
- Claiming `MODULE_PRODUCTION_DEPLOYED`
- Claiming Production-ready public news content without post-apply verify

## Marker

Owner action before any Production write:

`NEWS_05_OWNER_GO_REQUIRED_BEFORE_DATABASE_WRITE`
