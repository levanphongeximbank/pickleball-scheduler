# STATUS / FEEDBACK MATRIX — Wave 2 Batch 2A

**MODE:** AUDIT_ONLY  
Visual rendering only. **Do not** redefine domain status semantics.

```
STATUS_VISUAL_IMPLEMENTATION_COUNT=16
CANONICAL_STATUS_VISUAL_CANDIDATE=ExperienceStatusChip TONE MODEL (not the frozen component)
DOMAIN_STATUS_SEMANTICS_CHANGED=NO

LOADING_PATTERN_COUNT=9
EMPTY_STATE_PATTERN_COUNT=8
ERROR_STATE_PATTERN_COUNT=9
TOAST_IMPLEMENTATION_COUNT=5
```

---

## 1. Status / chip / badge implementations (16)

| # | Component | File | Visual | Scope | ACTION |
|---|-----------|------|--------|-------|--------|
| 1 | ExperienceStatusChip | `experience-a1/visual/ExperienceStatusChip.jsx` | tones: success / live / warning / danger / info / draft | FROZEN | **FROZEN** — **learn tones** |
| 2 | TournamentStatusChip | `TournamentStatusChip.jsx` | MUI Chip color from status map | TOURNAMENT_SHARED | FEATURE_SPECIFIC_KEEP |
| 3 | TournamentModeChip | same file | outlined | TOURNAMENT_SHARED | FEATURE_SPECIFIC_KEEP |
| 4 | MatchRefereeStatusChip | `MatchRefereeStatusChip.jsx` | domain | TOURNAMENT_SHARED | FEATURE_SPECIFIC_KEEP |
| 5 | CheckInStatusChip | mobile | domain | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 6 | ClubStatusBadge | `club/ui/ClubStatusBadge.jsx` | MUI `color` success/warning/info/default | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 7 | GovernanceRoleChip | club/ui | role | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 8 | MembershipRequestBadge | club/ui | request | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 9 | CertifiedTournamentBadge | vpr-ranking | certified | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 10 | PickVnRatingBadge | pick-vn-rating | rating | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 11 | ReportingSourceStateBadge | dashboard-analytics | source | DOMAIN | FEATURE_SPECIFIC_KEEP |
| 12 | StatusBadge | animation/shared | presentation | TOURNAMENT_SPECIFIC | **FROZEN** |
| 13 | FairnessScoreBadge | daily animation | score | TOURNAMENT_SPECIFIC | **FROZEN** |
| 14 | TeamStandingsRankBadge | team standings | rank | TOURNAMENT_SPECIFIC | FEATURE_SPECIFIC_KEEP |
| 15 | ExperienceChipRow / PresentationStatusChip | experience visual / batch F | frozen | FROZEN | **FROZEN** |
| 16 | Local StatusChip / requestStatusChip | CourtEnginePage + helpers | inline | DOMAIN | CONSOLIDATE_LATER |

Figure 1 nav badges (PARTIAL / COMING_SOON / LIVE) are **shell chrome**, FROZEN, not a 17th page chip.

Shared **visual** states that can share a renderer **without** changing domain enums:

| Visual tone | Maps from (examples) |
|-------------|----------------------|
| success | active, paid, completed, live-green badge |
| pending | pending_approval, draft, scheduled |
| warning | partial, overdue-soon |
| danger | error, failed, live-red, unpaid |
| info | info, pending_setup |
| neutral | inactive, default, soon |

2C: add **authenticated** `StatusToneChip({ tone, label })` using **Slate** success/warning/error/textMuted — **not** Experience primary blue for `info` unless Owner GO. Domain components keep their enums and pass a tone + VN label.

```
DOMAIN_STATUS_SEMANTICS_CHANGED=NO
```

---

## 2. Feedback states

### Loading (9)

| Pattern | Where |
|---------|--------|
| CircularProgress + label `role="status"` | `TournamentLoadingState` |
| Alert “Đang tải…” | many pages including Dashboard |
| ClubRegistrySkeleton / ClubDiscoverSkeleton | club/ui |
| DashboardLoadingState | dashboard-analytics |
| Messaging loading view | MessagingStateViews |
| DrawRoom / BatchB loading | FROZEN experience |
| directorLoadingGate | director |
| PublicLoadingState | PUBLIC |
| Bare CircularProgress | scattered |

### Empty (8)

ClubEmptyState, TournamentEmptyState, TournamentUiState empty, PublicEmptyState, DashboardEmptyState, Billing empty, Messaging empty, Finance missing-club.

### Error (9)

TournamentErrorState, PublicErrorState, PublicUnavailableState, BillingUnavailable, FinanceUnavailable, CrmLegacyUnavailable, ForbiddenPage `/403`, DirectorAccessDenied, MobileForbiddenState.

### Toast (5)

1. `InterventionFeedbackSnackbar` — **only named wrapper**  
2–5. Page/observer Snackbars: TournamentEnginePage, CourtEnginePage, CourtCalendarShell, ClubCloudSyncObserver  

No app-level SnackbarProvider.

---

## 3. Canonical feedback candidates

| Need | Candidate | ACTION |
|------|-----------|--------|
| Empty | ClubEmptyState (presets + `role="status"` + dashed border) ∪ TournamentUiState API | ADAPT_CANONICAL |
| Loading | TournamentLoadingState (a11y live) + Club skeletons for lists | ADAPT_CANONICAL |
| Inline error | TournamentErrorState (retry) | ADAPT_CANONICAL |
| 403 | ForbiddenPage | KEEP |
| Toast | InterventionFeedbackSnackbar | ADAPT_CANONICAL |
| Public states | PublicPresentationStates | PUBLIC_SHARED — do not reuse dark styling on auth |

---

## 4. Adoption (later)

Strangler: introduce AuthEmpty/AuthLoading/AuthError in 2D; 2E switch Dashboard + Players away from Alert-as-loading and `TournamentEmptyState` leak. Domain Unavailable banners stay domain copy.
