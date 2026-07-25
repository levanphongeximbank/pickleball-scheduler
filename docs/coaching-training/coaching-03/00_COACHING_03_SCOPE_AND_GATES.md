# COACHING-03 — Scope & Gates

**Workstream:** COACHING-03 — Staging Apply & Runtime Certification  
**Status:** Package / preflight authoring only  
**Owner GO:** NOT GRANTED  
**Staging SQL applied:** NO  
**Database writes:** ZERO  
**Production access:** FORBIDDEN  

## In scope

- Author guarded Staging activation package for exact COACHING-02 SQL.
- Author least-privilege role-permission proposal (not applied).
- Author read-only Staging preflight tooling with DB `BEGIN READ ONLY` enforcement.
- Author certification, fixture, and rollback plans (not executed).
- Local certification + PR open awaiting Owner GO.

## Out of scope

- Staging SQL apply
- Permission seed / role grant execution
- Fixture creation
- Mutation RPC execution
- UI / runtime cutover
- Production access
- package.json / package-lock.json changes
- Rebase / reset / force-push / stash mutation / PR merge

## Gate model (must not skip)

| Gate | Name | Current step |
|------|------|--------------|
| **A** | Local package certification | IN PROGRESS / required |
| **B** | Remote read-only Staging preflight | Allowed if read-only proven |
| **C** | Owner GO (`COACHING_03_OWNER_GO_APPLY_STAGING`) | NOT GRANTED |
| **D** | Controlled Staging apply | BLOCKED without C |
| **E** | Schema / RLS / runtime certification | After D |
| **F** | Fixture cleanup + residual verification | After E |
| **G** | PR / merge / post-merge closure | Owner-driven; no merge in this step |

**Hard rule:** Do not jump from Gate B to Gate D.

## Canonical SQL source

Only `docs/coaching-training/coaching-02/` numbered pack pinned by  
`docs/coaching-training/coaching-03/sql-migration-manifest.json`.

Phase 28 (`docs/v5/PHASE_28_COACHING.sql`) is **rejected**.

## Pattern sources (selective)

| Pattern | Reused from |
|---------|-------------|
| LF-normalized SHA pins + numbered pack | Customer Management Phase 7 |
| Owner token + deferred role matrix | CRM Phase 1H / 1H-B |
| Readiness package + evidence structure | Communication ACT-01/02 |
| Backup/readiness + RLS adapter verify | Finance Phase 1H |
| `BEGIN READ ONLY` … `ROLLBACK` probe | CRM 1H-B evidence convention |

## Entry conditions for future apply (Gate D)

All must be true simultaneously:

1. `--execute`
2. Exact Staging project ref `qyewbxjsiiyufanzcjcq`
3. Exact expected git commit = clean HEAD
4. Clean worktree
5. Preflight PASS evidence
6. Matching SQL checksums
7. Token `COACHING_03_OWNER_GO_APPLY_STAGING`
8. `environment=staging`
9. Target ≠ Production ref
10. `productionAllowed=false`
