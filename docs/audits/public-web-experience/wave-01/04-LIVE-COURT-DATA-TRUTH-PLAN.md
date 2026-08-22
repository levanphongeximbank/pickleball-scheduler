# 04 — Live Court Data Truth Plan

**Phase:** Wave 1 Audit / Plan  
**Owner locks:**

```text
REMOVE_UNSAFE_FAKE_AMENITIES=YES
FULL_COURT_CLUSTER_REDESIGN=NO
FULL_COURT_CLUSTER_DETAIL=NO
NEW_COURT_AUTHORITY=NO
COURTS_PUBLIC_DOMAIN=COURT_CLUSTER_FACILITY  (Wave 5)
PHYSICAL_COURT_IS_CHILD_RESOURCE=YES
COURT_CLUSTER_EQUALS_ALL_PHYSICAL_COURTS=NO
```

---

## Exact function

**File:** `src/features/public-portal/services/publicClubsCourtsDataSource.js`  
**Function:** `mapLiveCourts()`

### Inputs (real)

| Input | Source |
|-------|--------|
| Clubs | `loadClubs()` (non-default) |
| Courts array | club blob `data.courts` |
| Open/close hours | `data.courtManagement.openHour/closeHour` (defaults 6–22) |
| Name | `club.name` |
| Address | `club.address \|\| city \|\| location` |
| Image | `club.coverImage` |

### Outputs

| Field | Real? | Notes |
|-------|-------|-------|
| `id` | Derived | `venue-${club.id}` — club-as-venue aggregate |
| `name` | Real | Club name |
| `address` | Real-ish | Club location fields |
| `courtCount` | Real | Count of active courts |
| `openHours` | Partial | From courtManagement or defaults |
| `amenities` | **FABRICATED** | Hardcoded `["Đèn LED", "Sân chuẩn"]` |
| `image` | Real/nullable | |

### Catalog path contrast

`mapCatalogCourtDtoToPortalCard` sets `amenities: Object.freeze([])` — honest empty. Prefer this discipline for LIVE local map.

### Domain amenities elsewhere?

| Area | Amenities? |
|------|------------|
| `src/features/court-cluster/**` | No amenities field found |
| `src/models/venue.js` | No |
| Public court DTO | type/surface/availability — not amenities |
| Public `CourtCard.jsx` | **Does not render** `amenities` today |

---

## Root cause

```text
LIVE_COURT_AMENITIES_ROOT_CAUSE=
mapLiveCourts() invents amenities arrays with no backing field in club blob / cluster / venue.
```

---

## Wave 1 truthful remediation (minimum)

```text
LIVE_COURT_TRUTHFUL_REMEDIATION=
Omit fabricated amenities on LIVE map (amenities: [] or omit key).
Do not substitute assumed truths.
Do not rebuild /courts UI.
Do not add cluster detail.
Do not create court authority.
Unknown != assumed true.
```

Optional UI (only if amenities later rendered): show nothing or “Chưa cập nhật” — **defer display copy to Wave 5** unless a component already shows them (today: none in public cards).

Mock `MOCK_COURTS` amenities remain under **SAFE_EXPLICIT_FALLBACK** when MOCK/MIXED notice is shown — out of scope to purge mocks in Wave 1 (honesty label already exists).

---

## Nav wording boundary

Global nav label “Sân” pointing to `/courts` is acceptable for Wave 1 routing integrity. Full “Cụm sân / cơ sở” copy + cluster detail = **Wave 5**. No mandatory shell wording change in Wave 1 unless Owner insists (not required for integrity).

---

## Implementation touch

| File | Change |
|------|--------|
| `publicClubsCourtsDataSource.js` `mapLiveCourts` | Remove hardcoded amenities |
| Tests | Assert LIVE mapper does not emit invented amenity strings |

```text
MUST_CHANGE_WAVE_1 += publicClubsCourtsDataSource.js (amenities only)
DEFER_TO_LATER_WAVE += CourtsPage redesign, cluster detail, physical child UX
```
