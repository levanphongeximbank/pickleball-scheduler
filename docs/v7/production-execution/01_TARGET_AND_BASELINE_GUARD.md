# Target and Execution Authority Guard

Exact target project_ref: `expuvcohlcjzvrrauvud`

Immutable package source commit: `93b14e08ae7fa4c20886c8770b168f2495540484`

Execution authority input template:
- `docs/v7/production-execution/10_EXECUTION_AUTHORITY_INPUT.template.json`
- default is non-authorizing (`productionGo = NO`)

Guard requirements:
- `approvedExecutionHead` must be supplied by a fresh Owner GO input.
- `origin/main` must equal `approvedExecutionHead`.
- local `HEAD` must equal `approvedExecutionHead`.
- `packageSourceCommit` must be an ancestor of `approvedExecutionHead`.
- The execution worktree must be clean before any execution step.
- The package manifest checksum must match `MANIFEST.sha256`.
- Every execution artifact must exist in Git and be tracked.
- warning closure statuses W-P7-001 / W-P7-002 / W-P7-003 must remain CLOSED.
- credential file must exist, be untracked, and be gitignored.

Abort-before-first-mutation conditions:
- target mismatch
- missing/malformed execution authority input
- approved execution head mismatch
- package source ancestry mismatch
- clean worktree requirement not met
- package checksum mismatch
- any missing artifact
- any untracked dependency
- any hidden manual step
- any credential or secret exposure
