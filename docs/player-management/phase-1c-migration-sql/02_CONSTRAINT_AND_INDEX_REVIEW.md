# 02 — Constraint and Index Review

## Constraints implemented

| Name | Rule |
|------|------|
| `profiles_birth_date_not_future_check` | `birth_date IS NULL OR birth_date <= CURRENT_DATE` |
| `profiles_handedness_check` | NULL or `right\|left\|ambidextrous\|unknown` |
| `profiles_identity_verification_status_check` | `unverified\|pending\|verified\|rejected` |
| `profiles_privacy_settings_object_check` | NULL or `jsonb_typeof = 'object'` |
| `profiles_privacy_settings_booleans_check` | Known flags, when present, must be boolean |
| `profiles_activity_region_object_check` | NULL or JSON object |

## Intentionally omitted

| Candidate | Reason |
|-----------|--------|
| `profiles_birth_date_year_consistency_check` | Legacy rows may disagree; design prefers app-owned handling |
| Strict activity_region key schema | Avoid over-constraining future geo extension |
| PostgreSQL ENUM types | Design requires text + CHECK for extensibility |

## Indexes

| Index | Included? | Justification |
|-------|-----------|---------------|
| Partial `identity_verification_status` ≠ unverified | **Yes** | Admin verification queues (design) |
| GIN `activity_region` | **No** | No current query evidence |

## Preflight for CHECK add

All new CHECKs are satisfied by NULL / default values on existing rows:

- `birth_date` NULL → passes
- `handedness` NULL → passes
- `activity_region` NULL → passes
- `privacy_settings` backfilled to object with booleans → passes
- `identity_verification_status` default `'unverified'` → passes

No destructive preflight rewrite required.
