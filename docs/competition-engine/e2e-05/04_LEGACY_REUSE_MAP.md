# E2E-05 — Legacy Public Experience Reuse Map

| Asset | Classification | E2E-05 action |
|-------|----------------|---------------|
| `IndividualTournamentPublicPage` | REUSE_WITH_ADAPTER | Consume public facade projections; no local standings recompute long-term |
| `PublicRootPage` | REUSE_AS_IS | No change |
| `publicPortalService` | REUSE_WITH_ADAPTER | Discovery lists; competition detail via E2E-05 facade when published |
| `TournamentHome` | OUT_OF_SCOPE | Organizer |
| `TournamentBracketPage` | REUSE_WITH_ADAPTER | Read-only bracket from public projection |
| `BracketView` | REUSE_WITH_ADAPTER | Needs read-only mode for public |
| `TournamentPublishSchedulePage` | OUT_OF_SCOPE | Organizer mutation |
| `MatchListPanel` | REUSE_AS_IS | Presentational |
| `PlayerLiveResultsPanel` | REUSE_WITH_ADAPTER / OUT_OF_SCOPE for anon | Player portal (E2E-04) |
| `PlayerFinalResultsPanel` | REUSE_WITH_ADAPTER | Map from `getPublicFinalResults` |
| `ActiveTournamentsPanel` | OUT_OF_SCOPE | Dashboard |
| `PublicLayout` / header / footer | REUSE_AS_IS | No shell redesign |
| `TournamentCard` | REPLACE_MINIMALLY | Deep-link to published competition when ready |
| `LiveDataHubSection` / `getPublicLiveScores` | LEGACY_MOCK | Live score mock deferred; Match Center uses published snapshot |
| `mockPublicData` news/sponsors | LEGACY_MOCK | OUT_OF_SCOPE |
| CM-06 publication / branding / archive | REUSE_WITH_ADAPTER | Vocabulary + future manifest wiring |
| EC-01 public-portal readiness | REUSE_AS_IS | Channel certification; competition detail deferred boundary |
| E2E-03 Organizer publication states | REUSE_AS_IS | Source of publication ops state |

## Presentation adapter (this workstream)

`buildPublicCompetitionExperienceSections` — 10 MVP sections, view-model only, no router changes.
