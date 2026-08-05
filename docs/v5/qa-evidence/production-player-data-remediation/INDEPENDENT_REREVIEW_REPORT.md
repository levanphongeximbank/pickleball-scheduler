# Production Player Data Remediation — Independent Re-Review

**Timestamp:** 2026-08-05T08:35:00.000Z (UTC)  
**Verdict:** `PRODUCTION_PLAYER_DATA_REMEDIATION_REVIEW_PASS_READY_FOR_COMMIT`  
**Review mode:** Independent re-review only (no implementation changes)

## Pre-flight

| Field | Value |
|-------|--------|
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\hard-cutover\production-player-data-remediation` |
| Branch | `fix/production-player-data-cleanliness-and-gender-normalization` |
| Current HEAD | `e53694174b92c31f6dfd5725ab3e74ea3cc13e29` |
| origin/main SHA | `e53694174b92c31f6dfd5725ab3e74ea3cc13e29` |
| Staged files | 0 |
| package.json / lockfiles | unchanged |
| Production mutations | 0 |
| SQL apply | 0 |
| Deployments | 0 |
| Quarantine/ban execution | 0 |
| Commit | NO |
| Push | NO |
| Production GO | NO |

## Diff inventory

| Metric | Count |
|--------|------:|
| Modified tracked | 22 |
| Untracked paths | 21 |
| Files changed (mod+untracked paths) | 43 |
| Staged | 0 |
| Unrelated | 0 |

### Classification
- **Implementation:** player gender helpers, QuickAdd, picker, seeds, filters, adapters, engines, Players page, preview fixtures
- **Test:** account-only-athlete, models, demo seed, production-player-data-gender-remediation
- **Prepared unapplied migration:** `docs/v5/migrations/PRODUCTION_PLAYER_GENDER_*`, quarantine plan SQL
- **Audit/evidence:** `docs/v5/qa-evidence/production-player-data-remediation/*`
- **Manifest:** `TEST_IDENTITY_MANIFEST.json`
- **Script/tooling:** audit harness, prod-smoke-identity-hygiene, smoke script wiring

No package/lockfile, credential, env, or secret file changes.

## Independent answers (Q1–Q20)

| # | Required | Independent finding |
|---|----------|---------------------|
| 1 QuickAdd persist Nam/Nữ/Khác/blank/unknown? | NO | **NO** — maps via `getPlayerGenderKey` then `normalizePlayer`; blank/unknown → null |
| 2 QuickAdd values male\|female\|other\|null? | YES | **YES** — form MenuItems + builder |
| 3 Save path uses getPlayerGenderKey? | YES | **YES** — `buildTournamentQuickAddPlayer` only save path |
| 4 normalizePlayer replaces gender? | YES | **YES** — `gender: genderKey` not legacy retain |
| 5 phase1b-smith@gmail.com false? | YES | **YES** — independently evaluated `false` |
| 6 Domain + local-part required? | YES | **YES** — only pickleball-scheduler.qa / prod-qa.local |
| 7 Name/prefix/ID alone hide real domain? | NO | **NO** |
| 8 Fetch Auth + validate email before ban? | YES | **YES** — `getUserById` on default path; callers do not pass emailOverrides |
| 9 Auth ID alone authorize ban? | NO | **NO** |
| 10 Bad emails abort before mutation? | YES | **YES** |
| 11 Rejected cases zero mutations? | YES | **YES** — test + code continue before writers |
| 12 Dry-run zero mutations? | YES | **YES** |
| 13 resolveAthleteGender canonical? | YES | **YES** — returns male/female/null |
| 14 VN labels via display helper tests? | YES | **YES** |
| 15 Female counters see female? | YES | **YES** — spot femaleCount=2 |
| 16 Guard scans src tree? | YES | **YES** — walkSourceFiles(src) |
| 17 Active Nam/Nữ/Khác writers = 0? | YES | **YES** — grep + guard PASS |
| 18 Legacy only presentation/compat/migration? | YES | **YES** |
| 19 Migrations prepared unapplied? | YES | **YES** — DO NOT APPLY headers; applied:false |
| 20 Expected 4 Nam→male undocumented as executed? | YES | **YES** — MIGRATION_PLAN expected 4, NOT APPLIED |

## Blocker-by-blocker

1. QuickAdd/normalizePlayer writer — **CLOSED**
2. QA filter breadth — **CLOSED** (`phase1b-smith@gmail.com` = false)
3. Auth ban email gate — **CLOSED**
4. account-only-athlete expectations — **CLOSED** (12/12)

## Warning-by-warning

1. Picker panel — canonical values — **CLOSED**
2. pairingInterventionPreviewData — canonical — **CLOSED**
3. Guard fixed-list — replaced by src walk — **CLOSED**
4. Evidence account-only suite — present — **CLOSED**

Residual note (not high-risk): `emailOverrides` exists for harness injection; Production smoke callers do not pass it and still require `getUserById` + `isCertifiedQaEmail`.

## Validation (independently executed)

| Check | Result |
|-------|--------|
| Focused gender remediation | 14 pass / 0 fail |
| Focused bundle | 46 pass / 0 fail |
| QuickAdd writer (in remediation suite) | PASS |
| account-only-athlete | 12 pass / 0 fail |
| Tournament female-related | 16 pass / 0 fail |
| QA filter tests | PASS |
| Smoke hygiene dry-run | PASS |
| Gender writer guard | PASS |
| lint:no-new | PASS |
| build | PASS (`✓ built in 4.05s`) |
| git diff check | PASS (22 tracked, scoped) |
| git cached diff | PASS (0 staged) |
| secret scan | PASS (0 hits) |
| package/lockfile changed | NO |

## Safety counters

- Production mutations = 0
- SQL apply = 0
- Deployments = 0
- Quarantine or ban execution = 0
- Commit = NO
- Push = NO
- Production GO = NO

## Final git status (at review)

```
## fix/production-player-data-cleanliness-and-gender-normalization...origin/main
 M (22 tracked files as listed in pre-flight)
?? docs/v5/migrations/
?? docs/v5/qa-evidence/production-player-data-remediation/
?? scripts/audit-production-player-data-readonly.mjs
?? scripts/lib/prod-smoke-identity-hygiene.mjs
?? src/components/tournament/buildTournamentQuickAddPlayer.js
?? src/features/player/utils/qaTestIdentityFilter.js
?? tests/production-player-data-gender-remediation.test.js
```

**INDEPENDENT_REVIEW_VERDICT:** `PRODUCTION_PLAYER_DATA_REMEDIATION_REVIEW_PASS_READY_FOR_COMMIT`
