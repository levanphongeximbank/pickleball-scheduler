# TEST-HYGIENE-01 — Staging Evidence Isolation

## Problem

Full unit suite mutated tracked evidence files:

- `docs/coaching-training/coaching-03/evidence/APPLY_REFUSED.json`
- `docs/player-management/pm-id-01/activation/evidence/APPLY_REFUSED_NO_GO.json`

Root cause: activation tests spawned staging-apply runners with `cwd = repo root`, and runners always wrote evidence into canonical tracked docs paths.

## Fix

Env override: `PICK_VN_STAGING_EVIDENCE_DIR`

| Mode | Behavior |
|------|----------|
| unset / empty / whitespace | Write to canonical docs evidence directory (production/Owner behavior unchanged) |
| absolute path | Write evidence into that directory |
| relative path | Resolve against process cwd, then write there |

Helper: `scripts/shared/resolve-staging-evidence-dir.mjs`

## Scope

- `scripts/coaching/coaching-03-staging-apply.mjs`
- `scripts/player-management/pm-id-01-staging-apply.mjs`
- activation tests for both packages
- `tests/test-hygiene-01-staging-evidence-isolation.test.js`

## Non-goals

- No Staging apply
- No Production apply
- No SQL / Supabase / RLS changes
- No EC-04 changes
- Refusal semantics unchanged
- Evidence JSON shape unchanged (only destination path)
