# 08 — Birth Date / Year Compatibility

## Rules (frozen)

1. Keep `profiles.birth_year`.  
2. Add `profiles.birth_date` (`date` null).  
3. **Never invent `birth_date` from `birth_year`.**  
4. On read: if `birth_date` present, derive display `birthYear` from date.  
5. On write: if only `birth_date`, app may set `birth_year` to match.  
6. If both provided and years differ → reject (`BIRTH_DATE_YEAR_CONFLICT`).  
7. Reject impossible / future dates (app required; optional DB CHECK).  
8. `ageGroup` remains **derived read-only** (app-owned); not a column.

## Trigger vs application

| Approach | Decision |
|----------|----------|
| DB trigger to sync year from date | **Optional later**; not required for v1 |
| Application-owned derivation | **Preferred** — already in Phase 1C utils |

Avoid trigger-first: legacy rows may have year-only; trigger complexity and silent overwrites are risky.

## Legacy transition

| Row state | Behavior |
|-----------|----------|
| year only | Valid; birth_date null |
| date only | Valid; birth_year derived on read/write |
| both consistent | Valid |
| both conflicting | Reject new writes; backfill report for legacy cleanup |
| future date | Reject |

## Reference date for age

UTC calendar day (`referenceDate` or now) — documented in Phase 1C `birthDate.js`.
