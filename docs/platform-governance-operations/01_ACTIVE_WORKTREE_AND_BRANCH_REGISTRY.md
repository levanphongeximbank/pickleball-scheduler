# 01 — Active Worktree And Branch Registry

**Snapshot timestamp:** `2026-07-24T17:11:17+07:00`
**Fresh `origin/main`:** `f599f7e81ad938ea7f16b3c8b4eaa685e763bbc4`
**Subject (origin/main):** Merge pull request #224 — `feature/customer-management-phase-6-search-dedup-merge`
**Package version on tip:** `5.3.36`
**Total active worktrees:** **46** (from `git worktree list --porcelain` after `git fetch origin --prune`)
**This workstream HEAD at inventory:** `ad554affa88bde1d1fe3901224fcbe8deb096723` (5 behind / 0 ahead vs fresh `origin/main`; DIRTY only from PGO docs under allowed path)

AB = `git rev-list --left-right --count origin/main...HEAD` → **behind / ahead**.

## Phương pháp inventory

1. `git fetch origin --prune` trong worktree PGO-01.
2. Ghi `origin/main` SHA + timestamp snapshot.
3. `git worktree list --porcelain` — nguồn danh sách path.
4. Với mỗi path (read-only):
   - `git rev-parse HEAD` / `--abbrev-ref HEAD`
   - `git status --porcelain` → CLEAN / DIRTY
   - `git rev-list --left-right --count origin/main...HEAD`
   - `git diff --name-only origin/main...HEAD` lọc shared paths (`.github/**`, `scripts/ci/**`, `package.json`, lockfiles, `vercel.json`, `supabase/**`, `.env*`)
5. Không checkout root production; không cleanup; không stash; không reset worktree khác.

## Quy tắc fresh `origin/main`

- Canonical tip = **remote** `origin/main` sau fetch, không phải local `main` của root worktree.
- Root `C:/Users/Le Phong/pickleball-scheduler` trên `main` @ `a4350fda` = **97 behind / 0 ahead** — **không** dùng làm fresh main.
- Branch/worktree mới phải so sánh với SHA snapshot ghi trong tài liệu này (hoặc re-cut mới).

## Quy tắc không tự cleanup

PGO **không** được:

- `git worktree remove` / prune worktree khác
- `git clean` / `git reset` / stash trên worktree ngoài PGO-01
- Force-push, xóa branch remote, hoặc “dọn” dirty tree của module khác

Cleanup chỉ khi **Owner GO** chỉ định rõ từng path.

---

## A. Primary / governance / parallel foundations

| Path | Branch | HEAD (short) | Dirty | AB | Notes |
|------|--------|--------------|-------|----|-------|
| `C:/Users/Le Phong/pickleball-scheduler` | `main` | `a4350fda` | CLEAN | 97 / 0 | **Local main stale** |
| `.../platform-governance-operations-pgo-01-registry` | `feature/pgo-01-platform-governance-operations-registry` | `ad554aff` | DIRTY* | 5 / 0 | **This workstream** (*docs under allowed path) |
| `.../platform-governance-operations` | `feature/platform-governance-operations-foundation` | `ba920e1f` | CLEAN | 7 / 0 | Foundation placeholder |
| `.../competition-engine/competition-e2e-02-individual-pool-knockout` | `feature/competition-e2e-02-individual-pool-knockout` | `ad554aff` | DIRTY | 5 / 0 | CE module paths (not shared CI) |
| `.../customer-management` | `feature/customer-management-phase-6-search-dedup-merge` | `a6e6543e` | CLEAN | 3 / 0 | Tip merged to main as PR #224; local branch tip still behind merge commit |
| `.../ecosystem-integrations-foundation` | `feature/ecosystem-integrations-01-canonical-connector-event-foundation` | `577a376a` | CLEAN | 0 / 2 | **vs-main shared:** `scripts/ci/unit-test-files.json` |
| `.../experience-channels/experience-channels-00-foundation` | `feature/experience-channels-00-foundation` | `c88384e7` | CLEAN | 3 / 2 | **vs-main shared:** `scripts/ci/unit-test-files.json` |
| `.../communication-foundation/comms-act-02-staging-apply` | `ops/communication-foundation-comms-act-02-staging-apply` | `3f4e40b3` | DIRTY | 19 / 0 | Staging apply docs track |

> Note: worktree IA-01 không còn trong `git worktree list` tại snapshot (đã merge PR #225 trước đó). Không copy số 47 từ PGO-00.

---

## B. Competition Engine worktrees

| Path | Branch | HEAD | Dirty | AB |
|------|--------|------|-------|----|
| `.../competition-core-06-lineup-management` | `feature/competition-core-06-lineup-integration-certification` | `fb9f4824` | CLEAN | 297 / 0 |
| `.../competition-core-10-final-consolidated-implementation` | `feature/competition-core-10-final-consolidated-implementation` | `ea80bff9` | CLEAN | 155 / 0 |
| `.../competition-core-12-court-assignment` | `feature/competition-core-12-phase-1d-availability-wiring` | `b32eac13` | CLEAN | 194 / 0 |
| `.../competition-core-division-category` | `feature/competition-core-04-division-category` | `ef75562c` | CLEAN | 377 / 0 |
| `.../competition-core-participant-entry` | `feature/competition-core-02-participant-entry` | `375389a9` | CLEAN | 377 / 0 |
| `.../competition-core-rule-engine` | `feature/competition-core-01-rule-engine` | `bf0079c2` | CLEAN | 377 / 0 |
| `.../competition-core-team-roster` | `feature/competition-core-05-team-roster` | `81e668f0` | CLEAN | 353 / 0 |
| `pickleball-scheduler-cc08-standings` | `feature/competition-core-cc08-standings` | `a07a1ed1` | DIRTY | 724 / 0 |
| `pickleball-scheduler-cc09-scheduling` | `feature/competition-core-cc09-scheduling` | `c496e46d` | CLEAN | 718 / 0 |
| `pickleball-scheduler-cc10-readiness` | `feature/competition-core-cc10-readiness` | `023d94ef` | CLEAN | 700 / 3 |
| `pickleball-scheduler-cc10-stage1` | `integration/cc10-stage1-readiness` | `ac55b92c` | CLEAN | 679 / 8 |
| `pickleball-scheduler-standardization-build-fix` | `integration/cc08-standings-readiness` | `ffdd7b2c` | CLEAN | 723 / 2 |

Pending / behind trên Competition Engine **không** được coi là lỗi Platform Core.

---

## C. DIRTY worktrees (detail)

| Path | Branch | Dirty evidence (sample) | Collision class |
|------|--------|-------------------------|-----------------|
| `platform-governance-operations-pgo-01-registry` | PGO-01 | `docs/platform-governance-operations/**` | **LOW_ISOLATED** |
| `competition-e2e-02-individual-pool-knockout` | CE E2E-02 | `src/features/competition-engine/**` | LOW_ISOLATED (module) |
| `comms-act-02-staging-apply` | COMMS-ACT-02 | `?? docs/communication-foundation/activation/comms-act-02/` | MEDIUM_BOUNDARY |
| `pickleball-scheduler-athlete-hotfix` | `hotfix/my-club-members-v2-list` | Untracked Phase 42N **production** plans/scripts/evidence | MEDIUM_BOUNDARY |
| `pickleball-scheduler-club-hotfix` | `v5-platform-edition` | Untracked `.vercel.club-hotfix-wrong-project/`, prod smoke scripts | MEDIUM_BOUNDARY |
| `pickleball-scheduler-phase42l-preview` | DETACHED | Working tree dirty; branch tip also differs `package.json` vs main; earlier probe showed `M package-lock.json` | **HIGH_SHARED_COLLISION** |
| `pickleball-scheduler-cc08-standings` | CC08 | Local dirty (module/test) | LOW_ISOLATED |
| `pickleball-scheduler-integration-sync` | DETACHED | Local dirty | LOW_ISOLATED |
| `pickleball-scheduler-preview-ppr-v2` | DETACHED | Local dirty | LOW_ISOLATED |
| `pickleball-scheduler-qa-team-tournament-pilot-preparation` | QA | Local dirty | LOW_ISOLATED |
| `pickleball-scheduler-rc` | `release/team-tournament-pilot-v5.3.34` | DIRTY + vs-main `package.json` | **HIGH_SHARED_COLLISION** (package) |
| `pickleball-team-tournament` | v6 optimizer | Untracked SQL/evidence/scripts + vs-main `scripts/ci/unit-test-files.json` | **HIGH_SHARED_COLLISION** (CI manifest) |

---

## D. Shared-file collision exposure (vs `origin/main` … HEAD)

| Branch / worktree | Shared path(s) vs fresh main | Dirty WT? |
|-------------------|------------------------------|-----------|
| ECO-01 foundation | `scripts/ci/unit-test-files.json` | CLEAN |
| Experience Channels 00 | `scripts/ci/unit-test-files.json` | CLEAN |
| TT V6 `pickleball-team-tournament` | `scripts/ci/unit-test-files.json` | DIRTY |
| CC10 readiness / stage1 | `package.json` | CLEAN |
| CC08 standardization | `package.json` | CLEAN |
| TT10 / TT11 | `package.json` | CLEAN |
| phase42l-preview (DETACHED) | `package.json` (+ lockfile dirty historically) | DIRTY |
| RC TT pilot | `package.json` | DIRTY |
| referee-v5-rally / rally-merge | `.env.example`; `package.json`; `supabase/functions/_shared/refereeV5Server.mjs` | CLEAN |

Chi tiết mức HIGH/MEDIUM/LOW và approval gate: [02_SHARED_FILE_COLLISION_MAP.md](./02_SHARED_FILE_COLLISION_MAP.md).

---

## E. Detached / legacy / release / hotfix (summary)

| Path | State | AB (approx) | Role |
|------|-------|-------------|------|
| `AppData/Local/Temp/tt-v6-prod-6e08c63` | DETACHED CLEAN | 516 / 0 | Temp prod inspect |
| `pickleball-scheduler-cc04a-verify` | DETACHED CLEAN | 753 / 0 | Verify |
| `pickleball-scheduler-cc04b-verify` | DETACHED CLEAN | 752 / 0 | Verify |
| `pickleball-scheduler-p1c7-prod` | DETACHED CLEAN | 678 / 0 | Prod-related pin |
| `pickleball-scheduler-prod-deploy-a797b88` | DETACHED CLEAN | 513 / 0 | Deploy pin |
| `pickleball-scheduler-integration-sync` | DETACHED DIRTY | 693 / 0 | Legacy sync |
| `pickleball-scheduler-phase42l-preview` | DETACHED DIRTY | 771 / 1 | Preview + package drift |
| `pickleball-scheduler-preview-ppr-v2` | DETACHED DIRTY | 662 / 0 | PPR preview |
| Club / referee / TT / private-pairing / RC | Mostly CLEAN, far behind | 500–770 behind | Historical / release |

Full path set = 46 entries from `git worktree list` at snapshot.

---

## F. Owner hygiene flags

1. Root `main` @ `a4350fda` = **97 commits behind** fresh `origin/main` — không dùng làm baseline.
2. Ưu tiên worktree mới từ fresh `origin/main` (pattern PGO-01).
3. Không auto-clean worktree khác từ PGO.
4. Serialize merges đụng `scripts/ci/unit-test-files.json` (ECO / Experience / TT V6 đang expose).

## Refresh command

```powershell
git fetch origin --prune
git worktree list --porcelain
# for each path:
git -C "<path>" status --porcelain
git -C "<path>" branch --show-current
git -C "<path>" rev-parse HEAD
git -C "<path>" rev-list --left-right --count origin/main...HEAD
```
