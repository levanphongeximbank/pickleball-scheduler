# Target and Baseline Guard

Exact target project_ref: `expuvcohlcjzvrrauvud`

Exact baseline SHA: `bd08d448e3c207ac6d5871a734c346f6bb290c40`

Guard requirements:
- origin/main must match the exact baseline recorded above at package review time.
- The execution worktree must be clean before any execution step.
- The package manifest checksum must match `MANIFEST.sha256`.
- Every execution artifact must exist in Git and be tracked.
- Ancestry must remain intact from the evidence commit `9024b62e2c47de2de28d1de62f4e0a015b110040` to origin/main.

Abort-before-first-mutation conditions:
- target mismatch
- baseline mismatch
- clean worktree requirement not met
- package checksum mismatch
- any missing artifact
- any untracked dependency
- any hidden manual step
- any credential or secret exposure
