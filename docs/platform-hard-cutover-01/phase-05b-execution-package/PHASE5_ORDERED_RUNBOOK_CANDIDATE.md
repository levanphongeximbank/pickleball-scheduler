# PHASE 5 — ORDERED RUNBOOK CANDIDATE (Phase 5B V2)

**Status:** CANDIDATE ONLY — Owner review required in a separate step.  
**Correction:** `PHASE5B_V2_INTEGRITY`  
**executionRunbookAccepted:** `false`  
**productionExecutionGo:** `false`  
**Phase 5 readiness:** `BLOCKED_PHASE5_READINESS`  
**PHASE_05_COMPLETE:** `NOT_ISSUED`  
**Phase 5B package decision (historical):** `BLOCKED_PHASE5B_EXECUTION_PACKAGE`  
**Phase 5C superseding decision:** `BLOCKED_PHASE5C_TT5D_CERTIFICATION`  
**Current M9 verdict:** `BLOCKED_STAGING_TT5D_PREEXISTING_WITHOUT_CONTROLLED_MIGRATION_PROVENANCE`  
**M9 executable count remains:** `20` (TT5D `190–220` still non-executable)

This document does **not** authorize Production execution. **CODE/SQL PACKAGE ONLY — NOT APPLIED.** Phase 5C did **not** apply TT5D on Staging (STOP before mutation).

---

## Hard gates (cannot waive)

1. Proven Production backup **and** proven restore entry (currently `NOT_PROVABLE`).
2. `executionRunbookAccepted=true` only after separate Owner acceptance.
3. `productionExecutionGo=true` only after every gate below passes.
4. Hard-cutover flags remain **OFF** until all prior verification passes.

---

## Unambiguous execution sequence

| # | Step | Exact artefacts / action | STOP |
|---|------|--------------------------|------|
| 1 | Proven Production backup + proven restore entry | Owner-supplied proof only | STOP if unproven |
| 2 | Maintenance / quiesce | Operator procedure | STOP if traffic not quiesced |
| 3 | Target / project-ref guard | Production `expuvcohlcjzvrrauvud` only | STOP on mismatch |
| 4 | Identity + protected-object prechecks | Catalog SELECT-only | STOP on fail |
| 5 | **M0 verify-only** | `docs/production-security/prod-sec-g3-b12-01/11_VERIFY.sql` | STOP on fail; do not reopen lockdown |
| 6a | **M1→M8** exact ordered apply/verify | Exact paths + `sha256ExactGitBlobBytes` in `M0_M11_EXECUTION_MANIFEST.json` (no globs). M8 tenant contract `tenant_id`/`p_tenant_id`/`user_venue_id()` = **text** | STOP after each family |
| 6b | **M9A TT2B–TT4** | Executable only: `10→100` (incl. `85_TT4_*`) per `M9_MANIFEST.json` | STOP after partial verify |
| 6c | **M10 Referee V5** | `sql/m10-referee-v5/10→40` then `99_VERIFY.sql` | STOP on fail |
| 6d | **M9B TT5B–TT5C–TT6B** | Executable: `110→180` then `230→240` **only if M10 verify PASS**. **TT5D (`190–220`) is NON_EXECUTABLE_CANDIDATE — do not apply** | STOP on fail; package remains BLOCKED until TT5D Staging certified |
| 6e | **M11 digest** | **`VERIFY_ONLY_ALREADY_EQUIVALENT`** — run `99_VERIFY.sql` only. Do **not** apply `10_PRIVATE_PAIRING_DIGEST.sql` unless live metadata differs (then STOP for new applicability decision) | STOP on fail / STOP if live delta |
| 7 | Ordered wipe | `phase-04/sql/destructive/10_ORDERED_WIPE.sql` | After wipe: backup restore is primary recovery |
| 8 | Permanent **DROP** `club_ai_data` | After dependency closure PASS; **no recreate** | Irreversible without backup |
| 9 | Post-wipe structural / protected-row verification | SELECT/catalog-only | STOP on fail |
| 10 | Reseed groups 01–17 | Authored reseed packs | STOP per group |
| 11 | `99_VERIFY_RESEED.sql` | Reseed verify | STOP on fail |
| 12 | Keep hard-cutover flags **OFF** | Until all prior verifies pass | — |
| 13 | Set approved `VITE_*` Production values | **Before** build | STOP if unset |
| 14 | Build/deploy approved source SHA | Exact Owner-approved SHA | STOP on SHA mismatch |
| 15 | Verify SHA, Ready/Current, aliases | Vercel/host evidence | STOP on fail |
| 16 | Production smoke + Operator Acceptance | 17/17 required | STOP on fail |
| 17 | Issue `PHASE_05_COMPLETE` | **Only** after every gate passes | Not issued in Phase 5B |

---

## Per-family card (M0–M11)

### M0 — G3-B12
- **Precondition:** Production lockdown already present.
- **Artefacts:** verify-only `11_VERIFY.sql`.
- **Expected:** deny-all client policy still locked.
- **STOP:** after verify, before M1.
- **Rollback:** do not reopen anon policies.
- **Backup-only after:** N/A (verify-only).

### M1–M7
- **Precondition:** prior family verify PASS.
- **Artefacts:** exact ordered paths in `M0_M11_EXECUTION_MANIFEST.json` (authored packages not rewritten).
- **STOP:** after each family verify / catalog boundary.
- **Rollback:** exact rollback paths in unified manifest **before wipe**, or documented irreversibility.
- **Backup-only after:** wipe / DROP / flag enable.

### M8 — Competition Remote SSOT
- **Precondition:** M7 verify PASS; `user_venue_id()` result type text.
- **Artefacts:** exact `10_TABLES` → `52_GRANTS_EXACT_BASELINE` → `99_VERIFY` paths in unified manifest.
- **Expected:** `competition_ssot_*` present; `tenant_id`/`p_tenant_id` = text.
- **STOP:** after `99_VERIFY`.
- **Rollback:** `90_ROLLBACK.sql` before wipe.
- **Backup-only after:** wipe.

### M9 — Team Tournament remainder
- **Precondition:** P1/TT1B foundations present; **M10 verify PASS before any TT5B+ executable file**.
- **Executable artefacts:** 20 files in `M9_MANIFEST.json` `orderedApply` (TT2B–TT4, TT5B–TT5C, TT6B).
- **Non-executable candidates:** TT5D `190–220` — `executionEligible=false`, checksum-protected only.
- **Expected:** verified objects for executable subset per `99_VERIFY.sql`.
- **STOP:** after M9A; after M9B; package BLOCKED until TT5D Staging certification.
- **Rollback:** `90_ROLLBACK.sql` drops **new** bridge objects only; replaced RPCs = **BACKUP_PITR_ONLY_AFTER_REPLACE** / `ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS`.
- **Backup-only after:** any `CREATE OR REPLACE` of pre-existing TT RPCs; wipe.

### M10 — Referee V5
- **Precondition:** M8 preferred; M9A complete in this interleaved sequence.
- **Artefacts:** `10_V5A` → `20_V5D` → `30_V5D1` → `40_V5D32` → `99_VERIFY`.
- **Excluded:** V5D3 fault injection; V5D4 fault-injection apply; V5E1 staging-only publication.
- **Expected:** `referee_v5_*` present; legacy token RPCs preserved.
- **STOP:** after verify, before M9B.
- **Rollback:** `90_ROLLBACK.sql` drops M10-owned V5 objects only.
- **Backup-only after:** wipe.

### M11 — Private pairing digest
- **Precondition:** RC1 archive present.
- **Action:** **`VERIFY_ONLY_ALREADY_EQUIVALENT`** — `99_VERIFY.sql` only.
- **Reference candidate (do not apply):** `10_PRIVATE_PAIRING_DIGEST.sql` (`STAGING_CATALOG_DERIVED`), retained checksum-protected.
- **Expected:** `def_md5=0be77671…`; `extensions.digest`; search_path fixed. If live metadata differs → STOP for new applicability decision.
- **STOP:** after verify, before wipe.
- **Rollback:** re-apply reference SQL only if a divergent body was introduced (noop when already equivalent).
- **Backup-only after:** wipe.

---

## Non-goals of this candidate

- No Production GO.
- No SQL apply in Phase 5B / V2 correction.
- No wipe / DROP / reseed / flag change / deploy by this workstream.
- No Staging TT5D activation in this correction.
