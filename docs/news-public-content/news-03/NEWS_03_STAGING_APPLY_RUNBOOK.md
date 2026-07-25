# NEWS-03 — Staging Apply Runbook

**Scope:** Staging only (`qyewbxjsiiyufanzcjcq`)  
**Production:** `expuvcohlcjzvrrauvud` — **PROHIBITED**  
**Backup classification:** `ROLLBACK_SQL_ONLY`  
**PITR:** false  
**Verified backup:** none assumed  
**Public Portal:** remains mock until NEWS-04

This runbook does **not** contain secrets or raw keys.

---

## 1. Target protection

| Item | Value |
|------|--------|
| Staging allowlist | `qyewbxjsiiyufanzcjcq` only |
| Production blocklist | `expuvcohlcjzvrrauvud`, domain `pickvn.app` |
| Harness | `scripts/news/news-03-staging-rollout.mjs` |
| Allowlist override by CLI | **Not allowed** |

---

## 2. Prerequisites

1. NEWS-02 SQL package present under `docs/news-public-content/news-02/` (10→60, 90, 99).
2. NEWS-03 permission seed package present under `docs/news-public-content/news-03/`.
3. Clean Git worktree on branch `feature/bm-news-03-staging-live-integration`.
4. Staging env file loaded by harness (presence only; values never printed):
   - `SUPABASE_ACCESS_TOKEN` — PRESENT for live preflight/apply
   - `STAGING_SUPABASE_URL` or `VITE_SUPABASE_URL` containing Staging ref
   - `STAGING_SUPABASE_SERVICE_ROLE_KEY` — PRESENT for later live cert (not required for SQL apply via Management API)
   - Staging anon key — PRESENT for later RLS live cert
5. Platform helpers already on Staging: `user_has_permission(text)`, `is_super_admin()`, `user_venue_id()`.
6. Owner GO phrase ready (see below). **Do not apply without Owner GO.**

Env presence check: harness reports PRESENT/ABSENT only.

---

## 3. Exact confirmation phrases

| Action | Phrase |
|--------|--------|
| Apply | `NEWS_03_OWNER_GO_STAGING_ONLY` |
| Rollback | `NEWS_03_OWNER_GO_ROLLBACK_STAGING_ONLY` |

These phrases are **not** interchangeable.

---

## 4. Commands

### Preflight (default / read-only)

```bash
node scripts/news/news-03-staging-rollout.mjs
node scripts/news/news-03-staging-rollout.mjs --mode=preflight
```

### Plan (static order + hashes; no Staging write)

```bash
node scripts/news/news-03-staging-rollout.mjs --mode=plan
```

### Apply (Owner GO required — do not run until Owner approves)

```bash
node scripts/news/news-03-staging-rollout.mjs --mode=apply --execute --confirm=NEWS_03_OWNER_GO_STAGING_ONLY
```

### Verify (read-only verification SQL)

```bash
node scripts/news/news-03-staging-rollout.mjs --mode=verify
```

### Rollback (separate Owner GO)

```bash
node scripts/news/news-03-staging-rollout.mjs --mode=rollback --execute --confirm=NEWS_03_OWNER_GO_ROLLBACK_STAGING_ONLY
```

---

## 5. SQL apply order (locked)

1. `docs/news-public-content/news-02/10_NEWS_PHASE_02_TABLES.sql`
2. `docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql`
3. `docs/news-public-content/news-02/30_NEWS_PHASE_02_RLS.sql`
4. `docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql`
5. `docs/news-public-content/news-02/50_NEWS_PHASE_02_GRANTS.sql`
6. `docs/news-public-content/news-02/60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql`
7. `docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql`
8. `docs/news-public-content/news-02/99_NEWS_PHASE_02_VERIFICATION.sql`
9. `docs/news-public-content/news-03/99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql`

Rollback files are **not** in apply sequence.

Rollback order:

1. `docs/news-public-content/news-03/90_NEWS_PHASE_03_PERMISSION_SEED_ROLLBACK.sql`
2. `docs/news-public-content/news-02/90_NEWS_PHASE_02_ROLLBACK.sql`

---

## 6. Stop conditions

Harness **must** stop (fail closed) when:

- Production ref/domain detected
- Staging allowlist mismatch
- Missing `--execute` or wrong confirmation phrase
- Dirty Git worktree (write modes)
- Preflight not `NOT_APPLIED` for apply (no blind resume of `PARTIALLY_APPLIED`)
- Missing Management API token for write
- First SQL step error

On apply failure: **no automatic rollback**. Record evidence → inventory → Owner remediation decision.

---

## 7. Evidence

Location: `docs/news-public-content/news-03/evidence/` (runtime JSON gitignored)

Includes: timestamp, project ref, environment classification, Git HEAD, SQL paths + SHA256, mode, preflight state, step status, redacted errors, verification/cleanup summary.

Never contains raw secrets.

---

## 8. Live test plan (after Owner GO apply — not this remediation)

1. Temporary Staging fixture grants for exact `news.*` keys (cleanup after).
2. Editorial SELECT RLS with fixture actors.
3. Public RPC read for published-only content.
4. OCC / service_role trusted write path.
5. Deny: anon editorial, cross-tenant, draft public read.
6. Cleanup fixture grants; re-run permission verification (expect 0 permanent role mappings).

Test actors: **not provisioned** in this remediation.

---

## 9. Cleanup plan

- Remove temporary `role_permissions` fixture rows (exact news keys).
- Optional Owner rollback via rollback command if full package must be removed.
- Do not leave broad admin grants.

---

## 10. First-apply rationale

Empty News schema on Staging is expected before first apply. Risk accepted as `ROLLBACK_SQL_ONLY` with authored reverse SQL. No PITR claim. No verified backup required for empty first-apply.

---

## 11. Role mapping decision

Permission **catalog only**. No permanent News editorial role matrix in this package. Platform `is_super_admin()` path unchanged. See `NEWS_03_PERMISSION_AND_ROLLOUT_ARCHITECTURE_DECISION.md`.

---

## 12. Production

Production apply is **prohibited** in NEWS-03. Do not point harness env at Production. Do not use Production confirmation phrases (none exist).
