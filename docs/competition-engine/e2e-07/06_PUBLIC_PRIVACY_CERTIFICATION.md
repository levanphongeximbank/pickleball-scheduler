# E2E-07 — Public Privacy Certification

Checks via `runPublicPrivacyCertification.js`:

1. Unpublished competition fail-closed (empty public store)
2. Private participant (`publicVisible: false`) stripped from public participants projection
3. Forbidden keys absent after `stripForbiddenKeys` (email, grantedPermissions, audit operator fields, etc.)
4. `matchCenter.realtimeEnabled === false` (no realtime backend claimed)
5. Unresolved tie preserved in standings when present in published snapshot

Uses `createPublicCompetitionExperienceFacade` + in-memory public store only.
