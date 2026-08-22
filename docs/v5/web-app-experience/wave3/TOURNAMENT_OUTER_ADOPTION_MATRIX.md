# Tournament Outer Adoption Matrix

`TOURNAMENT_OUTER_SCREEN_COUNT=10`
`TOURNAMENT_OUTER_ADOPT_NOW_COUNT=4`
`TOURNAMENT_LEGACY_DEFER_COUNT=3`

| Route | Disposition | Reason |
|---|---|---|
| `/tournament` | REMAIN_DOMAIN_COMPOSITION | Outer shell selects canonical tournament center; do not alter Experience internals. |
| `/tournament/list` | ADOPT_SHARED_UI | Auth header/state/confirm/feedback fit; `TournamentListTable` remains domain-owned. |
| `/tournaments` | ADOPT_SHARED_UI | High-reach “Giải của tôi” hub; keep dashboard permissions and status semantics. |
| `/tournament/types` | ADOPT_SHARED_UI | Outer mode-selection hub only; keep `ModeCard` domain composition. |
| `/tournament/config` | ADOPT_SHARED_UI | In-page navigation hub can consume authenticated page framing. |
| `/tournament/roster` | REMAIN_DOMAIN_COMPOSITION | Canonical tournament picker and destination rules are domain behavior. |
| `/tournament/organize` | REMAIN_DOMAIN_COMPOSITION | Engine/Director routing is domain-specific. |
| `/tournament/operations` | REMAIN_DOMAIN_COMPOSITION | Referee/publish/withdraw destination logic is domain-specific. |
| `/tournament/results` | DEFER_LEGACY_CONVERGENCE | Multiple legacy result authorities; avoid visual work during convergence. |
| `/tournament/create` | DEFER_LEGACY_CONVERGENCE | Creation workflow has broad mode-specific semantics. |

Additional legacy defer: `/tournament/bracket` remains a selector hub outside the bounded ten-screen count.

## Freeze

- No `ExperiencePageHeader`, `ExperienceStatusChip`, Experience token, draw-room, workflow, or internal route changes.
- No 23 Experience leaves are added to the sidebar.
- Tournament pickers, mode cards, tables, and route-destination logic remain domain-owned.
- Shared adoption applies only to page framing, generic state, confirmation, feedback, and responsive wrappers.

`TOURNAMENT_23_CHANGED=NO`
