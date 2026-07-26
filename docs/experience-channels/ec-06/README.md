# EC-06 — Public Portal Certified LIVE Cutover

**Workstream:** Experience Channels EC-06  
**Branch:** `feature/experience-channels-06-public-portal-live-cutover`

## Goal

Audit Public Portal surfaces against twelve LIVE cutover gates. Implement cutover **only** for `CERTIFIED_LIVE_CUTOVER` rows. Do not force LIVE for uncertified sources. Do not invent remote APIs.

## Slice delivered

1. LIVE cutover classification vocabulary
2. Frozen certification matrix + `certifyPublicPortalLiveCutover`
3. Registry notes for EC-06 classifications
4. Lock tests proving zero certified cutovers and retained mock/preview honesty
5. **Certified runtime cutovers implemented: 0**

## Verdict

`EC_06_AUDIT_COMPLETE_NO_CERTIFIED_CUTOVER`

## Explicit non-goals

- No Competition Engine / Ranking calculation / backend contract edits
- No router / shell / provider / PWA / SQL / package changes
- No second PublicDataResult or notice component
- No forced LIVE for Clubs/Courts/Tournaments/Rankings/Home hubs

See `00_EC_06_LIVE_CUTOVER_CERTIFICATION_REPORT.md` for the full matrix.
