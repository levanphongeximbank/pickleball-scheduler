# Residual Worktree Classification

## Marker

`BUSINESS_MODULES_RESIDUAL_WORKTREES_CLASSIFIED`

**cleanupPerformed=false for every record.** No `CLEANED` status used.

## Categories used

- `SAFE_CLEANUP_CANDIDATE_NOT_EXECUTED`
- `DIRTY_UNSAFE_DO_NOT_DELETE`
- `UNIQUE_UNMERGED_COMMITS_DO_NOT_DELETE`
- `ACTIVE_OPEN_PR_DO_NOT_DELETE`
- `FORMALLY_PARKED`
- `RELEASE_OR_PRODUCTION_PROTECTED`
- `OUT_OF_SCOPE_PROTECTED`
- `MANUAL_REVIEW_REQUIRED`

## Register (re-verified Phase B1)

| Path | Branch | HEAD | Dirty | Dirty paths | Ancestor | Unique | Open PR | Remote | Category | Cleanup performed |
|------|--------|------|-------|-------------|----------|--------|---------|--------|----------|-------------------|
| `...\business-modules\bm-final-evidence-01` | `feature/bm-final-evidence-01-postmerge-cleanup` | `7971a260…` | CLEAN at baseline* | — | YES | 0 | none | N | active evidence lane | false |
| `...\business-modules\coaching-04-runtime-cutover` | `feature/coaching-04-runtime-cutover` | `0e76c97a…` | CLEAN | — | YES | 0 | none | Y | SAFE_CLEANUP_CANDIDATE_NOT_EXECUTED | false |
| `...\business-modules\coaching-04-staging-activation` | `feature/coaching-04-staging-activation` | `f0a69b7f…` | DIRTY | `?? scripts/coaching/_tmp-roles-probe.mjs`; `?? scripts/coaching/_tmp-verify-hashes.mjs` | YES | 0 | none | Y | DIRTY_UNSAFE_DO_NOT_DELETE | false |
| `...\business-modules\coaching-04-staging-execution` | `feature/coaching-04-staging-execution` | `fcecd79c…` | DIRTY | `?? docs/coaching-training/coaching-04/activation/OWNER_STAGING_APPLY_APPROVAL.json` | YES | 0 | none | Y | DIRTY_UNSAFE_DO_NOT_DELETE | false |
| `...\customer-management` | `feature/customer-management-phase-8-live-directory-integration` | `bad28433…` | CLEAN | — | YES | 0 | none | N | FORMALLY_PARKED | false |
| `...\business-modules\bm-final-court-01` | `feature/bm-final-court-01-runtime-persistence-authority` | `7971a260…` | **DIRTY** | many court-engine tracked/untracked (see JSON) | YES | 0 | none | N | OUT_OF_SCOPE_PROTECTED | false |
| `...\business-modules\bm-final-rating-01` | `feature/bm-final-rating-01-canonical-ssot-writer-freeze` | `7971a260…` | **DIRTY** | staged/unstaged rating SSOT files (see JSON) | YES | 0 | none | N | OUT_OF_SCOPE_PROTECTED | false |
| `pickleball-scheduler-cc08-standings` | `feature/competition-core-cc08-standings` | `a07a1ed1…` | DIRTY | `M tests/competition-core-standings-cc08c.test.js` | YES | 0 | none | Y | DIRTY_UNSAFE_DO_NOT_DELETE | false |
| `pickleball-scheduler-cc10-readiness` | `feature/competition-core-cc10-readiness` | `023d94ef…` | CLEAN | — | NO | 3 | none | Y | UNIQUE_UNMERGED_COMMITS_DO_NOT_DELETE | false |
| `pickleball-scheduler-cc10-stage1` | `integration/cc10-stage1-readiness` | `ac55b92c…` | CLEAN | — | NO | 8 | none | N | UNIQUE_UNMERGED_COMMITS_DO_NOT_DELETE | false |
| `pickleball-scheduler-qa-team-tournament-pilot-preparation` | `qa/team-tournament-pilot-preparation` | `e5126a14…` | DIRTY | fallback CSV mods | NO | 7 | **#2** | Y | ACTIVE_OPEN_PR_DO_NOT_DELETE | false |
| `pickleball-scheduler-rc` | `release/team-tournament-pilot-v5.3.34` | `559c33af…` | DIRTY | `?? docs/v5/tournament-final/` | NO | 21 | none | N | RELEASE_OR_PRODUCTION_PROTECTED | false |
| `pickleball-team-tournament` | `feature/v6-full-operation-global-optimizer` | `39657b32…` | DIRTY | many untracked ops/staging artifacts | NO | 4 | none | Y | MANUAL_REVIEW_REQUIRED | false |
| `pickleball-scheduler-pr45-private-pairing` | `feature/private-pairing-rules-v2` | `5702264c…` | CLEAN | — | NO | 1 | none | Y | MANUAL_REVIEW_REQUIRED | false |
| `pickleball-scheduler-private-pairing-release` | `release/private-pairing-coverage-28of28` | `f394a7b1…` | CLEAN | — | YES | 0 | none | Y | RELEASE_OR_PRODUCTION_PROTECTED | false |
| `pickleball-scheduler-prod-deploy-a797b88` | detached | `a797b88a…` | CLEAN | — | YES | 0 | none | N | RELEASE_OR_PRODUCTION_PROTECTED | false |
| `pickleball-scheduler-p1c7-prod` | detached | `add62869…` | CLEAN | — | YES | 0 | none | N | RELEASE_OR_PRODUCTION_PROTECTED | false |

\*Evidence lane becomes dirty only with intentional Phase B1 evidence files.

Additional merged-clean Competition Candidates remain inventoried in JSON (`cleanupPerformed=false`).

## Safety per record

`databaseWrites=0`, `ProductionTouched=NO`, `cleanupPerformed=false`.
