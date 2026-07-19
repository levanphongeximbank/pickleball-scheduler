# Club Phase 2G — Visual / Live Smoke

## Status

# **AUTHENTICATED_VISUAL_SMOKE_BLOCKED**

Public shell probe: **PASS** · Authenticated governance pages: **BLOCKED**

### Why authenticated visual is blocked

- No Owner-approved Staging/Preview QA login for synthetic Officer/Owner clubs.
- No browser automation MCP/tooling available in this session.
- Opening a new PR / deploying a fresh Preview is forbidden for this phase.
- Production customer governance data must not be mutated or screenshot with PII.

### Public probes performed (read-only)

| Target | URL | Result |
|--------|-----|--------|
| Production login | `https://pickleball-scheduler-eight.vercel.app/login` | Login shell renders (V5.2 Production Pilot) |
| Phase 2F Preview login | `https://pickleball-scheduler-d5zdbv01w-pickleball-scheduler.vercel.app/login` | Login shell renders |
| Production deploy SHA | Vercel Production → `f6ae0ee` (includes Phase 2F) | Confirmed via GitHub Deployments API |

### Surfaces not live-verified (authenticated)

| Route / surface | Live result | Fallback evidence |
|-----------------|-------------|-------------------|
| `/my-club` | BLOCKED | Phase 2F tests 1–2, 8–18, 24 + source |
| `/my-club?view=members` | BLOCKED | Phase 2F tests 6–7, 16–17, 26 + source |
| `/manage/clubs` | BLOCKED | Router + ClubListPage contracts / Club pack |
| `/manage/clubs/:id` | BLOCKED | Phase 2F test 5 + ClubGovernancePanel source |
| Organization chart | BLOCKED | Phase 2F tests 4, 9–14, 24 |
| Governance management panel | BLOCKED | Phase 2F tests 3, 9–15 |

### Screenshots

| Item | Status |
|------|--------|
| Desktop governance screenshots | **Not available** (blocked) |
| Tablet / mobile screenshots | **Not available** (blocked) |
| Console capture (auth pages) | **Not available** (blocked) |

### Unblock path (Owner)

1. Provide Staging or Preview URL pinned to ≥ `cf32171` / `f6ae0ee`.  
2. Provide synthetic accounts: Owner≠President, Owner=President, 0/1/2 VP, inactive officer ref.  
3. Re-run checklist in [CLUB_PHASE2G_GOVERNANCE_CHECKLIST.md](./CLUB_PHASE2G_GOVERNANCE_CHECKLIST.md) and attach screenshots without customer PII.  
4. Record as FU-2G-1 closure.
