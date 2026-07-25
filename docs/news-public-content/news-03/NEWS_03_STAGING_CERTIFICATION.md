# NEWS-03 — Staging Certification

**Verdict:** `NEWS_03_STAGING_APPLIED_LIVE_CERTIFIED` (local gates + PR follow in same workstream)  
**Certification date:** 2026-07-25  
**Owner GO used:** `NEWS_03_OWNER_GO_STAGING_ONLY`  
**Rollback GO:** not granted / not used

---

## Target

| Item | Value |
|------|--------|
| Staging project ref | `qyewbxjsiiyufanzcjcq` |
| Environment classification | `staging` / `ACTIVE_HEALTHY` |
| Production project ref | `expuvcohlcjzvrrauvud` — **NOT TOUCHED** |
| Production domain | `pickvn.app` — not in resolved target |
| Git HEAD at apply | `42d4cbf5a6e58ee9dcb3b749de83c80a3b04cae0` |
| Branch | `feature/bm-news-03-staging-live-integration` |

---

## Backup / recovery

| Item | Value |
|------|--------|
| Backup classification | `ROLLBACK_SQL_ONLY` |
| PITR | `false` |
| Verified backup | none claimed |
| Automatic rollback on apply failure | `false` |

---

## SQL package hashes (canonical LF SHA-256)

| Order | Path | SHA-256 |
|------:|------|---------|
| 1 | `docs/news-public-content/news-02/10_NEWS_PHASE_02_TABLES.sql` | `3aea2763e23fd8c652a3817d9fc22f69fe7090dda13ba25ca395208f7fd432d7` |
| 2 | `docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql` | `bcb4af2d726757a6c90cd212a8ef3999e5391f251c9fe87afba51a6ec49d55b3` |
| 3 | `docs/news-public-content/news-02/30_NEWS_PHASE_02_RLS.sql` | `42fe57a506b83a18a79c279d4c3fdb833eae4bcd9b6b90162ca2aa083f3f6877` |
| 4 | `docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql` | `1c2c0a42d1c8d2e1cf9d86fdf3f3d27acb1e1eb5dabddac4e1ec832e22f4c168` |
| 5 | `docs/news-public-content/news-02/50_NEWS_PHASE_02_GRANTS.sql` | `5d7537f375c1d0633e041d03c8c6621ae5d4f352a3781cb9e628c6e082e5e019` |
| 6 | `docs/news-public-content/news-02/60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql` | `2f27c137da3d52aa1fedb755f6ee1b798523f279749cc0c7cc3ed1b7da248700` |
| 7 | `docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql` | `59f113544bc4fdb84367a4283a4fe7f472d3405f4f54d89efc22d6b19620767d` |
| 8 | `docs/news-public-content/news-02/99_NEWS_PHASE_02_VERIFICATION.sql` | `110d448fa95ad99e3ab18ed78cfab11b4d7b73fa2a3a6535cba35e2a033121da` |
| 9 | `docs/news-public-content/news-03/99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql` | `a6e96870e1bd0a3838bd299638077659fca39fec5b564dc89e48aaa4ba20a9fe` |

File `90_*` rollback SQL was **not** in apply sequence.

---

## Pre-apply state

| Item | Result |
|------|--------|
| Preflight command | `node scripts/news/news-03-staging-rollout.mjs --mode=preflight` |
| Preflight state | `NOT_APPLIED` |
| Tables / policies / News functions | empty |
| Platform helpers | `user_has_permission`, `is_super_admin`, `user_venue_id` present |
| Evidence | `NEWS_03_PREFLIGHT.json` SHA-256 `5fd722b2beaad1cde514e13e0c01e6a17e59bcda46389fedd807dd16dc1295e7` |

---

## Apply result

| Item | Result |
|------|--------|
| Command | `node scripts/news/news-03-staging-rollout.mjs --mode=apply --execute --confirm=NEWS_03_OWNER_GO_STAGING_ONLY` |
| Started | `2026-07-25T04:50:37.051Z` |
| Finished | `2026-07-25T04:50:48.551Z` |
| Verdict | `NEWS_03_APPLY_OK` |
| Steps | 9/9 `applied` (ordered package above) |
| Evidence | `NEWS_03_APPLY_RESULT.json` SHA-256 `e6ab4befd0962711f905e9fe848496f03771cf2a49a6ee34f2ca4c9b9e6d1e02` |

---

## Post-apply object verification

| Item | Result |
|------|--------|
| Verify command | `node scripts/news/news-03-staging-rollout.mjs --mode=verify` |
| Verdict | `NEWS_03_VERIFY_OK` / state `FULLY_APPLIED_VERIFIED` |
| Tables (7) | approvals, category_refs, items, media_refs, reviews, revisions, tag_refs |
| Functions | `news_public_content_save_aggregate`, `news_public_content_query_public`, scope/read helpers, immutable trigger fn |
| Trigger | `news_public_content_revisions_immutable_trg` |
| RLS | enabled + FORCE on all 7 tables |
| Policies | 7 select policies (authenticated only); no `USING (true)` / `WITH CHECK (true)` |
| Permissions | exact six `news.view|edit|review|approve|publish|admin`; no duplicates |
| Grants | save RPC: `service_role` (+ postgres); public RPC: `anon` + `authenticated` + `service_role` |
| Evidence | `NEWS_03_VERIFY.json` SHA-256 `56e9a35e1b9a5cc4a767859ef0c46aa68dec12f896fc39945723b9e5fe359437` |

---

## Live authorization / RLS matrix

Harness: `scripts/news/news-03-staging-live-certify.mjs`  
Synthetic prefix: `NEWS03_TEST_`  
Temporary `role_permissions` on canonical roles only; cleaned after.

| Area | Result |
|------|--------|
| Public/anonymous filters | PASS — LIVE published visible; DRAFT/MOCK/UNPUBLISHED/ARCHIVED/expired/future not visible; PREVIEW draft not visible; MOCK not as LIVE |
| Anon base-table SELECT | DENY |
| Editorial SELECT | no-membership DENY; member without news.* DENY; news.* + matching venue ALLOW; cross-tenant DENY; wrong competition scope DENY |
| Write boundary | authenticated direct INSERT DENY; authenticated save RPC DENY; service_role save ALLOW |
| OCC | stale `row_version` → `NEWS_VERSION_CONFLICT`; expected version SUCCESS |
| Stale approval | `NEWS_APPROVAL_REVISION_MISMATCH` |
| Provenance | LIVE recorded as LIVE; MOCK publish → `NEWS_PROVENANCE_MISMATCH` |
| Immutable revision | mutation → `NEWS_REVISION_IMMUTABLE` |
| App capability matrix | edit/review/approve/publish/admin exact allow/deny PASS |
| Actor spoofing | DENY via `rejectActorSpoofing` |
| Matrix score | **55 / 55 PASS** |
| Evidence | `NEWS_03_LIVE_CERTIFICATION.json` SHA-256 `bc4bce18cc5b3488ce7c23fad2467ae26670f6f729ce5999d767baa6809b3fff` |

Full actor/operation/expected/actual rows are in the redacted evidence JSON (gitignored).

---

## Fixture cleanup

| Item | Result |
|------|--------|
| Content / revision / review / approval residue | `0` |
| Temporary role_permission residue | `0` |
| Temporary NEWS03 roles | `0` |
| Canonical six `news.*` permissions retained | `6` |
| News schema retained | `7` tables |
| Rollback SQL | **not** executed |

---

## Explicit exclusions

- Production: **NOT TOUCHED**
- Public Portal: **STILL MOCK** (`MOCK_NEWS` unchanged; no portal wiring)
- Scheduler worker: not present
- Media upload: not present
- Permanent News role matrix: not seeded (catalog only)
- PITR / verified backup: not claimed

---

## Residual risks (accepted)

1. Backup remains `ROLLBACK_SQL_ONLY` (authored reverse SQL only).
2. ~~Public RPC authored filter excludes `MOCK` only; `PUBLISHED` + `PREVIEW` not filtered~~ — **superseded by NEWS-04**: public RPC requires `provenance = 'LIVE'` (see `docs/news-public-content/news-04/03_PUBLIC_RPC_LIVE_ONLY_REMEDIATION.md`). Staging apply of remediation SQL awaits Owner GO.
3. First-create with `published_revision_id` set fails FK until revision exists — trusted writers must create then publish (two-step); package not hot-edited after apply.
4. Temporary editorial capability writes remain app-layer + `service_role` save path (no authenticated write policies by design).

---

## Evidence filenames (no secrets)

Runtime JSON under `docs/news-public-content/news-03/evidence/` (gitignored except README / `.gitignore`):

- `NEWS_03_PREFLIGHT.json`
- `NEWS_03_APPLY_RESULT.json`
- `NEWS_03_VERIFY.json`
- `NEWS_03_LIVE_CERTIFICATION.json`

---

## Local certification gates

| Gate | Result |
|------|--------|
| `npm ci --no-audit --no-fund` | PASS |
| package.json / package-lock.json drift | NONE (`CF0361…` / `844840…`) |
| NEWS-01/02/03 focused tests | **70 / 70 PASS** |
| Platform adoption/boundary (NEWS-01 architecture) | included in focused suite PASS |
| Staging harness safety tests | included in focused suite PASS |
| `npm run ci:foundation-lock` | PASS |
| `npm run lint:no-new` | PASS |
| `npm run test:unit` | **5373 / 5373 PASS** |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Secret scan (changed tracked files) | PASS |
| Changed-file scope | NEWS-03 docs + live certify harness only |

---

## Next workstream

**NEWS-04 — Public Portal Live Provenance Adoption** (after PR review / merge decision).
