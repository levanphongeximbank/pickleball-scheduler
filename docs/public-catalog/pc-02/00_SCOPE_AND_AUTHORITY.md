# PUBLIC-CATALOG-02 — Scope & Authority

**Workstream:** PUBLIC-CATALOG-02 — Tournaments & Rankings Remote Public Sources  
**Branch:** `feature/public-catalog-02-tournaments-rankings`  
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\public-catalog\public-catalog-02-tournaments-rankings`  
**Base:** `origin/main` @ `0da0daec`  
**Gate:** Implementation + Staging PASS + Production read-only → awaiting Owner Production GO

## Authorization

| Gate | Status |
|------|--------|
| REPOSITORY_IMPLEMENTATION_GO | YES |
| STAGING_SQL_RLS_GO | YES |
| STAGING_CONTROLLED_EVIDENCE_GO | YES |
| PRODUCTION_READ_ONLY_AUDIT_GO | YES |
| PRODUCTION_SQL_RLS_GO | NO |
| PRODUCTION_DATA_PUBLICATION_GO | NO |
| PRODUCTION_ENV_DEPLOY_GO | NO |

Exact Owner Production authorization required:

```text
GO PUBLIC CATALOG 02 PRODUCTION
```

## In scope

- Public Tournaments remote read source
- Public Rankings remote read source
- Canonical DTO contracts
- SQL/RLS/RPC + deny-by-default projections
- Frontend remote adapters
- LIVE / EMPTY / ERROR provenance
- Staging activation + controlled evidence
- Production readiness plan (no mutation)

## Out of scope

- Clubs/Courts implementation changes
- Home redesign / News
- Competition scheduling / tournament ops mutation
- Ranking calculation / writer logic
- Player Rating writer
- Vercel Production env cutover
- iOS/Android

## Preserve (must not regress)

- `CLUBS_PRODUCTION_PUBLICATION=ACTIVE_VERIFIED`
- `COURTS_PRODUCTION_PUBLICATION=ACTIVE_VERIFIED`
- `PRODUCTION_PORTAL_SOURCE=REMOTE_RPC`
- `PRODUCTION_RUNTIME_READINESS=ACHIEVED_FOR_CLUBS_COURTS`

## Authority summary

| Surface | Classification | Authority |
|---------|----------------|-----------|
| Tournaments | `PROJECTION_REQUIRED` → implemented empty deny-by-default projection | `public_catalog_tournaments` + `public_catalog_list_tournaments` (not club blob / mock / CM dormant runtime) |
| Rankings | `PROJECTION_REQUIRED` → implemented empty deny-by-default projection | `public_catalog_rankings` + `public_catalog_list_rankings` (not Player Rating; not ad-hoc standings; not open `vpr_leaderboard` SELECT) |

VPR `vpr_leaderboard` exists on Production with 0 rows and a public RPC, but PC-02 uses a dedicated projection for Staging parity and PC-01-style deny-by-default security. Experience Channels does not become a business writer.
