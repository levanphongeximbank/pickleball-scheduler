# 05 — Wave 1 Implementation Changeset

**Phase:** Plan only — no implementation.  
**Smallest coherent closure:**

```text
PUBLIC DISCOVERY → PUBLIC NAV/CARD → CANONICAL PUBLIC TOURNAMENT ROUTE
→ GUEST-SAFE READ (1B) / HONEST EMPTY (1A) → FROZEN #23

PUBLIC COURT LIVE MAPPER → ONLY TRUE DATA
```

---

## Slice definition

| Slice | Name | SQL | Owner GO now? |
|-------|------|-----|---------------|
| **1A** | Integrity foundation | NO | YES (recommended) |
| **1B** | Guest published tournament payload | YES | NO until SQL GO |

---

## Prospective implementation matrix

| File | Current responsibility | Problem | Proposed change | Risk | Test | Slice |
|------|------------------------|---------|-----------------|------|------|-------|
| `PublicHeader.jsx` | Public nav | Giải đấu → `/tournaments` | → `/public/tournaments` | Low | Nav unit/route | 1A |
| `PublicFooter.jsx` | Footer links | Ban tổ chức → `/tournaments` | → `/public/tournaments` (or `/login` per Owner) | Low | Footer link | 1A |
| `TournamentCard.jsx` | Public card CTA | → `/tournaments/:id` | → `individualPublicTournamentPath(id)` | Med (ID PARTIAL) | Card URL | 1A |
| `HomePage.jsx` | Featured cards | Inherits card | No change if card fixed | Low | Smoke | 1A |
| `TournamentsPage.jsx` | Discovery | Inherits card | No change if card fixed | Low | Smoke | 1A |
| `mockPublicData.js` | ECOSYSTEM_ITEMS | Latent auth paths | Repoint to `/public/tournaments` if kept | Low | Optional | 1A |
| `IndividualPublicExperiencePage.jsx` | #23 public page | Guest infinite load via `clubScopeReady` | Fail-closed: guest skip ready gate; if no public reader yet → honest not-found; **no tab/layout redesign** | Med | Anon load | 1A |
| Same page + new hook | #23 data | No guest payload | Wire `usePublicTournament` after SQL | High if rushed | Anon published load | **1B** |
| New public read adapter | — | Missing | Map projection → derivePublicExperienceModel input | Med | Mapper unit | **1B** |
| SQL package (not written) | — | No anon get | PC-02-style get/projection | High process | SQL contract tests | **1B** |
| `publicClubsCourtsDataSource.js` | LIVE courts map | Fake amenities | `amenities: []` / omit | Low | Mapper truth | 1A |
| `router.jsx` | Routes | Anon `/tournaments` login wall | Optional: anon-only redirect to `/public/tournaments` | Med | Route tests | 1A MAY |
| Registry files | Stale public route claims | Doc drift | Correct `/public/tournaments` notes | Low | — | 1A MAY |
| `IndividualTournamentPublicPage.jsx` | Dead legacy | Unmounted | Do not delete in 1A unless cleanup approved | Low | — | DEFER |

---

## Buckets

### MUST_CHANGE_WAVE_1 (Slice 1A)

```text
- src/components/public/PublicHeader.jsx
- src/components/public/PublicFooter.jsx
- src/components/public/cards/TournamentCard.jsx
- src/features/public-portal/services/publicClubsCourtsDataSource.js  (amenities only)
- src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx
  (guest gate / read-integration fail-closed ONLY — no UI redesign)
```

### MAY_CHANGE_WAVE_1

```text
- src/router.jsx (anonymous soft-redirect /tournaments → /public/tournaments)
- src/data/public/mockPublicData.js (ECOSYSTEM_ITEMS paths)
- src/features/experience-channels/public-portal/registry/publicPortalSurfaceRegistry.js
- src/features/experience-channels/registry/channelRegistry.js
- tests under public-portal / public routing
```

### MUST_NOT_CHANGE

```text
- src/features/canonical-shell/**          (PR #463 / authenticated shell)
- Authenticated MainLayout tournament hub/engine behavior for logged-in users
- canonical_tournament_get / tournament writers / organizer Experience screens 1–22 visuals
- Tournament #23 tab layout, copy structure, visual tokens (freeze)
- PR #463 worktree / branch
- SQL / Supabase / Staging / Production (while SQL_GO=NO)
- Full CourtsPage redesign / court-cluster feature rewrite
- Rankings/news/clubs detail features (later waves)
```

### DEFER_TO_LATER_WAVE

```text
- Wave 1B: SQL public tournament get + full guest payload adapter
- Wave 2: Homepage redesign/polish
- Wave 4: Club detail
- Wave 5: Court cluster discovery/detail + “Cụm sân” copy
- Wave 6: Public player profiles
- Wave 7: News article + SEO/social
- Wave 8: /register alias + login visual convergence
- Wave 9: Full responsive matrix
- Delete IndividualTournamentPublicPage.jsx (optional cleanup)
```

---

## Risk summary

```text
WAVE_1_IMPLEMENTATION_RISK=
MEDIUM overall:
- LOW for nav/CTA/amenities
- MEDIUM for #23 fail-closed gate change (must not alter visuals)
- HIGH if attempting guest published payload without SQL (forbidden / unsafe)
```

```text
WAVE_1_IMPLEMENTATION_READY=CONDITIONAL
READY_FOR_OWNER_GO_IMPLEMENT_SLICE_1A=YES
READY_FOR_OWNER_GO_IMPLEMENT_SLICE_1B=NO  # blocked by SQL_GO=NO
```
