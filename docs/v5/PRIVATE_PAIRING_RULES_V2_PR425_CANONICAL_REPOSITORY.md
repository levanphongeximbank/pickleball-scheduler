# PR-4.25 — Canonical Club & Player Repository

## Status

Implemented on `feature/private-pairing-rules-v2`. Production feature flags **OFF** by default. No Production migration / backfill / deploy in this PR.

## Baseline

| Item | Value |
|------|--------|
| PR-4 historical docs commit | `e33797a` |
| PR-4.25 baseline (post evidence) | `051e08b` (ancestor work HEAD `71c4dec`) |
| Consistency | **PARTIALLY CONSISTENT** — Private Pairing migrated; Daily Play / Tournament / Athlete list still legacy |

## Existing post-PR4 changes reused

- PR-4 DB/RLS/RPC + SUPER_ADMIN admin UI (on feature branch).
- Staging raise-patch / Preview evidence.
- Production QA evidence commit `051e08b`.
- **Ported** GLOBAL “CLB nguồn” selector behavior from `main` `d44dc0c` (that commit was **not** on the feature branch). Player datasource now goes through canonical repos instead of `loadPlayersForClub` when flags ON.
- **Corrected** CLUB `scope_id` to use **club_id** (not tenant_id). `tenant_id` remains a separate Rule Set field.

## SSOT decisions

| Domain | SSOT (V2 flag ON) | Legacy (flag OFF) |
|--------|-------------------|-------------------|
| Club registry | `public.clubs` via `club_list_registry` / `club_get` | `loadClubs` / `listClubsForTenant` |
| Membership | `club_members` via `club_list_members` + dedupe | optional legacy adapter |
| Player identity | membership + `profiles.player_id` / `player-auth-{userId}` policy | club blob `loadPlayersForClub` |

## Module layout

```
src/features/club/config/canonicalRepositoryFlags.js
src/features/club/repositories/
  canonicalRepositoryTypes.js
  canonicalClubRepository.js
  canonicalMembershipRepository.js
  canonicalPlayerRepository.js
  index.js
src/features/private-pairing-rules/ui/privatePairingPlayerPickerAdapter.js
```

## Feature flags

| Flag | Default | Meaning |
|------|---------|---------|
| `VITE_CANONICAL_CLUB_REPOSITORY_ENABLED` | `false` | Club list / get from V2 registry |
| `VITE_CANONICAL_PLAYER_REPOSITORY_ENABLED` | `false` | Player picker from membership SSOT |

Production must stay OFF until owner GO for enablement.

## Consumer migration status

| Consumer | Status |
|----------|--------|
| Private Pairing club source | Migrated (via picker adapter) |
| Private Pairing primary/target selectors | Migrated |
| Shared picker adapter | Added |
| Daily Play | Legacy — follow-up PR |
| Tournament participant picker | Legacy — follow-up PR |
| Athlete list | Legacy — follow-up PR |

## Default club

`default-club` / `isDefault=true` / “CLB Mặc định” is excluded from V2 canonical club lists and rejected as Private Pairing source club when club flag ON.

## ACCC cloud-only fixture

See `tests/fixtures/accc-cloud-only-club.js` and PR425 QA doc. Proves membership-backed pool with empty blob.

## Security

- Repository asserts tenant access for non-platform roles.
- Does not trust UI tenant alone for cross-tenant reads.
- Never treats `tenant_id` / `venue_id` as `club_id` or `player_id`.

## Known limitations

- `club_list_members` RPC does not return `profiles.player_id`; runtime needs a profile index injection or follow-up RPC enrichment for full Production mapping without local lookup.
- No automatic Production backfill of `profiles.player_id` or player rows.
- Daily Play / Tournament not switched yet → split-brain remains for those consumers.

## Rollback

1. Keep flags OFF (default).
2. Revert Private Pairing admin wiring to prior commit if needed.
3. No DB rollback required (no schema changes in PR-4.25).
