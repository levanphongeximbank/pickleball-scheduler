# 10 — Staging Rehearsal and Acceptance Gates

**Rule:** No Production GO before **all** gates in this document pass.  
**Staging Auth-ban rehearsal:** **MANDATORY and NON-WAIVABLE**  
**This planning package authorizes:** neither Staging apply nor Production apply.

```text
STAGING_AUTH_BAN_REHEARSAL_MANDATORY=YES
STAGING_AUTH_BAN_WAIVER_ALLOWED=NO
staging_gates.auth_ban_rehearsal=true
```

If Staging Auth-ban rehearsal cannot be performed safely or cannot be proven, the gate is **BLOCKED**. No Production GO may be issued.

## Required sequence

1. Staging backup evidence
2. Migration preflight
3. Forward apply
4. Schema verification (incl. `auth_ban_state`, immutability trigger, active-success CHECK)
5. RLS + controlled-writer verification
6. Exact disposable Staging QA identities preparation
7. Dry-run
8. Live reversible rehearsal (prepare→activate path)
9. **Mandatory Auth-ban rehearsal** (disposable Staging QA only) with independent readback
10. Explicit Boundary 3 fault-injection rehearsal **or** harness-equivalent proof on Staging-shaped environment recorded in evidence
11. Rollback (release + conditional unban)
12. Reapply
13. Idempotency proof
14. Runtime smoke (incl. anti-N+1 list read)
15. No unrelated mutation proof
16. Evidence package
17. Independent review
18. Explicit acceptance sign-off

## Gate details

### G1 — Staging backup evidence

Documented backup / PITR window note for Staging.

### G2 — Migration preflight

Confirm Staging project ref; record `profiles_status_check`; assert `quarantined` absent.

### G3 — Forward apply

Additive quarantine migration only; no `profiles_status_check` change; no illegal status backfill.

### G4 — Schema verification

- Table, constraints (incl. active-success + auth_ban_state), indexes, RPCs, immutability trigger exist
- CHECK regression: profiles `quarantined` update fails
- No `auth_ban_applied` boolean column

### G5 — RLS / writer verification

Direct authenticated DML denied; lifecycle RPC AuthZ tests pass; service_role immutable-field UPDATE denied by trigger.

### G6 — Exact disposable Staging QA identities

- Designated disposable Staging QA fixtures only
- Never Production allowlist against Staging or vice versa
- No private Production identity dumps in evidence

### G7 — Dry-run

Zero mutations.

### G8 — Live reversible rehearsal

Prepare + activate path for rehearsal set; verify fully activated rows; verify `profiles.status` unchanged.

### G9 — Auth ban rehearsal (**MANDATORY — NON-WAIVABLE**)

- Staging only; disposable QA identities only
- Execute Auth ban with ops duration
- Independent Auth readback proves ban
- Activation writer records `auth_ban_state='applied'` (or preexisting path where applicable)
- Independent authority readback proves `lifecycle_state='active'`
- Verify login blocked for banned disposable fixture
- **If this cannot be performed safely or proven → GATE BLOCKED**
- **No waiver language applies**

### G10 — Boundary 3 proof

Evidence must include deterministic Auth-ban-success / activation-failure compensation (unban + reverted/failed row + no active + GO/batch consumption rules), via Staging rehearsal or Staging-equivalent harness recorded for acceptance.

### G11 — Rollback

Release authority + unban only when `auth_ban_state='applied'` and `original_auth_banned=false`; verify restoration; retain released/failed rows (no hard delete).

### G12 — Reapply

Second forward apply under rules; proves migration + runner story.

### G13 — Idempotency

Re-apply on already-active set is no-op success.

### G14 — Runtime smoke

- Directory exclusion hides activated quarantined QA fixtures
- Real-user fixtures remain visible
- `suspended` fixture not confused with QA quarantine
- Anti-N+1: list page uses O(1) quarantine authority queries

### G15 — No unrelated mutation

Non-target profiles unchanged; no unexpected Auth bans outside rehearsal set.

### G16 — Evidence package

Sanitized reports only in Git; full artifacts in secure backup. Include Auth-ban readbacks and Boundary 3 proof references.

### G17 — Independent review

Second person reviews evidence vs gates; confirms retired B1 GO/batch unused; confirms Auth-ban rehearsal **not waived**.

### G18 — Explicit acceptance

All gates PASS before any Production Owner risk decision request. `PRODUCTION_GO` remains NO until doc 11 fresh authorization completes.

## Explicit acceptance checklist

- [ ] Staging backup evidence recorded
- [ ] Forward migration applied on Staging
- [ ] Schema + RLS + immutability verified
- [ ] `profiles_status_check` unchanged
- [ ] Dry-run zero mutations
- [ ] Live prepare/activate succeeded
- [ ] **Auth ban rehearsal succeeded with independent readback (NON-WAIVABLE)**
- [ ] Boundary 3 compensation proof recorded
- [ ] Rollback succeeded
- [ ] Reapply succeeded
- [ ] Idempotency proved
- [ ] Runtime smoke + anti-N+1 gate passed
- [ ] No unrelated mutations
- [ ] Evidence packaged
- [ ] Independent review passed
- [ ] **PRODUCTION_GO remains NO until doc 11 completes**

## Non-gates (do not confuse)

- Unit tests green alone ≠ Staging acceptance
- Historical B1 evidence ≠ B1B acceptance
- Any “waive Auth-ban rehearsal” attempt = **BLOCKED**
- Retired B1 GO/batch ≠ authorization
