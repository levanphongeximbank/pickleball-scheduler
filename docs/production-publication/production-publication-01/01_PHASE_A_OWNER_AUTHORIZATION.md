# PRODUCTION-PUBLICATION-01 — Phase A Owner Authorization Pack

**Branch:** `feature/production-publication-01-clubs-courts`  
**Worktree:** `C:\Users\Le Phong\PICK_VN-Workstreams\production-publication\production-publication-01-clubs-courts`  
**Base:** `origin/main` @ `a01f2640`  
**Phase:** A — Read-only audit complete  
**Verdict:** `PRODUCTION_PUBLICATION_01_AWAITING_OWNER_GO`

## Authorization flags (current)

| Flag | Value |
|------|-------|
| PRODUCTION_READ_ONLY_AUDIT_GO | YES (executed) |
| PRODUCTION_SQL_RLS_GO | NO |
| PRODUCTION_DATA_PUBLICATION_GO | NO |
| PRODUCTION_ENV_DEPLOY_GO | NO |

**Mutation blocked until exact Owner message:** `GO PRODUCTION PUBLICATION`

## Exact records proposed for Owner approval

### Club
- Display name: **CLB ACCC**
- ID: `club-219e4a7cbd73437eb6271f02a53314c3`
- Tenant: `venue-prod-main`
- Linked cluster: `venue-prod-main-pickleball-nam-long-sports` (Pickleball NAM LONG sports)

### Court projection (1 row)
- Display name: **Pickleball NAM LONG sports**
- Proposed projection ID: `pcc-club-219e4a7cbd73437eb6271f02a53314c3-nam-long-1`
- Source: real active cluster linked to Club (cluster `court_count=0`; no per-court inventory)

### Public fields planned
- Club: name, slug `clb-accc`, location summary `Phước Long, Hồ Chí Minh`, contact **null**
- Court: display name + club/venue ids only; type/surface/availability **null**

## Not performed in Phase A
- No SQL apply
- No row updates/inserts
- No Vercel env change
- No Production deploy

## Owner next step
Reply exactly:

```text
GO PRODUCTION PUBLICATION
```

Optionally amend candidates in the same message (display names / location summary / court projection id) before GO.
