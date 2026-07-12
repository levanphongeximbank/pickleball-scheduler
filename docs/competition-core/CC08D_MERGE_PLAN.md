# CC-08D — Merge Plan (DO NOT EXECUTE WITHOUT OWNER GO)

## Preconditions

- CC-08D verification PASS
- Build-fix PR approved
- CC-08 branch reviewed (`a07a1ed`)

## Step 1 — Merge build fix into standardization

| Item | Value |
|------|-------|
| Target | `feature/competition-core-standardization` |
| Source | `fix/standardization-referee-preview-build` |
| Commit | `88c2a29` |
| Base | `cb32ae2` |
| Expected conflicts | **None** (router-only deletion) |
| Merge type | Normal merge (no force) |

```bash
git checkout feature/competition-core-standardization
git pull origin feature/competition-core-standardization
git merge --no-ff fix/standardization-referee-preview-build -m "fix(v5): gate incomplete referee preview route"
git push origin feature/competition-core-standardization
```

Post-step SHA (expected): new merge commit on top of `cb32ae2` + `88c2a29`.

## Step 2 — Merge CC-08 into updated standardization

| Item | Value |
|------|-------|
| Target | `feature/competition-core-standardization` (after Step 1) |
| Source | `feature/competition-core-cc08-standings` |
| Commit | `a07a1ed` |
| Expected conflicts | **Low** — possible `package.json` test runner if diverged |

Likely conflict files if any:
- `package.json` (test:unit script)
- `src/features/competition-core/index.js` (unlikely if no parallel CC work)
- `src/features/competition-core/adapters/legacyAdapter.js`

```bash
git merge --no-ff feature/competition-core-cc08-standings -m "feat(competition-core): merge CC-08 standings v2 engine and shadow adapter"
git push origin feature/competition-core-standardization
```

## Step 3 — Post-merge full regression

On updated `feature/competition-core-standardization`:

```bash
npm ci
npm test
npm run build
npm run lint
node --test tests/competition-core-standings-cc08.test.js tests/competition-core-standings-cc08c.test.js
```

Acceptance: build PASS, 0 new regressions, CC-08 tests PASS.

## Future: restore referee preview route

When referee-v5 module is committed in a reviewed PR:

1. Add `src/pages/dev/RefereeV5PreviewPage.jsx` + required `src/features/referee-v5/` scoped files
2. Re-add `/dev/referee-v5` route behind `SuperAdminRouteGuard`
3. Verify build + scoped referee-v5 tests

Do **not** restore from main-worktree WIP without review.

## Order summary

```
cb32ae2 (current standardization)
  → merge 88c2a29 (build fix)
  → merge a07a1ed (CC-08)
  → post-merge regression
```

**No automatic execution.** Waiting for owner GO.
