# Phase 7 Execution Authority Guard Remediation Report

## Root Cause
The prior model hard-coded a pre-merge baseline SHA into reusable guard files and scripts. After a merge, the new main SHA changed, causing automatic guard failure even when package evidence was correct. This created a self-invalidating loop.

## Corrected Authority Model
The remediation separates three independent authorities:
- PACKAGE_SOURCE_COMMIT: immutable ancestry anchor set to 93b14e08ae7fa4c20886c8770b168f2495540484
- APPROVED_EXECUTION_HEAD: supplied by fresh Owner GO input at execution time and must equal both origin/main and local HEAD
- PACKAGE_MANIFEST_DIGEST: certified digest that must match MANIFEST.sha256 plus full per-entry hash verification

## Implementation
- Added shared guard module: scripts/phase7-execution-authority.mjs
- Added checked-in non-authorizing template: docs/v7/production-execution/10_EXECUTION_AUTHORITY_INPUT.template.json
- Updated canonical docs to remove baseline-as-execution-head coupling.
- Updated preflight/apply/verify/warning-closure scripts to consume the same authority fields and fail closed.
- Apply script now re-runs full local guard immediately before first mutation step.

## Why The Loop Is Removed
Merging remediation updates no longer invalidates future executions by itself because approvedExecutionHead is no longer hard-coded in reusable scripts. It is injected from a fresh Owner GO authority file for each execution window.

## Guard Behavior
Before any Production access, scripts now require:
- origin/main == approvedExecutionHead
- HEAD == approvedExecutionHead
- packageSourceCommit is ancestor of approvedExecutionHead
- target project ref matches exactly
- package version and manifest digest match
- all MANIFEST entries verify
- ledger step count is 11
- clean worktree
- warning closure statuses remain CLOSED
- credential file exists, is untracked, and gitignored

## Safety Defaults
The checked-in template remains non-authorizing:
- productionGo = NO
- empty approvedExecutionHead
- empty ownerAuthorizationMarker

## Remediation Scope
This remediation is local repository change only. No Production/Staging access, no SQL apply, no deploy, no traffic or environment mutation.
