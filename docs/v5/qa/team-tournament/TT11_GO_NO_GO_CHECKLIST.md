# TT-11 — GO / NO-GO Checklist

**Tournament:** _______________  
**Target environment:** Staging pilot ☐ / Production pilot ☐  
**Date:** _______________  
**Owner decision:** GO ☐ / NO-GO ☐ / CONDITIONAL ☐

> Template only — do not mark GO on QA prep branch.

---

## P0 gates

| ID | Item | Owner | Evidence | Status |
|----|------|-------|----------|--------|
| G01 | Cloud source of truth | Tech | TT-1C+ shadow/cloud logs | ☐ |
| G02 | Lineup security (RPC, no direct SELECT) | Tech | RLS/RPC audit | ☐ |
| G03 | Deadline server-side enforcement | Tech | TT-2B report | ☐ |
| G04 | Version conflict handling | Tech | TT-2D concurrency report | ☐ |
| G05 | Idempotency (command log) | Tech | TT-2D idempotency cases | ☐ |
| G06 | Randomize missing lineup | QA | TT-2D randomize report | ☐ |
| G07 | Lock workflow | QA | TT-2D lock report | ☐ |
| G08 | Publish workflow | QA | TT-2D publish evidence | ☐ |
| G09 | Referee result confirm | QA | TT-5+ referee tests | ☐ |
| G10 | Forfeit handling | QA | TT-10 dry-run S11 | ☐ |
| G11 | Standings accuracy | QA | TT-7 oracle vs engine | ☐ |
| G12 | Multi-device (BTC + captain + referee) | QA | TT-9 device reports | ☐ |
| G13 | Mobile QA complete | QA | TT-9 all P0 pass | ☐ |
| G14 | Backup completed | Ops | TT11 backup checklist | ☐ |
| G15 | Rollback runbook reviewed | Ops | Sign-off | ☐ |
| G16 | Export fallback verified | QA | TT-10 S15 + CSV | ☐ |

## Conditional items

| ID | Condition | Action if fail |
|----|-----------|----------------|
| C01 | Any P0 open | NO-GO |
| C02 | P1 with workaround | GO with monitoring |
| C03 | Staging-only pilot | Production flags stay off |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product owner | | | |
| Tech lead | | | |
| QA lead | | | |
| Ops | | | |
