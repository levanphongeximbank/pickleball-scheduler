# PR-4.26 — Canonical Consumer Migration

## Status

Implemented on `feature/private-pairing-rules-v2`. Production flags remain **OFF**. No migration / backfill / deploy.

## Baseline

| Item | Value |
|------|--------|
| PR-4.25 HEAD | `9a9a62f` |
| Verdict after PR-4.25 | PARTIALLY CONSISTENT |
| Goal | Migrate Daily Play, Tournament pickers, Athlete list to shared canonical adapter |

## Shared adapter

```
UI consumer
  → useClubPlayerPool / useTenantPlayerPool
    OR get*Aware service helpers
  → canonicalPlayerPickerAdapter
  → CanonicalPlayerRepository
  → CanonicalMembershipRepository
  → club_members (+ profiles index)
```

Path: `src/features/club/repositories/canonicalPlayerPickerAdapter.js`  
Hook: `src/features/club/hooks/useClubPlayerPool.js`

Flags (unchanged):

- `VITE_CANONICAL_CLUB_REPOSITORY_ENABLED=false`
- `VITE_CANONICAL_PLAYER_REPOSITORY_ENABLED=false`

## Consumer migration inventory

| Consumer | Current source (flags ON) | Canonical migration | Flag OFF | Remaining legacy dependency | Risk |
|----------|---------------------------|---------------------|----------|-------------------------------|------|
| Private Pairing | Shared picker adapter | Done (PR-4.25) | Legacy blob | — | Low |
| Daily Play setup | `useClubPlayerPool` | Done | Adapter → blob | Business filters unchanged | Low |
| Internal tournament | `*Aware` + club pool | Done | Sync legacy helpers | Invite bypass when OFF | Low |
| Official tournament | `useTenantPlayerPool` / `useClubPlayerPool` | Done | Legacy via adapter | Eligibility still UI-side | Low |
| Team tournament setup | Hooks | Done | Legacy | — | Low |
| Team roster club filter | `listPlayersForClubAware` | Done | Legacy | — | Low |
| Individual registration | `useClubPlayerPool` | Done | Legacy | — | Low |
| Athlete list (club mode) | `listPlayersForClubAware` | Done | Blob list | CRUD still writes blob | Medium |
| Platform athletes | `getClubPlayersPlatformWideAware` | Done | Blob scan | Orphan `profile-*` merge kept | Medium |
| ClubContext | Clubs only | N/A | — | Not a player source | — |
| SelectPlayers (Xếp sân) | `loadPlayersForClub` | **Not migrated** | Legacy | Scheduling AI path | Medium |
| Court engine / CourtManagement | `loadPlayersForClub` | **Not migrated** | Legacy | Operational, not tournament | Medium |
| Team portal | `loadPlayersForClub` | **Not migrated** | Legacy | Satellite portal | Medium |
| MyClub members panel | `getTenantPlayers` + blob | **Not migrated** | Legacy | Club admin satellite | Medium |
| Club overview / match history tabs | `getTenantPlayers` sync | **Not migrated** | Legacy | Display aggregates | Low |
| Tournament eligibility / quick-add | blob helpers | **Not migrated** | Legacy | Satellite tournament UX | Medium |
| Check-in mobile / director | blob / local | **Not migrated** | Legacy | Offline-first flows | Medium |
| `teamTournamentService` roster resolve | `loadPlayersForClub` | **Not migrated** | Legacy | Service-side lookup | Medium |

Primary picker consumers for Daily Play / Tournament / Athlete / Private Pairing no longer call `loadPlayersForClub` on the canonical-ON path.

## Identity contract

Picker values remain **canonical `playerId`** (`id` in legacy projection). Never profile/auth/tenant/club id as the selectable value.

## Default club

Excluded when club canonical flag ON (shared adapter + club repository).

## Known limitations

- Some satellite tournament pages (eligibility, quick-add, portals) still call `loadPlayersForClub` directly.
- Athlete CRUD still persists to club blob even when list reads from membership.
- Profile `player_id` enrichment still requires injectable profile map / follow-up RPC; Production `club_list_members` does not return `player_id`.
- No Production backfill.

## Rollback

1. Keep flags OFF (default).
2. Revert PR-4.26 commits if needed.
3. No DB rollback.
