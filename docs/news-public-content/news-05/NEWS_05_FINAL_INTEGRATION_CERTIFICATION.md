# NEWS-05 — Final Integration Certification

## Marker

`NEWS_05_FINAL_ARCHITECTURE_AUDIT` → **A. READY_FOR_FINAL_CERTIFICATION** (after doc/registry remediation in this packet)

Primary completion marker (post commit/push/PR): `NEWS_05_PASS_COMMITTED_PUSHED_PR_OPEN`

## Scope

Final read-only audit + Staging live recertification + Production read-only inventory + Production GO/NO-GO decision + module closure classification for **News & Public Content**.

**Not in scope:** Production SQL apply, Staging re-apply, CMS UI, media upload, scheduler worker, package/lockfile changes, PR merge.

## NEWS-01…04 lineage

| Phase | Outcome retained |
|-------|------------------|
| NEWS-01 | Domain, lifecycle, public projection, provenance, facade foundation |
| NEWS-02 | Durable SQL/RLS/save RPC/public RPC package (authored; LIVE-only public contract in-repo) |
| NEWS-03 | Staging apply + live RLS/RPC/capability certification (`NEWS_03_LIVE_CERT_PASS`) |
| NEWS-04 | Public Portal live path + Staging LIVE-only public RPC remediation certified |

Merge ancestor on `origin/main`: NEWS-04 merge `073ced2f6977d894ef3130588f85be6fd823f175`.

## Final architecture (canonical)

```
Public Portal (NewsPage / HomePage)
  → getPublicNews (publicNewsService / publicPortalService)
  → createNewsPublicContentFacade
  → createSupabaseContentRepository({ preferRpc: true })
  → news_public_content_query_public (LIVE-only)
  → sanitized public projection
```

Forbidden (verified absent on portal path):

- browser direct base-table public queries
- frontend `service_role`
- competing News facades
- Experience Channels publication-truth duplication
- silent live → MOCK fallback
- unknown provenance relabeled as LIVE

## Ownership

| Owner | Owns |
|-------|------|
| News & Public Content | content domain, lifecycle, publication eligibility, public projection, provenance truth, public-read boundary |
| Experience Channels / Public Portal | route, UI, loading/error/empty, provenance presentation, page orchestration |

## Architecture audit answers (NEWS_05_FINAL_ARCHITECTURE_AUDIT)

1. Domain ownership — **correct**
2. Canonical live path — **yes**
3. Silent live→mock fallback — **no**
4. MOCK/PREVIEW only explicit — **yes** (default LIVE)
5. Public RPC LIVE-only — **yes** (in-repo + Staging certified)
6. Lifecycle/eligibility consistent — **yes**
7. Adapter fail-closed non-LIVE/malformed — **yes**
8. Browser service-role — **no**
9. Direct base-table public query on portal path — **no**
10. Documentation drift — **remediated in NEWS-05** (prior contradiction on Staging LIVE-only apply status)
11. Test gaps — focused NEWS-05 suite + retained NEWS-01…04; HomePage ERROR→empty is presentation residual (not mock fallback)
12. Closure blockers — Production not deployed; PITR/backup Owner confirmation required before Production apply

## Staging recertification (NEWS-05)

| Harness | Mode | Result |
|---------|------|--------|
| `news-04-staging-live-only-remediate.mjs --mode=certify` | read-only certify (no `--execute`) | `NEWS_04_STAGING_LIVE_ONLY_ALREADY_APPLIED_CERTIFIED` |
| `news-03-staging-live-certify.mjs` | live certify | `NEWS_03_LIVE_CERT_PASS` (55/55) |

Proven:

- target Staging `qyewbxjsiiyufanzcjcq`
- `productionConnected = false` / `productionTouched = false`
- `sqlApplied = false` in NEWS-05 certify runs
- NEWS-02/03 schema present; RLS + FORCE RLS; no grant broadening
- public RPC LIVE-only; PREVIEW/MOCK/non-LIVE leak = 0
- unpublished/draft/archived/expired/future not visible; eligible LIVE visible
- LIVE-only public window index present
- fixture residue = 0
- Public Portal path has no silent mock fallback (unit + live harness)

## Production inventory (NEWS-05)

Harness: `scripts/news/news-05-production-readonly-inventory.mjs` (SELECT only).

| Field | Result |
|-------|--------|
| Project | `expuvcohlcjzvrrauvud` `ACTIVE_HEALTHY` |
| Presence | **ABSENT** (0 news tables / functions / permissions) |
| Mutated | **No** |
| Fixtures | **No** |
| Classification | `PRODUCTION_NEWS_ABSENT` |

## Production decision

See `NEWS_05_PRODUCTION_READINESS_DECISION.md` → **PRODUCTION_GO_WITH_CONDITIONS**.

## Test matrix

See focused file `tests/news-public-content-news-05-final-certification.test.js` plus NEWS-01…04, Public Portal / Experience Channels, foundation-lock, lint, unit, build.

## Explicit exclusions

- No Production apply in NEWS-05
- No Staging SQL re-apply
- No CMS / media upload / scheduler
- No package.json / package-lock.json changes
- Module not declared `MODULE_100_PERCENT_CLOSED` until post-merge verification + cleanup

## Residual risks

1. Production backup/PITR not asserted by SELECT inventory — Owner must confirm before apply.
2. Backup classification remains `ROLLBACK_SQL_ONLY` for authored reverse SQL.
3. HomePage maps live ERROR to empty list (no MOCK) — presentation residual.
4. Permanent role→news permission matrix not seeded beyond catalog keys (by design).
