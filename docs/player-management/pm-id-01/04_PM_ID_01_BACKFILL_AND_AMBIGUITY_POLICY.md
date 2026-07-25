# PM-ID-01 — Backfill and Ambiguity Policy

## Current step

**Backfill is NOT executed.**

| Flag | Value |
|------|-------|
| `backfillExecuted` | `false` |
| `mappingRowsCreated` | `0` |
| Staging DML | **NOT ALLOWED** |
| Production | **NOT ALLOWED** |

This document is design-only for a future Owner-authorized backfill wave.

---

## Candidate classification

Every candidate principal×tenant×club must be classified as exactly one:

| Class | Rule |
|-------|------|
| `SAFE_DETERMINISTIC` | Exactly one verified one-to-one mapping key with no conflicts |
| `UNMAPPED` | No deterministic candidate |
| `INACTIVE` | Only revoked/historical evidence |
| `AMBIGUOUS` | ≥2 distinct plausible `player_id` values |
| `INVALID` | Broken/malformed references |

Only `SAFE_DETERMINISTIC` may be written in a future backfill apply.

---

## Allowed deterministic keys (future)

Safe only when **all** hold:

1. Explicit accepted alias already equals a single canonical `player_id` **and**
2. No conflicting blob/athlete/profile candidates **and**
3. Membership scope is unique and active **and**
4. No email/name/phone inference required.

Examples that remain **unsafe** even if tempting:

- Display name match
- Email match (unless a future Owner-approved **canonical verified** email key exists — **not** claimed here)
- Phone match
- First row of `ORDER BY created_at`
- Silent `player-auth-{uid}` mint during backfill

---

## Required backfill controls (future wave)

| Control | Requirement |
|---------|-------------|
| Dry-run mode | Default; prints exact counts only |
| Zero-write default | Writes require explicit Owner GO |
| Exact counts | `SAFE_DETERMINISTIC` / `UNMAPPED` / `INACTIVE` / `AMBIGUOUS` / `INVALID` |
| Idempotency | Re-run must not create duplicate ACTIVE links |
| Rollback/revoke | Prefer revoke of backfill provenance rows; no hard delete of history |
| Production | **Out of scope** for PM-ID-01 and immediate next wave unless separately authorized |

Owner GO token (future): distinct from `PM_ID_01_OWNER_GO_APPLY_STAGING` (schema apply) — e.g. `PM_ID_01_OWNER_GO_BACKFILL_STAGING` (not granted).

---

## Ambiguity handling

- Never auto-merge.
- Never pick first candidate.
- Surface `AMBIGUOUS` counts to Owner.
- Manual remediation outside this package.

---

## Provenance for future writes

Backfill rows must set:

- `provenance = 'deterministic_backfill'`
- `source_system = 'pm-id-01-backfill'`
- `created_by` = acting admin principal (or NULL only if maintenance role explicitly documented)
