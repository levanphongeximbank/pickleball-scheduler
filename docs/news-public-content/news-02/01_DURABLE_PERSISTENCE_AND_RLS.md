# NEWS-02 — Durable Persistence, SQL, RLS & Editorial Authorization

**Status:** AUTHORED — SQL **NOT APPLIED** · Staging **NOT APPLIED** · Production **NOT APPLIED**  
**Public Portal:** not live · `MOCK_NEWS` still exists · scheduler worker not present · media upload not present  
**Not production-ready.**

See also: `00_NEWS_02_ARCHITECTURE_DECISION.md`

## Schema ownership

News & Public Content owns all `news_public_content_*` tables, RPCs, triggers, and News-specific RLS helpers/policies.

Platform Core owns: `auth.uid()`, `user_venue_id()`, `user_has_permission()`, `is_super_admin()`, actor/tenant projection contracts.

## Durable tables

| Table | Purpose |
|-------|---------|
| `news_public_content_items` | Aggregate root + OCC `row_version` + publication pointers |
| `news_public_content_revisions` | Immutable revision payloads + denormalized scope for slug uniqueness |
| `news_public_content_reviews` | Review decisions bound to revision |
| `news_public_content_approvals` | Approval decisions bound to revision |
| `news_public_content_category_refs` | Category refs |
| `news_public_content_tag_refs` | Tag refs |
| `news_public_content_media_refs` | Media refs |

## Revision immutability

Trigger `news_public_content_revisions_immutable_trg` rejects UPDATE/DELETE of revision payloads; approved/published revisions cannot be deleted.

## Review / approval persistence

Append-only decision rows. Approval must bind `revision_id` + `revision_version`. New revision does not inherit prior approval.

## Publication persistence

Item columns: `publish_at`, `unpublish_at`, `publication_timezone`, `published_at`, `unpublished_at`, `archived_at`, `published_revision_id`. Constraints enforce window order, scheduled requires `publish_at`, archived status consistency, MOCK cannot be PUBLISHED.

## Optimistic concurrency

- Domain `version` ↔ DB `row_version`
- RPC `news_public_content_save_aggregate` CAS: update requires `received = existing + 1` and optional `p_expected_row_version`
- Duplicate `(content_id, version)` on revisions rejected (`23505` → `NEWS_VERSION_CONFLICT`)

## Authorization capability matrix

App module: `src/features/news-public-content/authorization/`

Capabilities: create_draft, read_editorial, edit_draft, submit_for_review, review, approve, schedule, publish, unpublish, archive, preview, public_read.

Permissions: `news.view|edit|review|approve|publish|admin`.

Actor identity from auth context via `projectNewsActor` — caller-supplied actor spoofing denied.

## RLS policy matrix

- FORCE RLS on all News tables
- Authenticated SELECT only when `news_phase02_editorial_scope_allows` + `news_phase02_has_editorial_read`
- No authenticated INSERT/UPDATE/DELETE policies
- No anon base-table SELECT
- No `USING (true)` / `WITH CHECK (true)`
- PLATFORM editorial requires `is_super_admin()`
- Scoped rows fail-closed: `tenant_id = user_venue_id()` (Sprint-2)

## Public read database contract

RPC: `news_public_content_query_public(p_now, p_locale, p_content_scope, p_limit)`

Returns sanitized published PUBLIC content inside publication window with **`provenance = 'LIVE'` only**; excludes MOCK/PREVIEW/DRAFT/unpublished/expired/archived; no reviewer/approver/comments.

**Not wired** to `getPublicNews()` in NEWS-02.

## Repository adapter

`createSupabaseContentRepository({ client })` implements `ContentRepositoryPort`.

Injected client; maps rows ↔ domain; maps SQL errors to typed NEWS errors; no mock fallback.

## SQL package order

```
10_NEWS_PHASE_02_TABLES.sql
20_NEWS_PHASE_02_INDEXES.sql
30_NEWS_PHASE_02_RLS.sql
40_NEWS_PHASE_02_SAVE_RPC.sql
50_NEWS_PHASE_02_GRANTS.sql
60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql
90_NEWS_PHASE_02_ROLLBACK.sql          # authored; do not run in NEWS-02
99_NEWS_PHASE_02_VERIFICATION.sql      # NEWS-03 post-apply
```

## NEWS-03 apply procedure (do not run now)

1. Owner GO for Staging only.
2. Confirm prerequisites: `user_venue_id`, `user_has_permission`, `is_super_admin` present.
3. Apply 10→60 in order on Staging.
4. Run `99_NEWS_PHASE_02_VERIFICATION.sql`.
5. Seed `news.*` permissions if not present.
6. Certify public RPC + editorial SELECT with real JWT roles.
7. Do **not** apply Production in NEWS-03 without separate GO.

## NEWS-03 verification procedure

- Table/RLS/policy inventory
- Anon cannot SELECT base tables
- Anon can EXECUTE `news_public_content_query_public`
- Cross-tenant editorial SELECT denied
- Stale `row_version` save raises `NEWS_VERSION_CONFLICT`
- Draft/PREVIEW/expired/archived not returned by public RPC

## Rollback / remediation

Use `90_NEWS_PHASE_02_ROLLBACK.sql` only under Owner control. Prefer forward remediation (tighten policies) over drop in Production.

## Explicit exclusions

| Item | Status |
|------|--------|
| SQL applied | NO |
| Staging applied | NO |
| Production applied | NO |
| Public Portal live | NO |
| MOCK_NEWS | still present |
| Scheduler worker | NO |
| Media upload | NO |
| getPublicNews wiring | NO |

## Next workstream

**NEWS-03 — Staging Apply & Live Public Read Integration**
