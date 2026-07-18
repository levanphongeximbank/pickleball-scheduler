# 01 — Profile Field Contract

| Field | Type | Notes |
|-------|------|-------|
| `birthDate` | `YYYY-MM-DD` \| `null` | Real calendar dates only; never invented from `birthYear`; private by default |
| `birthYear` | `integer` \| `null` | May derive from `birthDate` on read; standalone year remains valid |
| `ageGroup` | derived string \| `null` | Read-only; bands U12/U14/U16/U18/Open; reference = UTC calendar day (`referenceDate` or now) |
| `handedness` | `right` \| `left` \| `ambidextrous` \| `unknown` | Legacy labels via adapters |
| `activityRegion` | `{ countryCode, provinceCode, provinceName, city, district }` \| `null` | Ranking mocks not canonical |
| `privacySettings` | complete object | Fail-closed defaults |
| `verificationStatus` | `unverified` \| `pending` \| `verified` \| `rejected` | Identity only — not rating |

## Privacy defaults

```text
publicProfileEnabled: false
showPhone: false
showEmail: false
showBirthDate: false
showBirthYear: false
showActivityRegion: false
showClubMemberships: false
showGender: true
showHandedness: true
```
