# Notification Phase 2B — Require-Supabase Production Checklist

**For:** Owner / Operator (non-technical friendly)  
**Purpose:** Confirm every gate before any future Production SQL apply (Phase 2C).  
**Phase 2B status:** Remediation only — **do not apply SQL to Production yet.**

---

## How to use

1. Print or open this checklist.
2. Check each box only when the fact is true.
3. If any box is unchecked → **STOP** (verdict: BLOCKED).
4. Keep a dated copy with Owner name for the audit trail.

---

## A. Repository identity

- [ ] Correct repository folder: `C:\Users\Le Phong\PICK_VN-Workstreams\notification`
- [ ] Correct Git branch: `feature/notification-phase-2b-production-safety-remediation` (or the approved Phase 2C branch)
- [ ] Correct commit SHA recorded: _______________________________
- [ ] Working tree is clean (no unfinished edits)

## B. Supabase organization / project

- [ ] Correct Supabase **organization** (PICK_VN production org)
- [ ] Correct **project name** (Production — not Staging / QA)
- [ ] Correct **project reference**: `expuvcohlcjzvrrauvud`
- [ ] Confirmed **NOT** Staging ref: `qyewbxjsiiyufanzcjcq`
- [ ] Opened the Production project in Supabase dashboard (URL matches Production)

## C. Environment & safety flags

- [ ] `environment=production`
- [ ] Worker disabled (`allow_worker=false`)
- [ ] QA cleanup disabled (`allow_qa_cleanup=false`)
- [ ] External providers disabled (`external_providers_enabled=false`, `live_delivery_enabled=false`)
- [ ] Production worker enable flag is **false**
- [ ] Production rollout approval flag is **false** (until a later approved phase)

## D. Backup & rollback

- [ ] Database backup / snapshot available **before** any apply
- [ ] Rollback pack prepared: `docs/supabase-notification-phase2b-production-rollback.sql`
- [ ] Understood: default rollback **preserves** inbox/queue rows
- [ ] Understood: destructive DROP of inbox/jobs needs **extra** Owner confirmation

## E. Scripts ready

- [ ] Apply script ready (dry-run first):  
  `node scripts/apply-notification-phase2b-production-sql.mjs --dry-run`
- [ ] Verify script ready:  
  `node scripts/verify-notification-phase2b-production.mjs`
- [ ] Ops CLI ready (read-only):  
  `node scripts/notification-ops-production.mjs config-verify`

## F. Owner approval

- [ ] Owner name: _______________________________
- [ ] Owner approval date: _______________________________
- [ ] Owner confirms: **Phase 2B is remediation only** — no Production apply in this phase
- [ ] Owner confirms: Phase 2C Schema Rollout requires a **new** explicit approval

---

## Signature

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | | | |
| Operator | | | |

**If any row is blank or any checkbox unchecked → do not proceed.**
