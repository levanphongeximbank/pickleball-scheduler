# Cross-Domain UI Leak Matrix

`CROSS_DOMAIN_UI_LEAK_COUNT=42`
`INAPPROPRIATE_CROSS_DOMAIN_UI_LEAK_COUNT=18`

Scope: active authenticated UI imports across Court, Player/Customer/CRM, Finance, Club, Tournament, Coaching, and Dashboard. Service/model imports and same-domain composition are excluded.

## Inappropriate leaks (18)

| Importer | Imported UI |
|---|---|
| `PlayerStats` | tournament layout |
| `PlayerFilters` | tournament layout |
| `PlayerCard` | tournament layout |
| `SkillLevelsPage` | `TournamentPageHeader` |
| `SkillLevelsPage` | `TournamentSectionCard` |
| `SkillLevelsPage` | tournament layout |
| `SkillLevelRequestsPage` | `TournamentPageHeader` |
| `SkillLevelRequestsPage` | tournament layout |
| `SelectPlayers` | tournament `EffectPreludeScreen` |
| `SelectPlayers` | tournament effect-prelude config |
| `PlayerHomePage` | tournament mobile layout |
| CRM booking reminders | court booking-notification panel |
| Court future page | tournament court-schedule manager |
| `ClubAvatar` | player page-local styles |
| Statistics | tournament season-standings table |
| Statistics | tournament season-export actions |
| Tournament nav hub | Support guide page component |
| Tournament nav hub | Support FAQ page component |

## Legitimate domain reuse (16)

- Dashboard composes four tournament/court operational widgets.
- Club management composes league-round and season-close panels.
- Courts composes the club data-transfer operation.
- Eight player-facing My Club/discovery/governance surfaces consume Club domain UI.
- Club creation on the player My Club flow reuses the Club form dialog.

These imports express an intentional aggregate or the same business domain despite different folder ownership; they must not be mechanically replaced.

## Frozen exceptions (8)

- Five mobile operational pages consume the frozen tournament mobile gutter contract.
- Dashboard KPI consumes the frozen Figure 1 shell accent token.
- Canonical shell consumes the billing operational route gate.
- `InPageNavHub` consumes tournament hub chrome only for frozen/domain tournament hub use.

## Truly global shared surfaces

`web-app-ui`, authenticated contexts, `PermissionGate`, and the responsive-data pattern are `TRULY_GLOBAL_SHARED`. They are target homes and are not included in the 42 cross-domain leak/reuse/exception imports.

## Pilot consequence

`/players` is page-level adopted but its three child layout-token imports remain. Dashboard has four legitimate aggregate imports. No authenticated Public UI import was found.
