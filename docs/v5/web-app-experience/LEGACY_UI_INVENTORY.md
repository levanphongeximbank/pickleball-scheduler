# LEGACY_UI_INVENTORY

**Workstream:** web-app-experience-master-closure-01  
**Mode:** AUDIT_ONLY — do not delete or redirect.

## Classification

| Code | Meaning |
|------|---------|
| LEGACY_UI_TO_RETIRE | Older UI; map users to frozen Experience (or other current module) later |
| CANONICAL_ROUTE_ADAPTER_REQUIRED | Keep runtime; change **entry links / resolvers** to Experience (or current) routes |
| TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED | No 23-screen equivalent; needs a later domain extension, not a fake redirect |
| KEEP_AS_IS_WITH_REASON | Correct separate surface (athlete, token referee, public marketing, etc.) |

---

## Tournament Experience protection

Frozen 23 screens live under `src/features/tournament/experience-a1/` and `/tournament/:tournamentId/*` + Center `/tournament`.  
**Do not redesign or regress.** Preserve tournament engines, Director Mode, team/daily backends, referee RPCs.

```
TOURNAMENT_LEGACY_SURFACES=22
CANONICAL_ADOPTION_GAPS=9
DOMAIN_SPECIFIC_EXTENSION_GAPS=4
```

### TOURNAMENT_LEGACY_SURFACES

| Surface | Route | Map to Experience | Class |
|---------|-------|-------------------|-------|
| Internal setup | `/tournament/internal/:id` | settings, registration, participants, pairs, groups, schedule, bracket, director | LEGACY_UI_TO_RETIRE |
| Official setup | `/tournament/official/:id` | same individual family | LEGACY_UI_TO_RETIRE |
| Internal/Official bracket pages | `/tournament/internal\|official/:id/bracket` | `/bracket` | LEGACY_UI_TO_RETIRE |
| Legacy center | `/tournament?experience=legacy` | Tournament Center | LEGACY_UI_TO_RETIRE |
| Global schedule hub | `/tournament/schedule` | per-id `/schedule` | LEGACY_UI_TO_RETIRE + adapter |
| Global bracket hub | `/tournament/bracket` | per-id `/bracket` | LEGACY_UI_TO_RETIRE + adapter |
| Global awards hub | `/tournament/awards` | per-id `/awards` | LEGACY_UI_TO_RETIRE + adapter |
| Types / roster / organize / operations / results hubs | `/tournament/types` `roster` `organize` `operations` `results` | pickers → Experience screens | CANONICAL_ROUTE_ADAPTER_REQUIRED |
| Config / eligibility / publish / referee-assign / withdrawal | `/tournament/config*` `eligibility*` `publish-schedule` `referee-assign` `withdrawal` | settings / registration / schedule / referees / exceptions | CANONICAL_ROUTE_ADAPTER_REQUIRED |
| My tournaments dashboard | `/tournaments/:id` | `/overview` (individual) | CANONICAL_ROUTE_ADAPTER_REQUIRED |
| Engine tabs | `/tournaments/:id/{engine,seed,draw,schedule,courts,ranking,logs}` | schedule / pairs / group-draw / matches / courts / standings / complete | CANONICAL_ROUTE_ADAPTER_REQUIRED (KEEP runtime) |
| Director Mode | `/tournament/director/:id` | Experience `/director` is parallel ops UX | KEEP_AS_IS_WITH_REASON (runtime) + CANONICAL_ROUTE_ADAPTER_REQUIRED (entries) |
| Team setup | `/tournament/team/:id` | team IA, not individual 23 | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED |
| Daily setup + launcher | `/tournament/daily/:id` `/daily-play` | none in A1 | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED |
| Team build hubs | `/tournament/teams*` | team domain | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED |
| Team captain portal | `/team-portal/:id` | captain role | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED |
| Team referee portal | `/team-referee/:id` | team referee | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED |
| Referee V5 team match | `/referee/match/:matchId` | team scoring | TEAM_OR_DOMAIN_SPECIFIC_EXTENSION_REQUIRED |
| Referee hub | `/referee` | cross-tournament entry | KEEP_AS_IS_WITH_REASON |
| Referee token board | `/referee/:token` | score runtime | KEEP_AS_IS_WITH_REASON |
| Player portal | `/tournament/my` `/:id` | athlete | KEEP_AS_IS_WITH_REASON |
| Player register | `/tournament/:id/register` | athlete write beside publication | KEEP_AS_IS_WITH_REASON |

### CANONICAL_ADOPTION_GAPS

1. Post-create navigation still opens internal/official/daily/team **setup**, not `/overview` (individual).  
2. Organize/results hub resolvers still emit `directorPath`, `engineTabPath`, `tournamentSetupPath`.  
3. `resolveA1OperationLinks` still advertises legacy setup, director, engine, bracket.  
4. Director back-links still go to internal/official/team/daily.  
5. Club detail/history still navigates to `/tournament/internal/:id`.  
6. Team open path uses `/tournaments/:id`; daily stays on daily setup (today by design).  
7. `canonicalRouteCatalog.js` missing all 21 operator Experience routes; public still classified LEGACY.  
8. Experience `/director` does not replace `TournamentDirectorMode` runtime.  
9. V5 sidebar does not list Experience deep screens.

### DOMAIN_SPECIFIC_EXTENSION_GAPS

1. **Team tournament** — no Experience 23 equivalent (setup + TeamPortal + TeamReferee + Referee V5).  
2. **Daily Play** — outside individual A1 modes.  
3. **Athlete** registration/portal — separate from organizer cutover.  
4. **Referee token/hub** — shared runtime across families.

---

## OTHER_LEGACY_SURFACES

| Domain | Parallel surfaces | Class |
|--------|-------------------|-------|
| App shell | LegacyMainLayout vs CanonicalAppShell | KEEP flag until Owner retires rollback; Canonical is candidate |
| Club | `/club` vs `/manage/clubs` vs `/my-club` / discover | `/club` LEGACY_UI_TO_RETIRE later; member surfaces KEEP |
| Court | `/court-management/*` vs `/court-engine`; `/courts-ops` already redirects | Court-engine TEAM_OR_DOMAIN / KEEP runtime; court-management is current v5 |
| Messaging vs CRM | `/messages` vs `/crm/*` | KEEP_AS_IS_WITH_REASON (OD-B01) |
| Skill | `/player/skill-assessment` vs `-v5` | V5 KEEP hidden (OD-B03) |
| Mobile vs desktop | `/mobile/*` + bottom nav | KEEP_AS_IS_WITH_REASON (product) |
| Coaching lists | `/coaching/coaches` vs `/coach-list` | CANONICAL_ROUTE_ADAPTER_REQUIRED (dedupe) |
| Finance vs billing | `/finance/*` vs `/billing/*` | KEEP_AS_IS_WITH_REASON (different domains) |
| Tournament list actions | “Engine 4.0” / Portal vs Experience workspace | CANONICAL_ROUTE_ADAPTER_REQUIRED |

```
OTHER_LEGACY_SURFACES=9
```
