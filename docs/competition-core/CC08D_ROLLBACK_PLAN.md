# CC-08D — Rollback Plan

## If build fix must be reverted (Step 1 rollback)

```bash
git checkout feature/competition-core-standardization
git revert 88c2a29   # or revert the merge commit from Step 1
git push origin feature/competition-core-standardization
```

**Effect:** `/dev/referee-v5` route returns → build **FAILS** again until page is committed or route stays removed.

## If CC-08 merge must be reverted (Step 2 rollback)

```bash
git checkout feature/competition-core-standardization
git revert -m 1 <cc08-merge-commit-sha>
git push origin feature/competition-core-standardization
```

**Effect:** Removes standings v2 engine, adapters, tests, docs. Legacy standings unchanged. Feature flags remain OFF.

## If CC-08 branch push must be undone

CC-08 remote was force-pushed to `a07a1ed`. Previous remote was `390937f`.

```bash
# Only with explicit owner approval:
git push --force-with-lease=feature/competition-core-cc08-standings:a07a1ed origin 390937f:feature/competition-core-cc08-standings
```

**Not recommended** after CC-08C/D verification — prefer revert merge on standardization instead.

## Isolated branch cleanup

| Worktree | Branch | Action if abandoning |
|----------|--------|---------------------|
| `pickleball-scheduler-cc08-standings` | `feature/competition-core-cc08-standings` | Keep for reference |
| `pickleball-scheduler-standardization-build-fix` | `integration/cc08-standings-readiness` | Delete worktree; branch local-only |
| `fix/standardization-referee-preview-build` | pushed | Delete remote branch after merge or abandon |

## Production safety

- Feature flags production: **OFF** — rollback of code does not affect live standings
- No migration applied — DB rollback not required
- No production deploy occurred

## Rollback decision matrix

| Symptom | Rollback scope |
|---------|----------------|
| Build still fails after Step 1 | Investigate; do not proceed to Step 2 |
| CC-08 shadow parity drift in production preview | Revert Step 2 only; flags stay OFF |
| Accidental canonical-primary activation | Revert Step 2 + verify `STANDINGS_V2` env OFF |
