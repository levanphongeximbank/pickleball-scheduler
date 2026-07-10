# Phase 42J — Rollback (client routes & flow)

Revert commit that introduced canonical club routes.

## Git

```bash
git revert <42J-commit-hash>
```

## Manual restore (if partial)

| File | Restore |
|------|---------|
| `src/router.jsx` | Single `/my-club` route; `/clubs/discover` → `?view=discover` |
| `src/pages/player/MyClubPage.jsx` | Monolithic page with discover tab |
| `src/pages/player/myClub/MyClubActionBar.jsx` | Include "Danh sách CLB" tab + join CTA |

Delete if added:

- `src/pages/player/DiscoverClubsPage.jsx`
- `src/pages/player/MyClubRequestsPage.jsx`
- `src/pages/player/guards/ClubActiveMembershipGuard.jsx`
- `src/features/club/routing/clubMembershipRouteLogic.js`
- `src/features/club/hooks/useMyClubMembership.js`
- `tests/club-route-42j.test.js`

No database rollback required (no schema/RPC changes).
