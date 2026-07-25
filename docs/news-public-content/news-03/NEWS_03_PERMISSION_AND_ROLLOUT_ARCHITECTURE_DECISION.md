# NEWS_03_PERMISSION_AND_ROLLOUT_ARCHITECTURE_DECISION

**Phase:** NEWS-03 — Staging Apply & Live Public Read Integration  
**Status:** Authored package only — SQL **NOT APPLIED**; Staging/Production unchanged until Owner GO.  
**Decision date:** 2026-07-25

## Exact action keys (from source)

Verified from `src/features/news-public-content/authorization/capabilityMatrix.js` (`NEWS_PERMISSION`) and NEWS-02 RLS helpers:

| id | module | action |
|----|--------|--------|
| `news.view` | `news` | `view` |
| `news.edit` | `news` | `edit` |
| `news.review` | `news` | `review` |
| `news.approve` | `news` | `approve` |
| `news.publish` | `news` | `publish` |
| `news.admin` | `news` | `admin` |

No wildcard. No extra keys. Source matches preflight expectation.

## Canonical permission table

- **Table:** `public.permissions`
- **Schema (Identity v40):** `id text PK`, `module text NOT NULL`, `action text NOT NULL`, `description text DEFAULT ''`, `created_at timestamptz DEFAULT now()`
- **Role join:** `public.role_permissions (role_id, permission_id)` FK → `permissions(id)`
- **Lookup helper:** `public.user_has_permission(text)` expects the permission **id** string (e.g. `news.view`)

`id` is the natural text key (not a generated UUID). Seed uses the action key as `id`, matching CRM Phase 1H and Identity sprint convention.

## Required seed columns

Insert: `id`, `module`, `action`, `description`.  
Do not invent columns. Do not overwrite unrelated modules.  
Idempotent via `WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = …)`.

## Idempotent upsert mechanism

- **Forward:** `INSERT … SELECT … WHERE NOT EXISTS` (CRM / PHASE_42I pattern)
- Does **not** UPDATE existing rows (preserves any Owner/custom description edits)
- Re-running seed is safe (no duplicates)

## Permanent role mapping

**NO** permanent global `role_permissions` mapping in this package.

Rationale:

- Repository has actor kinds in JS (`author`, `editor`, …) but **no** dedicated canonical News editorial SQL roles.
- Platform `is_super_admin()` path remains in NEWS-02 RLS (unchanged).
- Live NEWS-03 tests after Owner GO use **temporary Staging fixture** grants, cleaned up after tests.
- No broad administrator fallback. No `authenticated` grant of all `news.*`.

## Rollback behavior

- File: `90_NEWS_PHASE_03_PERMISSION_SEED_ROLLBACK.sql`
- Exact six ids only (no `LIKE 'news.%'`)
- Before DELETE: refuse if any of the six ids remain referenced in `public.role_permissions`
- Idempotent when rows already absent
- **Never** auto-run by harness on apply failure

Harness rollback mode (Owner GO separate phrase):

1. NEWS-03 permission rollback
2. NEWS-02 `90_NEWS_PHASE_02_ROLLBACK.sql` (full News schema)

## Verification behavior

- File: `99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql` — read-only
- Checks: exact six present, no duplicates, metadata non-null, no wildcards, no permanent broad role mapping created by this package
- Deterministic ordered result sets

## Harness path

`scripts/news/news-03-staging-rollout.mjs`  
Library: `scripts/news/lib/*`

Modes: `preflight` | `plan` | `apply` | `verify` | `rollback`  
Default (no mode / no `--execute`): read-only preflight. **No side-effect SQL.**

## Management API pattern

Reuse Customer-07 proven pattern:

- `POST https://api.supabase.com/v1/projects/{STAGING_REF}/database/query`
- Staging ref hardcoded allowlist — **not** overridable by CLI args
- Project metadata `GET /v1/projects/{ref}` for Staging classification + healthy status
- Injected transport for local tests (no real network)

## Evidence path

`docs/news-public-content/news-03/evidence/` (runtime JSON gitignored)  
Tests must pass `--evidence-dir` to a temp directory.

Evidence includes: timestamp, project ref, environment classification, Git HEAD, SQL paths + SHA256, mode, preflight state, step statuses, redacted errors, verification/cleanup summaries. **No secrets.**

## Staging allowlist

- Project ref: `qyewbxjsiiyufanzcjcq` only

## Production blocklist

- Project ref: `expuvcohlcjzvrrauvud`
- Domain: `pickvn.app`
- Any Production URL/ref/config → fail closed

## Explicit Owner GO mechanism

**Apply** requires all of:

- mode `apply`
- exact Staging ref (hardcoded)
- `--execute`
- `--confirm=NEWS_03_OWNER_GO_STAGING_ONLY`
- clean Git worktree
- HEAD recorded in evidence
- SQL file SHA256 computed
- preflight `NOT_APPLIED` or proven resumable state

**Rollback** requires:

- mode `rollback`
- exact Staging ref
- `--execute`
- `--confirm=NEWS_03_OWNER_GO_ROLLBACK_STAGING_ONLY` (different phrase)

Missing any gate → fail closed before database write.

## Exact SQL apply order

1. `docs/news-public-content/news-02/10_NEWS_PHASE_02_TABLES.sql`
2. `docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql`
3. `docs/news-public-content/news-02/30_NEWS_PHASE_02_RLS.sql`
4. `docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql`
5. `docs/news-public-content/news-02/50_NEWS_PHASE_02_GRANTS.sql`
6. `docs/news-public-content/news-02/60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql`
7. `docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql`
8. `docs/news-public-content/news-02/99_NEWS_PHASE_02_VERIFICATION.sql`
9. `docs/news-public-content/news-03/99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql`

Rollback files are **not** in apply sequence. Stop on first error. No blind auto-resume. No auto-rollback on failure.

## Backup classification

- `ROLLBACK_SQL_ONLY`
- PITR: false
- No verified backup assumed for first-apply empty News schema
- First-apply empty News schema is acceptable risk when reverse SQL exists

## Out of scope this remediation

- Applying SQL to Staging or Production
- Seeding Staging live data
- Public Portal live provenance (still mock)
- Permanent News editorial role matrix
