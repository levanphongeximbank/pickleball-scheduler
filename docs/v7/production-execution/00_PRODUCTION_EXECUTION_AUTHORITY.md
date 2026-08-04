# Production Execution Authority

Target project_ref: `expuvcohlcjzvrrauvud`

Package source commit (immutable ancestry anchor): `93b14e08ae7fa4c20886c8770b168f2495540484`

Certified package version: `phase7-canonical-production-execution-1`

Authority schema version: `2`

manifestGitBlobDigest authority: derived at execution time from git blob bytes of `approvedExecutionHead:docs/v7/production-execution/MANIFEST.sha256`

Package scope: this repository-tracked production execution package defines only the deterministic post-GO authority, preflight, ordered execution, canary, rollback, verification, and evidence boundaries for the exact Production target above.

Execution authority model (fail-closed):
- `PACKAGE_SOURCE_COMMIT` is immutable and must remain an ancestor of the approved execution head.
- `APPROVED_EXECUTION_HEAD` must be supplied by a fresh Owner GO input and must equal both `origin/main` and local `HEAD` at execution time.
- `MANIFEST_GIT_BLOB_DIGEST` is the SHA-256 of the git blob bytes at `approvedExecutionHead:docs/v7/production-execution/MANIFEST.sha256`.
- `manifestEntryVerification` must pass by validating every manifest entry hash against git blob content resolved from `approvedExecutionHead`.
- `workingTreeManifestDigest` is diagnostic only and cannot authorize execution.
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
