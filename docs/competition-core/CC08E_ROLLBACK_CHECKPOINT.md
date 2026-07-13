# CC-08E — Rollback Checkpoint

## Checkpoints

| Stage | Branch | SHA |
|-------|--------|-----|
| Pre-merge standardization | `feature/competition-core-standardization` | `cb32ae2669182a81ac1cc1f41ad00f51b58b933c` |
| Post build-fix only | `integration/cc08-final-merge` | `3d16ada` (merge commit) |
| Final merged | `feature/competition-core-standardization` | (post-push HEAD) |

## Revert order (if rollback required)

### Full rollback (both merges)

```bash
git checkout feature/competition-core-standardization
git revert -m 1 <cc08-merge-commit-sha>   # Step 2
git revert -m 1 <build-fix-merge-commit-sha>  # Step 1
git push origin feature/competition-core-standardization
```

### Build-fix only rollback

```bash
git revert -m 1 <build-fix-merge-commit-sha>
git push origin feature/competition-core-standardization
```

**Effect:** Build fails again until referee preview route restored properly.

### CC-08 only rollback (keep build fix)

```bash
git revert -m 1 <cc08-merge-commit-sha>
git push origin feature/competition-core-standardization
```

**Effect:** Standings v2 removed; legacy standings unchanged; flags OFF.

## Migration rollback

**Not required** — no production migration applied.

## Feature flags

Production flags remain OFF — no env rollback required.

## Fast restore to pre-merge

```bash
git reset --hard cb32ae2   # LOCAL ONLY — do not force-push standardization without owner approval
```

For remote restore, use revert commits above (preferred).

## Preserved feature branches

Do not delete in CC-08E:

- `fix/standardization-referee-preview-build`
- `feature/competition-core-cc08-standings`
- `integration/cc08-standings-readiness`
