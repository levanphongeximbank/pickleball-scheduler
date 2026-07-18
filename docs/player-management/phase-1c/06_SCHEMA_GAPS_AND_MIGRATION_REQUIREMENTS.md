# 06 — Schema Gaps and Migration Requirements

## Gaps (no column today)

| Field | Suggested future column (not applied) |
|-------|----------------------------------------|
| `birthDate` | `profiles.birth_date date null` |
| `handedness` | `profiles.handedness text check (... )` |
| `activityRegion` | `profiles.activity_region jsonb null` |
| `privacySettings` | `profiles.privacy_settings jsonb null` |
| `verificationStatus` | `profiles.identity_verification_status text check (...)` |

Existing: `profiles.birth_year` — keep.

## Migration status

| Item | Value |
|------|-------|
| Migration required | **YES** |
| Migration created in this task | **NO** |
| Migration applied | **NO** |

Owner must separately approve an additive SQL plan before Production/Staging apply.
