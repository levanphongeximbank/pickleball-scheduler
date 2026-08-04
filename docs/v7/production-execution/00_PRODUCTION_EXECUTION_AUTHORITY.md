# Production Execution Authority

Target project_ref: `expuvcohlcjzvrrauvud`

Package source commit (immutable ancestry anchor): `93b14e08ae7fa4c20886c8770b168f2495540484`

Certified package version: `phase7-canonical-production-execution-1`

Certified package manifest digest: `CD19CBF6205C601A573A8F5D2A81568F4FA8A7C2BA0D389B02A02C987A1F7E67`

Package scope: this repository-tracked production execution package defines only the deterministic post-GO authority, preflight, ordered execution, canary, rollback, verification, and evidence boundaries for the exact Production target above.

Execution authority model (fail-closed):
- `PACKAGE_SOURCE_COMMIT` is immutable and must remain an ancestor of the approved execution head.
- `APPROVED_EXECUTION_HEAD` must be supplied by a fresh Owner GO input and must equal both `origin/main` and local `HEAD` at execution time.
- `PACKAGE_MANIFEST_DIGEST` must match the certified digest and all manifest entry hashes must verify.
- Checked-in template authority remains `Production GO = NO` by default.

Authority boundary:
- This package is not itself Production authorization.
- This package may be reviewed, hashed, and validated locally.
- This package may not be executed against Production until Owner issues a new exact GO bound to the approved execution head, package source commit ancestry, merged package manifest SHA256, exact execution window, and exact target.
- Any prior Owner GO is stale and non-transferable once this package is materially changed or newly tracked.
- Codex and repository docs cannot imply, extend, or reuse Owner authorization.

Automatic rejection conditions:
- target mismatch
- approved execution head mismatch
- package source ancestry mismatch
- package checksum mismatch
- untracked or missing artifact
- hidden manual step
- unresolved dependency
- production/staging mutation outside the exact ordered package
- secret exposure
- stale or reused Owner GO
- any instruction not bound to the exact manifest and target

No implicit authorization exists in these documents.
