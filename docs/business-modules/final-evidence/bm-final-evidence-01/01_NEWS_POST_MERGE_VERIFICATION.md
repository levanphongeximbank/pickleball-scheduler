# News — Post-Merge Verification (PR #268)

## Marker

`NEWS_PUBLIC_CONTENT_POST_MERGE_VERIFIED_CLOSED`

## Lineage (re-verified)

| Item | Value |
|------|-------|
| PR | [#268](https://github.com/levanphongeximbank/pickleball-scheduler/pull/268) **MERGED** |
| Merge commit | `a6be590254c5cf924d4c4648e367565c8f0ce69c` — ancestor of fresh `origin/main` |
| Implementation commit | `9f209acc67138d30f48f79b43f9d0b9c3d5b7c43` — ancestor of fresh `origin/main` |
| Local/remote PR branch | **absent** |
| Fresh `origin/main` | `7971a260c325a723f78671a9754f17d2bcde14b5` |

## Scope verified

- NEWS-01 → NEWS-05 docs under `docs/news-public-content/`
- Targeted tests `tests/news-public-content-*.test.js` — **106/106 PASS**
- Public live read path: `src/features/public-portal/services/publicNewsService.js`
- Fail-closed: LIVE failure does not silent-fallback to mock
- `MOCK_NEWS` only on explicit mock/preview source
- Production rollout: **DEFERRED** (`PRODUCTION_GO_WITH_CONDITIONS` / ABSENT inventory) — **not** an implementation gap
- Physical News worktree residual under `business-modules/`: **none**
- `databaseWrites=0`, `ProductionTouched=NO`

## Post-merge assertion alignment (News test only)

On current `origin/main`, HOME `dataSourceNotes` describe NEWS-04 typed projection rather than the literal string `getPublicNews`.

Phase B1 updated **only**:

`tests/news-public-content-news-05-final-certification.test.js`

to assert `/NEWS-04 typed result/` + `/without silent empty-on-error/` while retaining LIVE `/news` and no mock-only claim. **Experience Channels source was not modified.**

## Residual cleanup

Not performed in Phase B1. See `05_RESIDUAL_WORKTREE_CLASSIFICATION.*`.
