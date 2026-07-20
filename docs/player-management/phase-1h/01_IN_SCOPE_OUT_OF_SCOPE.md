# Phase 1H — In-Scope / Out-of-Scope Matrix

Companion to `00_PHASE_1H_SCOPE_FREEZE.md`. Owner-approved 2026-07-20 (`APPROVE_PHASE_1H_SCOPE`).

## Classification

**A — Authorized Player Verification Workflow (admin-only)**

## In scope

| ID | Item | Sub-phase |
|----|------|-----------|
| I1 | Explicit `updatePlayerVerificationStatus` privileged writer | 1H-A |
| I2 | Never accept verification via generic `updatePlayerProfile` | 1H-A |
| I3 | Admin authorization checked before write | 1H-A |
| I4 | Same-tenant / same-venue enforcement | 1H-A |
| I5 | Explicit transition validation for status model | 1H-A |
| I6 | Audit logging on every successful privileged write | 1H-A |
| I7 | Admin verification queue listing pending / actionable players | 1H-B |
| I8 | Queue reads via Player facade / internal viewer mode only | 1H-B |
| I9 | No raw public exposure of verification internals | 1H-B |
| I10 | Admin actions: set `pending`, `verified`, `rejected` | 1H-C |
| I11 | Optional reset to `unverified` only if explicitly justified | 1H-C |
| I12 | Audit every successful admin action | 1H-C |
| I13 | Minimal entry from existing admin / User Management shell | 1H-D (optional) |
| I14 | Focused verification service/UI tests + Player Management regression suite | 1H-A–C |

## Status model (in scope)

| Status | In scope for admin transitions |
|--------|--------------------------------|
| `unverified` | Default; optional admin reset only if justified |
| `pending` | Yes |
| `verified` | Yes |
| `rejected` | Yes |

## Safety rules (in scope / mandatory)

| ID | Rule |
|----|------|
| S1 | Self cannot modify `identity_verification_status` |
| S2 | Normal `updateSelfProfile` remains forbidden for verification |
| S3 | Generic `updatePlayerProfile` must not accept verification status |
| S4 | Privileged writer must be explicit |
| S5 | Authorization checked before write |
| S6 | Venue / tenant boundary enforced |
| S7 | Every successful privileged action audited |
| S8 | Public / directory projections never expose raw verification internals |

## Out of scope

| ID | Item |
|----|------|
| O1 | Self-service verification request |
| O2 | Self → `pending` (or any self verification write) |
| O3 | New SQL or schema |
| O4 | Production SQL apply |
| O5 | Public Player Directory UI (was 1F-B3 / 1G-E) |
| O6 | Legacy dossier / club blob / AI session player write cutover (was 1F-D / 1G-D) |
| O7 | Duplicate merge / link tooling |
| O8 | Full Admin Player Management / ops dossier rewrite |
| O9 | Club / Competition / Rating / Ranking / Venue / Notification feature rewrites |
| O10 | Production deployment as part of this phase |
| O11 | Broad Player audit / change-history product (beyond verify-action audit) |
| O12 | Expanding Phase 1H into deferred candidates without Owner `REVISE_SCOPE` |

## Deferred boundaries

| Item | Requires |
|------|----------|
| Legacy cutover | Owner `REVISE_SCOPE` |
| Public directory UI | Owner `REVISE_SCOPE` |
| Dedupe / merge tooling | Owner `REVISE_SCOPE` |
| Broad audit/history product | Owner `REVISE_SCOPE` |
| Full Admin Player Management | Owner `REVISE_SCOPE` |
| Self-service verification (needs SQL) | Owner `REVISE_SCOPE` + separate SQL gate |
