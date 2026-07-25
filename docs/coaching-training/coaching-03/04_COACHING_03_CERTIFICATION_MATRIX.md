# COACHING-03 — Certification Matrix (Gate E — plan only)

**Status:** Authored plan — not executed in this step.

## A. Schema

| Check | Expected |
|-------|----------|
| Canonical tables | 13 tables listed in `COACHING_03_CANONICAL_TABLES` |
| Columns / types / nullability | Match `10_COACHING_02_TABLES.sql` |
| Constraints | PK / CHECK / unique as authored |
| Indexes | Match `20_COACHING_02_INDEXES.sql` |
| RLS | ENABLE + FORCE on all 13 |
| Policies | Match `30_COACHING_02_RLS.sql` (no `USING (true)`) |
| Grants | Match `50_COACHING_02_GRANTS.sql` (fail-closed) |
| RPC signatures | `coaching_apply_attendance_correction`, `coaching_consume_entitlement` |
| Triggers | Immutable guards from `60_*` |
| Immutable history | corrections + usage_events append-only; submitted evaluations protected |

## B. Authorization

Positive flows use **admin principals only**:

- `SUPER_ADMIN`
- `TENANT_OWNER` (or verified venue-owner alias)
- `VENUE_MANAGER`
- `CLUB_MANAGER`

**No positive COACH flow in COACHING-03.**

| Case | Expected |
|------|----------|
| anon | denied |
| authenticated without Coaching permission | denied |
| **COACH without Coaching permission** | **denied** (negative — required) |
| **PLAYER without Coaching permission** | **denied** (negative — required) |
| wrong tenant | denied |
| wrong club | denied |
| same-tenant / same-club + admin permission | allowed |
| unknown action | denied |
| removed membership (if helper supports) | denied |
| broad authenticated fallback | absent |

Do not create or mutate QA accounts during remediation. Prefer existing sanitized Staging admin QA labels when Gate E runs.

## C. Atomic attendance correction

| Case | Expected |
|------|----------|
| Permitted correction | PASS |
| Wrong `expectedVersion` | denied |
| Forged actor in payload | impossible (`auth.uid()` only) |
| Missing auth | denied |
| Cross-club | denied |
| Correction history | appended exactly once |
| Attendance version | increments exactly once |
| Failure | attendance + history unchanged |
| Direct UPDATE/INSERT bypass | denied |

## D. Atomic entitlement consumption

| Case | Expected |
|------|----------|
| Permitted consumption | PASS |
| Duplicate idempotency key | deterministic same result |
| Insufficient sessions | denied |
| Inactive / expired entitlement | denied |
| Cross-player | denied |
| Cross-club | denied |
| Sessions never negative | enforced |
| Usage event | exactly once |
| Failure | rolls back |
| Direct UPDATE/INSERT bypass | denied |

## E. Append-only protection

| Case | Expected |
|------|----------|
| correction UPDATE | denied |
| correction DELETE | denied |
| usage event UPDATE | denied |
| usage event DELETE | denied |
| submitted evaluation history | protected per design |

## F. Runtime adapter

| Case | Expected |
|------|----------|
| Injected Staging Supabase client | supported via port |
| Tenant/club scoped reads | yes |
| expectedVersion conflict mapping | typed |
| Typed error mapping | `errorTranslation.js` |
| Deterministic ordering | yes |
| No localStorage import in durable path | yes |
| No default runtime wiring | `COACHING_DURABLE_RUNTIME_DEFAULT = false` |
| No UI cutover | UI remains on legacy LS |

## Script (future)

```bash
node scripts/coaching/coaching-03-staging-certify.mjs
```

Default: plan/dry checklist only until Gate D complete + Owner authorizes Gate E.
