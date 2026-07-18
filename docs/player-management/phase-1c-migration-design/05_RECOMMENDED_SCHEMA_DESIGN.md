# 05 — Recommended Schema Design

**Docs-only specification — not executable SQL.**

## Object

`ALTER TABLE public.profiles` — additive columns only.

## Columns

| Column | Type | Null | Default | Comment |
|--------|------|------|---------|---------|
| `birth_date` | `date` | YES | NULL | Full DOB; never invent from birth_year |
| `handedness` | `text` | YES | NULL | right\|left\|ambidextrous\|unknown |
| `activity_region` | `jsonb` | YES | NULL | Structured region object |
| `privacy_settings` | `jsonb` | YES | NULL | Fail-closed object when present |
| `identity_verification_status` | `text` | NO | `'unverified'` | Identity verification only |

**Retain unchanged:** `birth_year integer null`, `gender text null`, `player_id text null`.

## Constraints (prefer text + CHECK)

```text
profiles_handedness_check:
  handedness IS NULL OR handedness IN ('right','left','ambidextrous','unknown')

profiles_identity_verification_status_check:
  identity_verification_status IN ('unverified','pending','verified','rejected')

profiles_birth_date_not_future_check:  -- optional DB-side; app also validates
  birth_date IS NULL OR birth_date <= CURRENT_DATE

profiles_birth_date_year_consistency_check:  -- optional; prefer app-owned if legacy conflicts exist
  birth_date IS NULL OR birth_year IS NULL OR EXTRACT(YEAR FROM birth_date)::int = birth_year
```

**Prefer CHECK over PostgreSQL ENUM** for safer evolution (add values without enum migration pain).

## Indexes

| Index | Purpose |
|-------|---------|
| `(identity_verification_status)` partial WHERE status <> 'unverified' | Admin queues |
| GIN `(activity_region)` optional later | Region search |
| No index required initially on privacy_settings | Read-by-row |

## Comments

Document each column as **Player Management foundation field**; Identity must not treat as RBAC.

## Grants / RLS

No anon public SELECT of sensitive columns. See `06_RLS_AND_AUTHORIZATION_DESIGN.md`.

## Ordering

1. Additive columns + CHECKs + defaults  
2. Backfill privacy defaults / verification default  
3. RLS policy refresh / column comment  
4. App allowlist + repository wiring (separate implementation task)  

## Idempotency

Use `ADD COLUMN IF NOT EXISTS` pattern in future SQL task; CHECKs named and droppable.

## Rollback approach

See `09_BACKFILL_AND_ROLLBACK_PLAN.md` — drop columns or leave nullable unused.
