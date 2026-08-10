# team-tournament-write-lineup-revision-overload-01

**Workstream:** `TEAM-TOURNAMENT-PR412-WRITE-LINEUP-REVISION-OVERLOAD-PACKAGE-LOCK-01`  
**Status:** PACKAGE LOCKED — **DO NOT APPLY** without Owner GO.  
**Scope:** Staging overload ambiguity for `public.team_tournament_write_lineup_revision`.

## Live symptom

Captain Portal **Lưu nháp** fails with:

```text
function public.team_tournament_write_lineup_revision(
  text, text, uuid, unknown, text, unknown,
  jsonb, jsonb, integer, integer, unknown, text
) is not unique
```

## Root cause

Staging has **two** overloads:

| # | Args | Source | Role |
|---|------|--------|------|
| 1 | 12 | `docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql` | **Stale** leftover |
| 2 | 13 (+ `p_actor_role`) | `docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql` | **Canonical** (`actor_role` column present) |

`CREATE OR REPLACE` with an extra argument creates a **new** overload; it does **not** replace the 12-arg function.

`team_tournament_save_lineup_draft` / versioned `team_tournament_submit_lineup` call with **12 arguments** and untyped `NULL` / string literals → PostgreSQL cannot choose between 12-arg and 13-arg (13th defaultable).

Dreambreaker already avoids this by passing `'btc'` as the 13th argument.

Production currently has **only** the 12-arg overload — this package targets **Staging**.

## Remediation (A + B)

1. **DROP** only the stale 12-arg signature.
2. Patch save/submit call sites to pass explicit casts + `'captain'::text` as `p_actor_role` (same pattern as dreambreaker).

Does **not**: mutate lineup data, change RLS/RBAC, drop unrelated overloads (`submit` 4-arg, `confirm_sub_match`, `lock_matchup`).

## Files

| File | Purpose | SHA256 |
|------|---------|--------|
| `01_PRECHECK.sql` | Prove both overloads + ambiguous save/submit callers + grants baseline | `fbc2f7456106350b7268d33d8a5ed46d77f23fde790f1b50456fe1ea32c00d94` |
| `02_APPLY.sql` | DROP 12-arg + patch save/submit helper calls | `505caa477f7315ed8f98c4397d532ab227eb36766fa18e1e9f8a554f228e598a` |
| `03_VERIFY.sql` | Unique 13-arg; captain actor_role; grants; unrelated overloads preserved | `a63e6bae9a468615d149079a9cd02ae74d5c286460677921267372c214d661ec` |
| `04_ROLLBACK.sql` | Recreate 12-arg + restore ambiguous call shape (reintroduces bug) | `0b2b2982116e38803003b87d607428e726f332b11e3fe42a82ab566c79ba7615` |

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

## Out of scope

- Production apply (different overload state — Owner decision separate)
- Client expectedVersion / gender / captain access
- Dropping other lineup-path overloads
