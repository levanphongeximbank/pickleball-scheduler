# Owner GO Checkpoint

Execution is prohibited until the Owner issues a new GO bound to:
- authoritySchemaVersion = 2
- exact approvedExecutionHead (must equal local HEAD and origin/main)
- packageSourceCommit ancestry anchor (`93b14e08ae7fa4c20886c8770b168f2495540484`)
- exact manifestGitBlobDigest (SHA-256 of git blob bytes at approvedExecutionHead for `docs/v7/production-execution/MANIFEST.sha256`)
- manifestEntryVerification pass over all manifest artifacts resolved from approvedExecutionHead
- exact target project_ref
- exact package version
- exact execution window

Execution authority input for this checkpoint must be provided via:
- `docs/v7/production-execution/10_EXECUTION_AUTHORITY_INPUT.template.json` shape
- local, gitignored execution authority file for the exact execution window

Default checked-in template state: `productionGo = NO`

The prior Owner GO is stale and non-transferable for any materially changed or newly tracked package.
