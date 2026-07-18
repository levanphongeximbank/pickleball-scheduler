# 09 — Backfill and Rollback Plan

## Backfill scope

All existing `profiles` rows after additive migration.

| Field | Backfill |
|-------|----------|
| `birth_date` | Leave NULL (do not invent) |
| `birth_year` | **Preserve** existing values |
| `handedness` | NULL |
| `activity_region` | NULL |
| `privacy_settings` | Optional: set fail-closed jsonb defaults for all rows **or** leave NULL and apply defaults on read (prefer explicit jsonb for auditability) |
| `identity_verification_status` | DEFAULT `'unverified'` (column default handles new+existing if NOT NULL DEFAULT) |

## Ambiguous / invalid legacy

| Case | Handling |
|------|----------|
| Conflicting future date if any bad imports | Report + leave null; do not auto-fix |
| Non-canonical gender strings | Out of this migration; existing adapters |
| Blob-only demographics | Do **not** mass-copy into profiles without Owner-approved linking plan |

## Mode

**Phased:**  
1) Schema apply  
2) Default verification + optional privacy jsonb update  
3) Verification queries  
4) App wiring  

Synchronous mass demographic invent is forbidden.

## Verification queries (design)

- Count null vs non-null new columns  
- Count privacy_settings missing keys  
- Confirm no birth_date > CURRENT_DATE  
- Confirm birth_date year matches birth_year where both set  
- Confirm CHECK constraints present  

## Rollback

| Level | Action |
|-------|--------|
| Before app wiring | `DROP COLUMN IF EXISTS` new columns (Staging) |
| After wiring | Feature-flag off Player durable repo; columns may remain unused |
| Production | Restore from backup / reverse migration only with Owner approval |

Never delete `birth_year` in rollback of Phase 1C additive columns.
