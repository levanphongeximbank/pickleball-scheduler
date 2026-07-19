# 07 — Privacy and Region Storage Design

## Privacy settings → **jsonb** on `profiles.privacy_settings`

### Why jsonb (not normalized columns / separate table)

| Approach | Verdict |
|----------|---------|
| Normalized boolean columns | Rigid; many toggles; noisy migrations when adding keys |
| Separate `player_privacy` table | Extra join/RLS; premature for one object per person |
| **jsonb object** | Matches Phase 1C contract; versionable; fail-closed merge in app |

### Canonical keys + fail-closed defaults

```json
{
  "version": 1,
  "publicProfileEnabled": false,
  "showPhone": false,
  "showEmail": false,
  "showBirthDate": false,
  "showBirthYear": false,
  "showActivityRegion": false,
  "showClubMemberships": false,
  "showGender": true,
  "showHandedness": true
}
```

DB may store NULL until first write; reads apply defaults via `normalizePrivacySettings`.  
Backfill may set explicit jsonb defaults for consistency.

---

## Activity region → **jsonb** on `profiles.activity_region`

### Why jsonb (not FKs to geo tables yet)

- No approved geographic reference tables in-repo as Player SSOT.  
- Phase 1C requires flexible `countryCode`, `provinceCode`/`provinceName`, `city`, `district`.  
- Ranking mocks must **not** become FKs.

### Shape

```json
{
  "countryCode": "VN",
  "provinceCode": null,
  "provinceName": "Hà Nội",
  "city": "Cầu Giấy",
  "district": null
}
```

### Indexing

- Start without GIN.  
- Add GIN/`jsonb_path_ops` later if directory search by region is product-critical.  
- Validate shape in `updatePlayerProfile` (already designed).
