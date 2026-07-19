# Club Phase 2F — Production Reachability Matrix

| ID | Route | Auth | Role gate | Desktop | Mobile/PWA | Proven reachable |
|----|-------|------|-----------|---------|------------|------------------|
| S1–S5 | `/my-club` (+views) | Authenticated + `ClubActiveMembershipGuard` | Active member; manage panel needs gov/delete | Yes | Yes | Router + guard + menu |
| S6–S7 | `/manage/clubs/:clubId` | Authenticated | Manage/club permissions | Yes | Yes | Router + ClubDetail tabs |
| S8 | `/discover-clubs` | Authenticated | Any authed user | Yes | Yes | Router + redirects |
| S9 | `/manage/clubs` | Authenticated | Tenant/manage roles | Yes | Yes | Router |
| S10 | `/platform/clubs` | Authenticated | Platform/global role self-gate | Yes | Limited | Router + page gate |
| S11 | Join panels | Authenticated | Non-member discover | Yes | Yes | Discover/join |

Redirects proving reachability: `/clubs/discover` → `/discover-clubs`; `/club/activity` → `/my-club?view=schedule`.

**Not certified as Production governance UI:** dead imports, Storybook-only, `src/legacy/**`, ungated experimental tabs without router entry.
