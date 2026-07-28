# PRIVATE-PAIRING-HARD-CUTOVER-01 — Audit & Implementation Plan

**Base:** `origin/main` @ `27e231a2`  
**Branch:** `feature/private-pairing-hard-cutover-01`  
**Worktree:** isolated from PR #328 (`feature/platform-hard-cutover-01-m8-text-tenant-hotfix`)

## Phase A findings

| Gap | Location | Plan |
|-----|----------|------|
| `private_pairing_rules` missing from matrix | `runtimeAuthorityMatrix.js` | Register domain + fail-closed codes |
| Picker `legacy_blob` when canonical OFF | `privatePairingPlayerPickerAdapter.js` | Forbid under hard cutover; keep when OFF |
| Silent `3.5` | `generateTeamCandidates.js`, `scoreSoftOnCandidate.js` | Policy helper; exclude/fail-closed under HC |
| No hard-cutover Staging acceptance | docs | Staging acceptance + first-use reseed playbooks |
| No first-use after wipe | wipe truncates pairing tables | Document RPC-only reseed |

## Classification before

`C. PARTIALLY_CANONICAL_HYBRID_RUNTIME`

## Classification target after code

`B. CANONICAL_RUNTIME_WITH_LEGACY_COMPAT_OFF_PATH` — hybrid only when hard cutover OFF; hard cutover ON forbids legacy picker + silent rating invent.

## Non-goals

- Do not modify PR #328
- Do not apply SQL / touch Production
- Do not change rule SSOT / RPC writer architecture
- Do not expand Player Rating ownership
- Do not finalize Competition SSOT
