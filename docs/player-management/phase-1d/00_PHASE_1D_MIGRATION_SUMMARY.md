# Phase 1D — Player Profile Migration SQL (Staging readiness)

**Branch:** `feature/player-phase-1d-profile-migration-staging`  
**Base:** latest `origin/main` including merged PR #69 (runtime bootstrap)  
**Status:** SQL package authored + static tests — Staging apply is Owner-gated

## Objective

Canonical additive migration for Player Management profile fields on `public.profiles`, with Staging-first rollout readiness. Reuses Phase 1C approved design; embeds the Phase 1C guard **auth hotfix** so Staging apply never ships the defective `current_user = 'postgres'` bypass.

## Field map

| App (camelCase) | Column | Notes |
|-----------------|--------|-------|
| `birthDate` | `birth_date` | nullable `date`; never invent from year |
| `birthYear` | `birth_year` | **existing** — retained |
| `handedness` | `handedness` | nullable enum-like text |
| `activityRegion` | `activity_region` | nullable jsonb object |
| `privacySettings` | `privacy_settings` | jsonb; fail-closed default |
| `verificationStatus` | `identity_verification_status` | NOT NULL default `unverified`; self-write blocked |

## Package

| Artifact | Path |
|----------|------|
| Forward migration | `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` |
| Verify | `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql` |
| Rollback | `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql` |
| Staging runbook | `docs/player-management/phase-1d/02_STAGING_APPLY_RUNBOOK.md` |
| Production hold | `docs/player-management/phase-1d/03_PRODUCTION_HOLD_GATE.md` |

## Additive / destructive

- **Additive:** columns, constraints, index, guard function body, trigger reaffirm  
- **Non-destructive:** no table replace, no truncate, no invent of `birth_date` from `birth_year`  
- **Rollback:** column drops are destructive of Phase 1D field values only (Owner approval required)

## Protected fields

- App: `updatePlayerProfile` forbids `verificationStatus` / identity verification aliases  
- DB: `profiles_guard_privileged_update` blocks self changes to `identity_verification_status`  
- No `service_role` in browser/runtime Player Management code

## Explicit non-goals

- No Production SQL apply  
- No Production deploy  
- No Phase 1E  
- No Competition / Venue / Club / Notification / Finance / Ranking changes  
- No automatic Staging apply from CI
