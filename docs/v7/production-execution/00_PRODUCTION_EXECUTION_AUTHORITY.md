# Production Execution Authority

Target project_ref: `expuvcohlcjzvrrauvud`

Baseline SHA: `bd08d448e3c207ac6d5871a734c346f6bb290c40`

Package scope: this repository-tracked production execution package defines only the deterministic post-GO authority, preflight, ordered execution, canary, rollback, verification, and evidence boundaries for the exact Production target above.

Authority boundary:
- This package is not itself Production authorization.
- This package may be reviewed, hashed, and validated locally.
- This package may not be executed against Production until Owner issues a new exact GO bound to the merged package manifest SHA256, exact execution window, and exact target.
- Any prior Owner GO is stale and non-transferable once this package is materially changed or newly tracked.
- Codex and repository docs cannot imply, extend, or reuse Owner authorization.

Automatic rejection conditions:
- target mismatch
- baseline mismatch
- package checksum mismatch
- untracked or missing artifact
- hidden manual step
- unresolved dependency
- production/staging mutation outside the exact ordered package
- secret exposure
- stale or reused Owner GO
- any instruction not bound to the exact manifest and target

No implicit authorization exists in these documents.
