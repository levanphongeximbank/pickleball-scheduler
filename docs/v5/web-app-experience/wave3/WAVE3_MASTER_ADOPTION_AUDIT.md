# WAVE 3 MASTER ADOPTION AUDIT — Batch 3A

**WORKSTREAM:** PICK_VN — Authenticated Web App Experience
**MODE:** `OWNER_GO=AUDIT_ONLY`
**BASE:** `80f2c33b09c1d61b1d2ad397fbdf96d22beb66e0` (PR #464 merge)
**SCOPE:** authenticated high-traffic business pages only

## Verdict

`FINAL_VERDICT=WEB_APP_WAVE3_MASTER_ADOPTION_AUDIT_READY_FOR_OWNER_REVIEW`

Wave 3 should adopt the locked Wave 2 system through a 22-screen strangler migration. It must not redesign workflows, move business logic, alter authorization, or create shell/design-system variants.

## Authoritative counts

| Measure | Count / status |
|---|---:|
| Authenticated rendered route screens | 183 |
| High-traffic candidates | 42 |
| Proposed Wave 3 screens | 22 |
| Proposed batches | 6 |
| Dashboard | `PILOT_ALREADY_ADOPTED` |
| Dashboard remaining legacy families | 6 |
| Court screens / adopt now / domain keep / Wave 6 | 12 / 2 / 3 / 1 |
| Customer-player screens / adopt now / leaks | 30 / 5 / 8 |
| Club-coaching screens / adopt now / duplicate families | 18 / 12 / 7 |
| Tournament outer screens / adopt now / legacy defer | 9 / 1 / 4 |
| Operations screens / adopt now | 7 / 2 |
| Cross-domain UI imports / inappropriate | 42 / 18 |
| A11y critical / major / minor gaps | 0 / 9 / 7 |

Counting rule: `src/router.jsx` contains 187 path entries under `MainLayout`; subtract four redirect-only aliases and the layout-only `/mobile` parent, then add the standalone authenticated `/change-password` route. Public routes, the public referee token route, and public Tournament Experience are excluded. Frozen authenticated Tournament Experience routes remain in the total but are not Wave 3 candidates.

`DASHBOARD_ADOPTION_STATUS=PILOT_ALREADY_ADOPTED`
`DASHBOARD_REMAINING_LEGACY_PATTERN_COUNT=6`

## Frozen boundaries

- Wave 1 shell, breakpoints, and navigation: unchanged.
- Wave 2 theme, tokens, primitives, and shared patterns: consume only; no redesign.
- Tournament Experience 23 internal UX and routes: unchanged.
- Public web and login/register visual language: unchanged.
- `W6-PAGE-001` (`CourtCalendarWeekMatrix.minWidth900`): `REMAINS_WAVE6`.
- Venue / Court Cluster remains above Physical Courts; no authority flattening.

## Pilot carry-forward

| Route | Status | Finding |
|---|---|---|
| `/dashboard` | adopted pilot; legacy continuation inventoried | Canonical analytics header/filter/states and all seven preserved widgets are present; six legacy families remain outside the pilot slice in the club-operations continuation. |
| `/players` | partial normalization only | Page uses canonical patterns, but `PlayerCard`, `PlayerFilters`, and `PlayerStats` still import tournament layout tokens. |
| `/audit` | adopted | Do not reopen W6-PAGE-002. |
| `/court-management/courts` | partial normalization only | Canonical page primitives are present; `Courts.jsx` still embeds club data-transfer UI. |

## Adoption rule

For every selected screen:

- Header → `AuthPageHeader`
- Filters → `AuthFilterBar`
- Table/card switch → `AuthResponsiveDataView`
- Empty/loading/error → corresponding `Auth*State`
- Destructive confirmation → `AuthConfirmDialog`
- Transient feedback → `AppSnackbar`
- Visual status only → `StatusToneChip`, while domain enums remain domain-owned

Domain-specific calendars, booking forms, check-in offline queue, coaching forms, tournament pickers, charts, KPIs, and mutation services remain owned by their modules.

## Safety lock

For all 22 proposed screens:

`ROUTE_UNCHANGED=YES`
`AUTHORIZATION_UNCHANGED=YES`
`DATA_SOURCE_UNCHANGED=YES`
`MUTATION_SEMANTICS_UNCHANGED=YES`
`DOMAIN_AUTHORITY_UNCHANGED=YES`

## Validation

`APPLICATION_CODE_CHANGED=NO`
`DOMAIN_CODE_CHANGED=NO`
`BACKEND_CHANGED=NO`
`DATABASE_CHANGED=NO`
`AUTHORIZATION_CHANGED=NO`
`TOURNAMENT_23_CHANGED=NO`
`PUBLIC_WEB_CHANGED=NO`
`WAVE1_SHELL_CHANGED=NO`
`WAVE2_DESIGN_SYSTEM_CHANGED=NO`
`SQL_EXECUTED=NO`
`STAGING_MUTATED=NO`
`PRODUCTION_MUTATED=NO`
`IMPLEMENTATION_STARTED=NO`
