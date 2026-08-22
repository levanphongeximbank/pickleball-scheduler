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
| Authenticated rendered route screens | 180 |
| High-traffic candidates | 42 |
| Proposed Wave 3 screens | 22 |
| Proposed batches | 6 |
| Dashboard | `PILOT_ALREADY_ADOPTED_PARTIAL_NORMALIZATION` |
| Dashboard remaining legacy families | 4 |
| Court screens / adopt now / domain keep / Wave 6 | 13 / 6 / 3 / 1 |
| Customer-player screens / adopt now / leaks | 12 / 6 / 9 |
| Club-coaching screens / adopt now / duplicate families | 16 / 8 / 4 |
| Tournament outer screens / adopt now / legacy defer | 10 / 4 / 3 |
| Operations screens / adopt now | 7 / 5 |
| Curated cross-domain UI imports / inappropriate | 27 / 17 |
| A11y critical / major / minor gaps | 0 / 9 / 7 |

Counting rule: a screen is a rendered route under `MainLayout`; four redirect-only aliases and the layout-only `/mobile` parent are excluded, while the nested court-management index is included. Public/auth routes, the public referee token route, and public Tournament Experience are excluded. Frozen authenticated Tournament Experience routes remain in the total but are not Wave 3 candidates.

`DASHBOARD_ADOPTION_STATUS=PILOT_ALREADY_ADOPTED_PARTIAL_NORMALIZATION`
`DASHBOARD_REMAINING_LEGACY_PATTERN_COUNT=4`

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
| `/dashboard` | partial normalization only | Canonical analytics header/filter/states are present; four legacy families remain in the club-operations continuation. |
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
