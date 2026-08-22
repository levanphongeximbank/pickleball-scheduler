# 04 — Mock / Fallback / Sample Data Matrix

**Central mock SSOT:** `src/data/public/mockPublicData.js`  
**Honesty UI:** `PublicDataSourceNotice.jsx` (labels MOCK / MIXED / PREVIEW / UNKNOWN; hides on LIVE)  
**Audit date:** 2026-08-22  

---

## Classification definitions (audit)

| Code | Meaning |
|------|---------|
| REAL_DATA | Backed by live adapter/RPC/canonical query without inventing fields |
| SAFE_EXPLICIT_FALLBACK | Mock/demo clearly labeled or titled as mẫu |
| UNSAFE_LOOKS_REAL | Looks operational but is invented/hardcoded without adequate disclosure |
| EMPTY_STATE | Honest empty / not-found |

---

## Matrix

| Surface | File | Entity | Data Source | Classification | Production Risk | Later Action |
|---------|------|--------|-------------|---------------|-----------------|--------------|
| Home stats | `mockPublicData.js` `PUBLIC_STATS`; `publicHomeDataSource.js` | Aggregate counts (“120+”, “680+”, …) | Live club blob counts **or** mock stats | SAFE_EXPLICIT_FALLBACK when mock path + notice; REAL when live counts | Medium if notice missing | Keep notice; prefer EMPTY or labeled marketing |
| Home featured tournaments | `HomePage.jsx` + tournaments loader | Tournament cards | Same as discovery | REAL / EMPTY / SAFE | High if card links wrong | Fix link + data |
| Home clubs/courts | `publicClubsCourtsDataSource.js` | Club/court cards | Local/remote + mock fallback | SAFE / REAL | Medium | Converge |
| Home live scores | `MOCK_LIVE_SCORES`; `LiveDataHubSection.jsx` | Scores | Explicit mock + “TỶ SỐ MẪU” | SAFE_EXPLICIT_FALLBACK | Low | Keep labeled or remove for GA |
| Home schedule/results/events | MOCK_* arrays | Schedule/results/events | Explicit mock panels | SAFE_EXPLICIT_FALLBACK | Low | Same |
| Home sponsors | `MOCK_SPONSORS` | Sponsors | Mock | SAFE_EXPLICIT_FALLBACK | Low | Same |
| Home ecosystem | `ECOSYSTEM_ITEMS` | VPT/VPL/VPR/VPC marketing | Hardcoded marketing | SAFE_EXPLICIT_FALLBACK (static marketing) | Medium (links to auth `/tournaments`) | Fix paths |
| Home news | `publicNewsService` / `getPublicNews` | News teasers | Default LIVE RPC | REAL_DATA (or labeled MOCK if forced) | Low | Keep |
| Tournament discovery | `TournamentsPage.jsx`; rankings/tournaments DS | List | Default REMOTE; local `allowMockFallback: false` | REAL_DATA or EMPTY_STATE | High (detail link) | Wire to #23 |
| Club discovery | `ClubsPage.jsx`; MOCK_CLUBS | Clubs | Mock allowed | SAFE_EXPLICIT_FALLBACK / REAL | Medium | Detail + real catalog |
| Club detail | `PublicCatalogNotFoundPage` | Club | None | EMPTY_STATE | Low (honest) | Build real detail |
| Courts discovery mock | `MOCK_COURTS` | Facilities | Mock + notice | SAFE_EXPLICIT_FALLBACK | Medium (semantics) | Relabel cụm sân |
| Courts live map | `mapLiveCourts()` | Venue aggregates | Club blob courts[] | REAL_DATA for name/count; **UNSAFE_LOOKS_REAL** for amenities | **P0 field** | Remove invented amenities |
| Courts catalog DTO | `mapCatalogCourtDtoToPortalCard` | Physical-ish DTO | Catalog RPC | REAL_DATA (no invented amenities) | Medium (shape ≠ facility card) | Align model to cluster |
| Court detail | Not-found page | Court | None | EMPTY_STATE | Low | Cluster detail |
| Rankings | `MOCK_RANKINGS` / VPR / remote | Players ranking | Mixed | SAFE / REAL | Medium | Link players later |
| News list | `getPublicNews`; MOCK_NEWS only if `source=mock` | Articles | Default live; no silent mock | REAL_DATA / labeled MOCK | Low | Article detail |
| Tournament #23 | `useCanonicalTournament` | Tournament public model | Canonical query by clubId | REAL_DATA if scope OK else EMPTY | High (scope) | Public read adapter |
| Footer social | `PublicFooter.jsx` | FB/YT/TT/IG chips | Decorative | SAFE (non-data) | Low | Real links or remove |

---

## Prominently: UNSAFE_LOOKS_REAL

### Confirmed

```text
mapLiveCourts() amenities: ["Đèn LED", "Sân chuẩn"]
File: src/features/public-portal/services/publicClubsCourtsDataSource.js
```

When source status is LIVE, amenity chips present as real facility truth.

### Not classified UNSAFE (because labeled)

- `MOCK_TOURNAMENTS`, `MOCK_CLUBS`, `MOCK_COURTS`, `MOCK_RANKINGS`, `MOCK_NEWS` when shown with `PublicDataSourceNotice` or “MẪU” panel titles.
- Homepage hub explicitly titled **TỶ SỐ MẪU / LỊCH MẪU / KẾT QUẢ MẪU**.

### Residual risk

If LIVE notice is hidden and any silent mock path reappears, realistic Vietnamese entity names in `mockPublicData.js` would become **UNSAFE_LOOKS_REAL**. Current list UIs generally label MOCK/MIXED — preserve this discipline.

---

## Counts

| Classification | Approx count of surfaces |
|----------------|--------------------------|
| REAL_DATA | 3–5 conditional |
| SAFE_EXPLICIT_FALLBACK | 8+ |
| UNSAFE_LOOKS_REAL | 1 confirmed field-path |
| EMPTY_STATE | 4+ (club/court detail stubs; empty lists; #23 miss) |

---

## Search patterns covered

Audited occurrences of: mock, sample, demo, fallback, placeholder, fixture, seed, static marketing arrays under `src/data/public`, `src/features/public-portal`, `src/pages/public`, `src/components/public`.
