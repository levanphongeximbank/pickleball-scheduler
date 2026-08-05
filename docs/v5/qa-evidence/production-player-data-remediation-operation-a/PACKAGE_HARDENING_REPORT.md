# Operation A Package Hardening Report

## Summary

Hardened **data-only** Production Operation A package prepared under:

`docs/v5/migrations/production-player-gender-operation-a/`

**Production GO:** NO  
**Commit:** NO  
**Push:** NO  
**SQL apply:** 0  
**Production mutations:** 0  

## Baseline

| Field | Value |
|-------|-------|
| origin/main SHA | `48c89233ef771f65fd65de0f4c2268299bad37d9` |
| Expected merge commit | `1577785ad2190b51306c98571322871ccf9c3536` |
| Merge commit ancestor | YES |
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\hard-cutover\ppdr-op-a` |
| Branch | `fix/production-player-gender-operation-a-hardening` |

## Legacy shortcomings addressed

1. Legacy forward mixed `Nam→male` update with optional `profiles` CHECK install → **separated** (CHECK = future Operation C).
2. PITR not proven → Owner must choose BLOCK or ACCEPT limited no-PITR risk (not chosen by package).
3. Backup ledger now batch-specific with original `gender` + `updated_at`.
4. Rollback refuses post-operation drift (`male` + `updated_at = applied_at` required).
5. Capture/update counts must equal exactly 4 (fail closed).
6. Updates require ledger join + `gender = 'Nam'` + `updated_at` guard.

## Package design

- Precheck SELECT-only with identity, distribution, target IDs/timestamps, ledger gate, count gate.
- Forward transactional: advisory lock, batch UUID, ledger capture, join-update, assertions, commit.
- Postcheck SELECT-only batch verification; confirms no `profiles_gender_canonical_chk`.
- Rollback batch-specific with drift refusal.
- Operation B excluded.

## Changed file inventory

### Operation A package (8)

- `docs/v5/migrations/production-player-gender-operation-a/00_README.md`
- `.../01_PRECHECK_SELECT_ONLY.sql`
- `.../02_FORWARD_DATA_ONLY.sql`
- `.../03_POSTCHECK_SELECT_ONLY.sql`
- `.../04_ROLLBACK_BY_BATCH.sql`
- `.../05_OPERATOR_RUNBOOK.md`
- `.../06_OWNER_DECISION_PACKAGE.md`
- `.../07_PACKAGE_MANIFEST.json`

### Tests (1)

- `tests/production-player-gender-operation-a-package.test.js`

### Evidence (this directory)

- `PACKAGE_HARDENING_REPORT.md` / `.json`
- `INDEPENDENT_REVIEW_REPORT.md` / `.json`

### Application runtime files changed

**0**

## Test commands and results

| Command | Result |
|---------|--------|
| `node --test tests/production-player-gender-operation-a-package.test.js` | PASS 14/14 |
| `node --test tests/production-player-data-gender-remediation.test.js` | PASS 14/14 |
| `node --test tests/player-management-phase-1b-facade.test.js` | PASS 18/18 |
| `node --test tests/tt-v6-p1_5a-showcase-setup.test.js tests/tt-v6-scope-and-classification.test.js` | PASS 16/16 |
| src gender writer guard (`gender:` / `value=` Nam\|Nữ) | PASS |
| `npm run lint:no-new` | PASS |
| `npm run build` | PASS |
| secret scan (package + test) | PASS |
| package-lock integrity | unchanged |
| cached diff | empty |

## Safety counters

| Counter | Value |
|---------|------:|
| Production mutations | 0 |
| Staging mutations | 0 |
| SQL apply | 0 |
| Migration apply | 0 |
| Quarantine/ban execution | 0 |
| Commit | NO |
| Push | NO |
| Production GO | NO |
