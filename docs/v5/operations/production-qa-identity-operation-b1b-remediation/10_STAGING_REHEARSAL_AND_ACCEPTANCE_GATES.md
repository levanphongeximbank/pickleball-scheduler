# 10 — Staging Rehearsal and Acceptance Gates

**Rule:** No Production GO before **all** gates in this document pass.  
**Staging mutations for rehearsal:** Allowed only under Staging credentials and Staging Owner approval (separate from Production GO).  
**This planning package authorizes:** neither Staging apply nor Production apply.

## Required sequence

1. Staging backup evidence
2. Migration preflight
3. Forward apply
4. Schema verification
5. RLS verification
6. Exact test identities preparation
7. Dry-run
8. Live reversible rehearsal
9. Auth ban rehearsal where safe
10. Rollback
11. Reapply
12. Idempotency proof
13. Runtime smoke
14. No unrelated mutation proof
15. Evidence package
16. Independent review
17. Explicit acceptance sign-off

## Gate details

### G1 — Staging backup evidence

- Documented backup / PITR window note for Staging project
- Owner acknowledgment stored outside Git if sensitive

### G2 — Migration preflight

- Confirm target is Staging project ref (not Production)
- Record current `profiles_status_check` definition
- Assert no unexpected drift from expected schema

### G3 — Forward apply

- Apply additive quarantine migration only
- No changes to `profiles_status_check`
- No backfill of illegal profile statuses

### G4 — Schema verification

- Table, constraints, indexes, RPCs exist
- CHECK regression: `quarantined` update on profiles fails

### G5 — RLS verification

- Direct authenticated DML denied
- RPC AuthZ positive/negative tests pass

### G6 — Exact test identities

- Use Staging certified QA fixtures only
- Classify exact rehearsal set (may be ≤8 on Staging if only N fixtures exist)
- Never use Production allowlist files against Staging or vice versa

### G7 — Dry-run

- Runner dry-run with Staging gates
- Assert planned mutations == 0

### G8 — Live reversible rehearsal

- Apply quarantine authority for rehearsal set
- Verify active rows
- Verify `profiles.status` unchanged for each target

### G9 — Auth ban rehearsal where safe

- On Staging only, apply ban duration used by ops
- Verify login blocked for banned fixture
- Document any Staging Auth limitations

### G10 — Rollback

- Release authority + unban per originals
- Verify restoration

### G11 — Reapply

- Second forward apply succeeds (fresh or same batch rules as designed)
- Confirms migration + runner idempotency story

### G12 — Idempotency

- Third apply on already-active set is no-op success

### G13 — Runtime smoke

- Directory exclusion hides quarantined QA fixtures
- Real-user fixtures remain visible
- Legal `suspended` fixture still behaves as suspended (not confused with QA quarantine)

### G14 — No unrelated mutation

- Row counts / checksums for non-target profiles unchanged (status, email, role)
- No unexpected Auth bans outside rehearsal set

### G15 — Evidence package

Sanitized reports only in Git; full artifacts in secure backup:

- preflight notes
- apply/rollback/reapply results
- masked identity lists
- hashes of Staging allowlist/snapshot used
- test output summaries

### G16 — Independent review

- Second person reviews evidence vs gates
- Confirms retired B1 GO/batch not used

### G17 — Explicit acceptance

Checklist all G1–G16 = PASS before any request for Production Owner risk decision.

## Explicit acceptance gates (summary checklist)

- [ ] Staging backup evidence recorded
- [ ] Forward migration applied on Staging
- [ ] Schema + RLS verified
- [ ] `profiles_status_check` unchanged
- [ ] Dry-run zero mutations
- [ ] Live authority apply succeeded
- [ ] Auth ban rehearsal succeeded (or waived with written reason)
- [ ] Rollback succeeded
- [ ] Reapply succeeded
- [ ] Idempotency proved
- [ ] Runtime smoke passed
- [ ] No unrelated mutations
- [ ] Evidence packaged
- [ ] Independent review passed
- [ ] **PRODUCTION_GO remains NO until doc 11 fresh authorization completes**

## Non-gates (do not confuse)

- Unit tests green alone ≠ Staging acceptance
- Historical B1 dry-run evidence ≠ B1B acceptance
- Production GO string from B1 ≠ Staging or Production authorization for B1B
