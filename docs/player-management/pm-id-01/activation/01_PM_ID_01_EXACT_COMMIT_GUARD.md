# PM-ID-01 — Exact-Commit Execution Guard

Apply runner must require **all** of the following before any database connection:

1. Git worktree clean (`git status --porcelain` empty).
2. Current HEAD is a full 40-character SHA (`git rev-parse HEAD`).
3. CLI `--expected-commit` is a full 40-character SHA.
4. Current HEAD === CLI `--expected-commit` (byte-for-byte equality, case-insensitive hex).
5. Owner-approved commit === current HEAD (exact equality; ancestor-only refused).
6. Target project ref exactly `qyewbxjsiiyufanzcjcq`.
7. SQL manifest hashes match on-disk LF-normalized SHA-256.
8. Explicit token exactly `PM_ID_01_OWNER_GO_APPLY_STAGING`.
9. Explicit apply mode (`--execute`).
10. Production target refused (`expuvcohlcjzvrrauvud` and any Production URL).

## Refused inputs

| Input | Result |
|-------|--------|
| Approved commit is ancestor of HEAD | `PM_ID_01_EXECUTION_COMMIT_MISMATCH_REFUSED` |
| Short SHA | refused |
| Branch name (`main`, `feature/...`) | refused |
| “latest HEAD” / “current origin/main” wording without exact SHA | refused |
| Wildcard / wrong Owner GO token | `PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED` |
| Default environment without staging | refused |
| Dirty worktree | refused |
| SQL hash drift | refused |

## Classification notes

- When Owner GO is not granted → primary verdict: `PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED`.
- When GO is present but commit equality fails → `PM_ID_01_EXECUTION_COMMIT_MISMATCH_REFUSED`.
- Evidence must record `databaseConnectionOpened=false` on any refusal path.

## Non-inheritance

A tooling commit after Owner GO does **not** inherit the prior GO. Owner must issue a new GO for the new full SHA.
