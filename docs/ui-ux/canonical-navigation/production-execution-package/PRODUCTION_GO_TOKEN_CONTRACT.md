# Production GO Token Contract

**Program:** PICK_VN Canonical Navigation  
**Package:** Production execution package  
**Source baseline SHA:** `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b`  
**Evidence timestamp:** 2026-08-06  
**Package status:** `DRAFT_LOCAL_COMMITTED_NOT_AUTHORIZED_FOR_EXECUTION`

One generic GO does **not** imply the others. Each future YES must be an exact binding.

---

## Required tokens (all currently NO)

| Token | Current value | Meaning |
|-------|---------------|---------|
| `PRODUCTION_GO` | **NO** | Master authorization to proceed with Production activation sequence |
| `PRODUCTION_FLAG_CHANGE_GO` | **NO** | Authorization to set Production `VITE_CANONICAL_APP_SHELL_ENABLED` |
| `PRODUCTION_ENV_CHANGE_GO` | **NO** | Authorization to mutate Production environment variables |
| `PRODUCTION_REDEPLOY_GO` | **NO** | Authorization to trigger Production redeploy |
| `PRODUCTION_BROWSER_ACCEPTANCE_GO` | **NO** | Authorization to execute Production browser acceptance |
| `PRODUCTION_OPS_BINDING_GO` | **NO** | Authorization that ops bindings (owners/window/monitoring) are complete for execution |
| `PRODUCTION_FLAG_MECHANICS_GO` | **NO** | Authorization that build-time mechanics + live flag re-attestation are complete |
| `PRODUCTION_IDENTITY_COVERAGE_GO` | **NO** | Authorization that Production identity/waiver matrix is complete |

---

## Binding requirements for any future YES

Each token set to YES must bind **all** of the following:

| Binding field | Required value / source |
|---------------|-------------------------|
| Execution package digest | Exact digest of this package at GO time (currently **PENDING**) |
| Exact source SHA | Exact execution SHA (baseline `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b` unless Owner rebinds) |
| Vercel project ID | `prj_glU9Gr0zPaNoMlTcIJCAHVk5UowG` |
| Production target | Vercel Production for `pickleball-scheduler` |
| Domain | `https://pickvn.app` |
| Start time | `2026-08-07T21:00:00+07:00` (or Owner-rebound window) |
| End time | `2026-08-07T23:00:00+07:00` (or Owner-rebound window) |
| Timezone | `Asia/Ho_Chi_Minh` |
| Operator | Le Phong (or Owner-rebound operator) |
| Owner approval timestamp | Exact timestamp when Owner issues the YES |

Missing any binding field → token remains effectively unbound; treat as **NO**.

---

## Non-implication rule

- `PRODUCTION_GO=YES` does **not** imply flag, env, redeploy, or browser GOs.  
- `PRODUCTION_ENV_CHANGE_GO=YES` does **not** imply redeploy GO.  
- `PRODUCTION_REDEPLOY_GO=YES` does **not** imply browser acceptance GO.  
- `PRODUCTION_OPS_BINDING_GO=YES` does **not** imply identity coverage GO.  
- `PRODUCTION_FLAG_MECHANICS_GO=YES` does **not** imply Production GO.  
- Planning decisions (OD-PA-*) do **not** set any execution token to YES.

---

## Authoring authorization (this package only)

| Authorization | Value |
|---------------|-------|
| `EXECUTION_PACKAGE_FILE_CHANGE_GO` | YES (Owner-authorized for this authoring) |
| `EXECUTION_PACKAGE_COMMIT_GO` | YES (Owner-authorized for local commit only) |
| `EXECUTION_PACKAGE_PUSH_GO` | **NO** |
| `EXECUTION_PACKAGE_PR_GO` | **NO** |
| All Production execution tokens above | **NO** |

---

## Current contract verdict

All Production execution GO tokens remain **NO**. This package is not authorized for Production execution.
