# Cross-Domain UI Leak Matrix

`CROSS_DOMAIN_UI_LEAK_COUNT=27`
`INAPPROPRIATE_CROSS_DOMAIN_UI_LEAK_COUNT=17`

This is a curated active authenticated UI-import audit. Data/service/model imports and same-domain tournament composition are excluded. Canonical `web-app-ui` imports are `TRULY_GLOBAL_SHARED` and are not leaks.

| # | Importer → imported UI | Classification | Action |
|---:|---|---|---|
| 1 | `PlayerCard` → tournament layout | INAPPROPRIATE_LEAK | use auth tokens/local player composition |
| 2 | `PlayerFilters` → tournament layout | INAPPROPRIATE_LEAK | use auth filter spacing |
| 3 | `PlayerStats` → tournament layout | INAPPROPRIATE_LEAK | use auth layout spacing |
| 4 | `SkillLevelsPage` → `TournamentPageHeader` | INAPPROPRIATE_LEAK | `AuthPageHeader` |
| 5 | `SkillLevelsPage` → `TournamentSectionCard` | INAPPROPRIATE_LEAK | MUI auth surface |
| 6 | `SkillLevelsPage` → tournament layout | INAPPROPRIATE_LEAK | auth tokens |
| 7 | `SkillLevelRequestsPage` → `TournamentPageHeader` | INAPPROPRIATE_LEAK | defer admin adoption, no new leak |
| 8 | `SkillLevelRequestsPage` → tournament layout | INAPPROPRIATE_LEAK | defer admin adoption |
| 9 | `CheckInDashboardPage` → tournament `mobileUi` | INAPPROPRIATE_LEAK | auth/mobile-owned gutter |
| 10 | `QrScanPage` → tournament `mobileUi` | INAPPROPRIATE_LEAK | extract neutral mobile gutter later |
| 11 | `QrGeneratePage` → tournament `mobileUi` | INAPPROPRIATE_LEAK | extract neutral mobile gutter later |
| 12 | `OperationsMobileDashboardPage` → tournament `mobileUi` | INAPPROPRIATE_LEAK | auth/mobile-owned gutter |
| 13 | `NotificationSettingsPage` → tournament `mobileUi` | INAPPROPRIATE_LEAK | defer neutral extraction |
| 14 | `PlayerHomePage` → tournament `mobileUi` | INAPPROPRIATE_LEAK | auth/mobile-owned gutter |
| 15 | `SelectPlayers` → tournament effect-prelude UI/config | INAPPROPRIATE_LEAK | extract neutral animation contract; preserve behavior |
| 16 | `Courts` → `ClubDataTransferPanel` | INAPPROPRIATE_LEAK | move transfer entry to club/domain-neutral composition |
| 17 | CRM booking reminder → court booking notification panel | INAPPROPRIATE_LEAK | extract neutral reminder presentation in Wave 4 |
| 18 | `RefereeHub` → tournament `mobileUi` | LEGIT_DOMAIN_REUSE | referee is tournament runtime; leave |
| 19 | court future page → tournament court schedule manager | LEGIT_DOMAIN_REUSE | explicit tournament-court composition; ownership note |
| 20 | Statistics → season standings table | LEGIT_DOMAIN_REUSE | season competition data is intended |
| 21 | Statistics → season export actions | LEGIT_DOMAIN_REUSE | intended season result composition |
| 22 | Club management → league round manager | LEGIT_DOMAIN_REUSE | club/league hierarchy |
| 23 | Club management → season close panel | LEGIT_DOMAIN_REUSE | club season operation |
| 24 | Dashboard → active tournaments panel | LEGIT_DOMAIN_REUSE | dashboard aggregator |
| 25 | Dashboard → league rounds panel | LEGIT_DOMAIN_REUSE | dashboard aggregator |
| 26 | Dashboard → season standings panel | LEGIT_DOMAIN_REUSE | dashboard aggregator |
| 27 | Dashboard → court operations panel | LEGIT_DOMAIN_REUSE | dashboard aggregator |

Frozen Experience imports inside the Tournament Experience boundary are `FROZEN_EXCEPTION` and were not counted as cross-domain leakage. Public components imported by authenticated pages were not found.

## Pilot consequence

`/players` is page-level adopted but not fully normalized because rows 1–3 remain. `/court-management/courts` is page-level adopted but row 16 remains. These are minor carry-forward fixes, not redesign authority.
