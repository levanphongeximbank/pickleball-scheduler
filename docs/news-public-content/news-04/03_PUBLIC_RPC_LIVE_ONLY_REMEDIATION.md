# NEWS-04 — Public RPC LIVE-only remediation

## Classification

**PUBLIC_BOUNDARY_DEFECT** (not documentation drift).

Authored NEWS-02/03 public RPC filtered `provenance <> 'MOCK'` only. A row that is `PUBLISHED` + `PUBLIC` + `PREVIEW` could therefore cross the public backend boundary into the browser. Client filtering in Public Portal is **not** an acceptable primary control — News owns publication eligibility / public visibility / provenance at the RPC boundary.

## Remediation authored

| File | Role |
|------|------|
| `docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql` | Canonical `query_public` now requires `provenance = 'LIVE'` |
| `docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql` | Public partial index aligned to LIVE |
| `docs/news-public-content/news-04/10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql` | Staging remediation package (`CREATE OR REPLACE` + index rebuild) |
| `docs/news-public-content/news-04/99_NEWS_PHASE_04_PUBLIC_BOUNDARY_VERIFICATION.sql` | Read-only verification |

## Adapter defense

`createSupabaseContentRepository.queryPublicCandidates`:

- Table path: `.eq("provenance", "LIVE")`
- RPC path: fail closed if any returned candidate is not `LIVE`

Portal `getPublicNews` keeps PREVIEW filtering as **defense in depth** only.

## Staging apply policy

**NOT applied in this remediation commit.**

Staging already has NEWS-03 applied function body. Applying NEWS-04 SQL requires a **new Owner GO** (beyond `NEWS_03_OWNER_GO_STAGING_ONLY`).

Suggested confirm phrase (Owner decides): `NEWS_04_OWNER_GO_STAGING_PUBLIC_RPC_LIVE_ONLY`

Until Owner GO + Staging apply:

- Authored SQL/tests certify the contract in-repo
- Live Staging may still run the pre-remediation RPC body
- App adapter fail-closed + portal defense reduce browser leak risk

## Production

**DO NOT APPLY.** `productionBlocked` remains true.

## Explicit non-goals

- No Production apply
- No package/lockfile change
- No hot-edit Staging outside this authored package
- No moving ownership of eligibility into Experience Channels
