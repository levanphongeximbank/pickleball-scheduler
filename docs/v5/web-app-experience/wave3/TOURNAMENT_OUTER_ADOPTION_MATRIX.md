# Tournament Outer Adoption Matrix

`TOURNAMENT_OUTER_SCREEN_COUNT=9`
`TOURNAMENT_OUTER_ADOPT_NOW_COUNT=1`
`TOURNAMENT_LEGACY_DEFER_COUNT=4`

| Route | Disposition | Reason |
|---|---|---|
| `/tournament` | FROZEN | Experience A1 center is part of the frozen 23-screen system; legacy fallback defers. |
| `/tournament/list` | ADOPT_SHARED_UI | Auth header/state/confirm/feedback fit; `TournamentListTable` remains domain-owned. |
| `/tournament/create` | REMAIN_DOMAIN_COMPOSITION | Broad mode-specific workflow; do not couple visual adoption to creation semantics. |
| `/tournament/types` | REMAIN_DOMAIN_COMPOSITION | Outer mode-selection hub; keep `ModeCard` domain composition. |
| `/tournament/config` | REMAIN_DOMAIN_COMPOSITION | RBAC-filtered in-page navigation and config writers remain domain-owned. |
| `/tournament/roster` | DEFER_LEGACY_CONVERGENCE | Picker still resolves to legacy registration/setup destinations. |
| `/tournament/organize` | DEFER_LEGACY_CONVERGENCE | Engine/Director destination adapters are not converged. |
| `/tournament/operations` | DEFER_LEGACY_CONVERGENCE | Individual selection can resolve to global referee assignment without tournament context. |
| `/tournament/results` | DEFER_LEGACY_CONVERGENCE | Multiple legacy result authorities; avoid visual work during convergence. |

Adjacent `/tournaments`, `/tournament/bracket`, and deeper config/setup leaves remain outside this nine-screen outer audit and defer to legacy convergence or domain ownership.

## Freeze

- No `ExperiencePageHeader`, `ExperienceStatusChip`, Experience token, draw-room, workflow, or internal route changes.
- No 23 Experience leaves are added to the sidebar.
- Tournament pickers, mode cards, tables, and route-destination logic remain domain-owned.
- Shared adoption applies only to page framing, generic state, confirmation, feedback, and responsive wrappers.

`TOURNAMENT_23_CHANGED=NO`
