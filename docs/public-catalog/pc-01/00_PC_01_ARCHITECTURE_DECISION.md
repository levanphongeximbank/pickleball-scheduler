# PUBLIC-CATALOG-01 — Architecture Decision

## Decision

Ship a dedicated `src/features/public-catalog/` remote public-read module for Clubs and Courts, mirroring the NEWS-04 SECURITY DEFINER RPC + projector + typed Result pattern.

## Why

EC-06 classifies `public-clubs` / `public-courts` as `NO_REMOTE_SOURCE` because portal adapters use browser `loadClubs` / `loadClubData` with mock fallback. Certified LIVE cutover requires a remote public catalog API first.

## Contracts

| Surface | API | Provenance |
|---------|-----|------------|
| Clubs | `listPublicClubs` / `listPublicClubsRemote` | `LIVE` only |
| Courts | `listPublicCourts` / `listPublicCourtsRemote` | `LIVE` only |

## Privacy

- Clubs: opt-in `is_publicly_listed` (default `false`); allowlisted DTO only.
- Courts: dedicated `public_catalog_courts` projection table — **never** `club_data_v3` jsonb, rates, bookings, or staff.
- Anon: `EXECUTE` on RPCs only; no direct table SELECT policies for the projection table.
- No create/update/delete on the public API.
- Remote failure → typed fail (never empty success, never mock fallback).

## Non-goals (this workstream)

- Public Portal / Experience Channels runtime cutover
- Tournaments / Rankings
- Staging or Production SQL apply
- Populating court projection rows (separate ops/sync later)

## SQL status

`AUTHORED_NOT_APPLIED` — see `10_PUBLIC_CATALOG_01_PUBLIC_READ_RPC.sql`.
