# 04 — Backfill Behavior

## Allowed (implemented)

| Field | Behavior |
|-------|----------|
| `birth_year` | **Preserved** — never rewritten |
| `birth_date` | Left **NULL** — never invented from year |
| `handedness` | Left **NULL** |
| `activity_region` | Left **NULL** |
| `privacy_settings` | Set to complete fail-closed jsonb for NULL rows |
| `identity_verification_status` | `'unverified'` via `NOT NULL DEFAULT` |

## Fail-closed privacy object

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

## Not allowed (not implemented)

- Generate `birth_date` from `birth_year`
- Infer handedness
- Infer region from mock/ranking data
- Mark identities verified without evidence
- Rewrite existing `player_id` values
