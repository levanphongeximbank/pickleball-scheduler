# Target and Baseline Guard

Exact target project_ref: `expuvcohlcjzvrrauvud`

Exact baseline SHA: `fe80e367e848da7c4448b8a40b5a0641014ce37b`

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
