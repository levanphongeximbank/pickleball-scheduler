# NEWS_02_ARCHITECTURE_DECISION

**Phase:** NEWS-02 — Durable Persistence, SQL, RLS & Editorial Authorization  
**Status:** AUTHORED — SQL **NOT APPLIED** to Staging or Production  
**Decision date:** 2026-07-25  
**Baseline HEAD:** `3d74fbea553996ad402eef151223c8942ac83aa1`  
**NEWS-01 ancestor:** `87ba5907332faf22e3e79c012f69806668d84a4b`

## Verdict

Adopt the **Customer/CRM numbered SQL package** convention under `docs/news-public-content/news-02/`. Do **not** create a competing migration engine. Do **not** apply SQL in NEWS-02.

## Canonical SQL authoring path

`docs/news-public-content/news-02/`

| Order | File |
|------:|------|
| 10 | `10_NEWS_PHASE_02_TABLES.sql` |
| 20 | `20_NEWS_PHASE_02_INDEXES.sql` |
| 30 | `30_NEWS_PHASE_02_RLS.sql` |
| 40 | `40_NEWS_PHASE_02_SAVE_RPC.sql` |
| 50 | `50_NEWS_PHASE_02_GRANTS.sql` |
| 60 | `60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql` |
| 90 | `90_NEWS_PHASE_02_ROLLBACK.sql` |
| 99 | `99_NEWS_PHASE_02_VERIFICATION.sql` |

## Canonical migration / package mechanism

- Module-owned **authored rollout package** (same family as Customer-03 / CRM-1G).
- Headers mark `AUTHORED ONLY` / `NOT APPLIED`.
- Apply belongs to **NEWS-03** Owner-gated staging procedure.
- Optional rollback authored; **not executed** in NEWS-02.

## Schema / table names

Schema: `public` with `news_public_content_*` prefix.

| Table | Role |
|-------|------|
| `news_public_content_items` | Stable content aggregate root + OCC `row_version` |
| `news_public_content_revisions` | Immutable revision payloads |
| `news_public_content_reviews` | Review decisions bound to revision |
| `news_public_content_approvals` | Approval decisions bound to revision |
| `news_public_content_category_refs` | Category references |
| `news_public_content_tag_refs` | Tag references |
| `news_public_content_media_refs` | Media references |

## Revision model

- One row per `(content_id, version)` — unique.
- Payload fields (title/summary/slug/locale/body/SEO/banner/sponsor) live on revision.
- Item holds `current_revision_id`, `approved_revision_id`, `published_revision_id`.
- Trigger blocks UPDATE/DELETE of revisions once referenced by approval or publication.

## Review / approval persistence

- Separate tables; always store `revision_id` + `revision_version`.
- New revision does **not** inherit prior approval (domain already clears; DB stores append-only decisions).

## Reference persistence

Normalized ref tables keyed by `(content_id, revision_id, *Id)` with deterministic `sort_order`.

## Public-read database boundary

- **No** anon SELECT on editorial base tables.
- SECURITY DEFINER RPC: `news_public_content_query_public(p_now, p_locale, p_content_scope, p_limit)`.
- Sanitized columns only (no reviewer/approver/comments/internal ids beyond public scope refs).
- Filters: `PUBLISHED` + `PUBLIC` + publication window + not archived + `provenance <> 'MOCK'`.

## Editorial capability matrix

App-owned capabilities (fail-closed), mapped from Platform actor + scope + verified permission helpers:

| Capability | Typical gate |
|------------|--------------|
| `create_draft` | `news.edit` / author path + scope |
| `read_editorial` | `news.view` \| `news.edit` \| … |
| `edit_draft` | `news.edit` |
| `submit_for_review` | `news.edit` |
| `review` | `news.review` |
| `approve` | `news.approve` |
| `schedule` / `publish` / `unpublish` | `news.publish` |
| `archive` | `news.admin` \| `news.publish` |
| `preview` | `news.view` |
| `public_read` | anon/auth via public RPC only |

Trusted backend / `service_role` is the write path (Customer-03 pattern). Actor identity must come from authentication context — never caller-supplied `actor_id` for privilege.

## RLS helpers adopted (verified only)

- `auth.uid()`
- `public.user_venue_id()`
- `public.user_has_permission(text)`
- `public.is_super_admin()`
- Module helper: `public.news_phase02_editorial_scope_allows(...)`

No invented `user_tenant_id()`. Sprint-2 fail-closed: scoped rows require `tenant_id = user_venue_id()` (and venue match when venue-scoped).

## Repository adapter path

`src/features/news-public-content/persistence/`

- Injected Supabase client (`assertSupabaseNewsClient`)
- Implements `ContentRepositoryPort`
- Row ↔ domain mappers + typed error mapping
- No import-time network; no mock fallback; no UI concerns

## Registry files to change

| File | Action |
|------|--------|
| `scripts/ci/unit-test-files.json` | Register NEWS-02 tests |
| `src/features/news-public-content/constants/index.js` | Phase flags for NEWS-02 |
| `src/features/news-public-content/index.js` | Export persistence/auth surfaces needed by consumers |
| `docs/news-public-content/README.md` | Status update |
| Module `ARCHITECTURE.md` | NEWS-02 boundary |

**Not required:** `apiErrors.js` (module-local errors remain), ownership-lock baseline (no new `createClient`).

## Test mechanism

Static Node `node:test` contract tests (Finance-1F / Customer-03 style):

- SQL object / constraint / RLS / grant / dangerous-pattern tests
- Capability matrix unit tests
- Fake injected Supabase adapter tests
- NEWS-01 regression

No live DB harness in NEWS-02. Live RLS execution is NEWS-03.

## Files expected to change / create

- `docs/news-public-content/news-02/**`
- `src/features/news-public-content/persistence/**`
- `src/features/news-public-content/authorization/**`
- `src/features/news-public-content/{index,constants,errors,ARCHITECTURE}.*` (minimal)
- `tests/news-public-content-news-02-*.test.js`
- `scripts/ci/unit-test-files.json`

## Files forbidden to change

- `package.json` / `package-lock.json`
- Public Portal / NewsPage / router / layouts
- `MOCK_NEWS` / `getPublicNews()` wiring
- Competition / Venue / Club / CRM / Finance / Notification / Communication internals (beyond import of Platform helpers already used)
- No stash / reset / rebase / force-push
- No Staging/Production apply
