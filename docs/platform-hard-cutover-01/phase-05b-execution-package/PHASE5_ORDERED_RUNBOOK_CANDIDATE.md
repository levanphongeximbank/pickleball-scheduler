# PHASE 5 — ORDERED RUNBOOK CANDIDATE (Phase 5B)

**Status:** CANDIDATE ONLY — Owner review required in a separate step.  
**executionRunbookAccepted:** `false`  
**productionExecutionGo:** `false`  
**Phase 5 readiness:** `BLOCKED_PHASE5_READINESS`  
**PHASE_05_COMPLETE:** `NOT_ISSUED`  
**Phase 5B package decision:** `BLOCKED_PHASE5B_EXECUTION_PACKAGE` (M9 TT5D Staging catalog not proven)

This document does **not** authorize Production execution.

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
| 6a | **M1→M8** exact ordered apply/verify | Existing authored packages (not rewritten in 5B). M8: `phase-04/sql/m8-competition-remote-ssot/10→52` then `99_VERIFY.sql`; tenant contract `tenant_id`/`p_tenant_id`/`user_venue_id()` = **text** | STOP after each family |
| 6b | **M9A TT2B–TT4** | `phase-05b-execution-package/sql/m9-team-tournament/` apply `10→100` (incl. `85_TT4_*`) per `M9_MANIFEST.json` | STOP after partial verify |
| 6c | **M10 Referee V5** | `sql/m10-referee-v5/10→40` then `99_VERIFY.sql`; rollback `90_ROLLBACK.sql` | STOP on fail |
| 6d | **M9B TT5B–TT6B** | Same M9 dir apply `110→240` **only if M10 verify PASS**; then full `99_VERIFY.sql` | STOP on fail — **TT5D Staging proof currently BLOCKED** |
| 6e | **M11 digest** | `sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql` then `99_VERIFY.sql` | STOP on fail |
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
- **Artefacts:** existing authored packages from `MIGRATION_MANIFEST.md` / `M0_M11_EXECUTION_MANIFEST.json` (not rewritten in Phase 5B).
- **STOP:** after each family verify.
- **Rollback:** package `90_*.sql` / documented staging rollback **before wipe**.
- **Backup-only after:** wipe / DROP / flag enable.

### M8 — Competition Remote SSOT
- **Precondition:** M7 verify PASS; `user_venue_id()` result type text.
- **Artefacts:** `10_TABLES` → `20_INDEXES` → `30_RLS` → `40_RPC_*` → `50_GRANTS` → `51_GRANTS_TIGHTEN` → `52_GRANTS_EXACT_BASELINE` → `99_VERIFY`.
- **Expected:** `competition_ssot_*` present; `tenant_id`/`p_tenant_id` = text.
- **STOP:** after `99_VERIFY`.
- **Rollback:** `90_ROLLBACK.sql` before wipe.
- **Backup-only after:** wipe.

### M9 — Team Tournament remainder
- **Precondition:** P1/TT1B foundations present; **M10 verify PASS before any TT5B+ file**.
- **Artefacts:** see `sql/m9-team-tournament/M9_MANIFEST.json` + checksums.
- **Expected:** TT2B–TT6B objects per `99_VERIFY.sql`.
- **STOP:** after M9A; after M9B full verify.
- **Rollback:** `90_ROLLBACK.sql` drops **new** bridge objects only; replaced RPCs = **BACKUP_PITR_ONLY**.
- **Backup-only after:** any `CREATE OR REPLACE` of pre-existing TT RPCs; wipe.
- **Phase 5B blocker:** TT5D Staging catalog not proven → package decision BLOCKED.

### M10 — Referee V5
- **Precondition:** M8 preferred; M9A complete in this interleaved sequence.
- **Artefacts:** `10_V5A` → `20_V5D` → `30_V5D1` → `40_V5D32` → `99_VERIFY`.
- **Excluded:** V5D3 fault injection; V5D4 fault-injection apply; V5E1 staging-only publication.
- **Expected:** `referee_v5_*` present; legacy token RPCs preserved.
- **STOP:** after verify, before M9B.
- **Rollback:** `90_ROLLBACK.sql` drops M10-owned V5 objects only.
- **Backup-only after:** wipe.

### M11 — Private pairing digest
- **Precondition:** RC1 archive present; M9B verify attempted/passed when unblocked.
- **Artefacts:** `10_PRIVATE_PAIRING_DIGEST.sql` (provenance `STAGING_CATALOG_DERIVED`) → `99_VERIFY`.
- **Expected:** `def_md5=0be77671…`; `extensions.digest`; search_path fixed.
- **STOP:** after verify, before wipe.
- **Rollback:** re-apply `10_*` (noop when already equivalent).
- **Backup-only after:** wipe.

---

## Non-goals of this candidate

- No Production GO.
- No SQL apply in Phase 5B.
- No wipe / DROP / reseed / flag change / deploy by this workstream.
