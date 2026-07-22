# 02 — Pre-Apply Safety Baseline

**Captured:** 2026-07-21 (local agent session)
**Secrets printed:** none

## Repository identity

| Item | Value |
|------|-------|
| Working directory | `C:\Users\Le Phong\PICK_VN-Workstreams\crm` |
| Branch | `feature/crm-phase-1h-b-staging-apply` |
| Starting HEAD | `6285476fc2665a49a9e3f290ed5cb6a79c4c666d` |
| origin/main SHA | `6285476fc2665a49a9e3f290ed5cb6a79c4c666d` |
| Working-tree at phase open | clean |
| Phase 1H-A in history | yes — merge PR #139 (`6285476`), commits `11772e7`, `389fcc7` |

## Manifest verification

| Check | Result |
|-------|--------|
| Manifest path | `docs/crm/phase-1h/staging-migration-manifest.json` |
| Environment target | `staging` |
| Migration count | 8 |
| Contiguous order 1..8 | PASS |
| SHA-256 pin verify | PASS (`verifyCrmStagingMigrationManifest` ok) |
| Production blocklist | `expuvcohlcjzvrrauvud` present |
| Staging allowlist | `qyewbxjsiiyufanzcjcq` present |
| Exact order | 1G tables → indexes → RLS → RPCs → grants → consent → 1H permission seed → 1H role matrix |

## Exact Staging project identity source

| Item | Status |
|------|--------|
| Source | Allowlisted project ref must appear in Staging Supabase URL env |
| Allowlist | `qyewbxjsiiyufanzcjcq` |
| Env URL presence at baseline | **UNSET** (`VITE_SUPABASE_URL` / `STAGING_SUPABASE_URL` / `SUPABASE_URL`) |
| Proven Staging identity | **NO** |
| Production URL loaded | **NO** (no URL loaded) |
| Ambiguous fallback | Fail-closed (unset ≠ Staging) |

## Production project blocklist status

| Ref | Status |
|-----|--------|
| `expuvcohlcjzvrrauvud` | Blocklisted in manifest + gate code; not used as target |

## Owner approval status (separate gates)

| Gate | Status |
|------|--------|
| Permission seed apply | **MISSING** (`CRM_IDENTITY_PERMISSION_SEED_APPROVAL` unset; no CLI flag) |
| Role matrix apply | **MISSING** / treated as **deferred** (`--defer-role-matrix` default for blocked path) |
| Phase 1G persistence apply | **MISSING** (`CRM_PHASE_1G_PERSISTENCE_APPLY_APPROVAL` unset) |
| Staging backup/restore evidence | **MISSING** |
| Umbrella Staging owner approval | **MISSING** (`CRM_STAGING_OWNER_APPROVAL` unset) |

Note: Opening Phase 1H-B work is **not** inferred as apply approval. Phase 1H-A merge is **not** apply approval.

## Backup / restore evidence status

| Item | Status |
|------|--------|
| Token | unset |
| Evidence path env | unset |
| Claimed backup readiness | **NO** |

## Permission-seed / role-matrix code markers

| Marker | Status |
|--------|--------|
| `CRM_PERMISSION_SEED_APPROVAL.status` | `PROPOSED_AWAITING_OWNER_APPLY_APPROVAL` |
| `CRM_ROLE_MATRIX_APPROVAL.ownerApprovalRequiredBeforeApply` | `true` |

## Durable runtime flag status

| Item | Status |
|------|--------|
| Default composition | `memory` |
| `VITE_CRM_PERSISTENCE_MODE` | unset → treated as memory / **off** |

## Deployment status

| Item | Status |
|------|--------|
| Deploy performed | **NO** |
| Production connection | **NO** |
| SQL applied | **NO** |

## Offline preflight

`node scripts/crm/phase-1h-staging-preflight.mjs --offline --environment=staging` → **ok: true**, `sqlApplied: false`.
