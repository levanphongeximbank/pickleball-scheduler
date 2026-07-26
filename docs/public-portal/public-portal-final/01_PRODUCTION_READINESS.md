# PUBLIC-PORTAL-FINAL — Production Readiness (Phase A)

**Workstream:** Clubs & Courts Production Rollout & Final Closure  
**Branch:** `feature/public-portal-final-clubs-courts-production-rollout`  
**Base:** `origin/main` @ `7971a260`  
**Phase:** A — Production Readiness Audit (read-only)  
**Verdict:** `PUBLIC_PORTAL_FINAL_PRODUCTION_NO_GO_EMPTY_CATALOG`

## Owner authorization (current)

| Flag | Value |
|------|-------|
| PRODUCTION_READ_ONLY_AUDIT_GO | YES |
| PRODUCTION_MUTATION_GO | NO |
| PRODUCTION_DEPLOY_GO | NO |
| PRODUCTION_DATA_MUTATION_GO | NO |

**No SQL apply, env change, or deploy until exact message `GO PRODUCTION` — and only if hard gates PASS.**

## Hard gates

| Gate | Result |
|------|--------|
| Production target identity | PASS — `expuvcohlcjzvrrauvud` |
| Staging not active Production target | PASS — staging `qyewbxjsiiyufanzcjcq` distinct |
| SQL package security review | PASS (authored package) |
| Portal + DB rollback path | PASS (authored) |
| Deployment platform identified | PASS — Vercel |
| Public Clubs eligible ≥ 1 | **FAIL** — 0 (columns absent; deny-by-default after apply) |
| Public Courts eligible ≥ 1 | **FAIL** — 0 (`public_catalog_courts` absent) |
| Canonical publication config preventing empty cutover | **FAIL** — none on Production |

## Why NO-GO

Production has no public publication columns and no `public_catalog_courts` rows. Applying SQL alone (allowed schema only) sets `is_publicly_listed=false` by default and creates an empty projection table. This workstream **must not** create or mutate Production business/publication records. Cutting portal to `remote` would replace current local MIXED Clubs/Courts with an empty LIVE catalog.

## Scope exclusions

Tournaments, Rankings, Home, News — out of scope. No Competition Engine / router / business-logic changes.

## Root cause (fail-closed)

- Production public Clubs eligible = **0**.  
- Production public Courts eligible = **0**.  
- Cutover to `remote` now would empty Production Portal Clubs/Courts.  
- Fail-closed is mandatory; this package does not seed or mutate publication data.

## Conditions to reopen rollout

1. ≥1 Production Club canonical opt-in public.  
2. ≥1 Production Court canonical opt-in public.  
3. Privacy/DTO allowlist verified on Production.  
4. Publication uses real Production data (no synthetic leftover seed).  
5. Production rollback paths + Vercel target still valid.

## Next Owner action (not this workstream)

1. Merge NO-GO certification PR (docs/tests only).  
2. Publish ≥1 public-safe Club and ≥1 public-safe Court on Production via a separate publication workstream.  
3. Re-run Phase A audit (or resume Agent chat after publication evidence).  
4. Only then send exact `GO PRODUCTION` if hard gates PASS.
