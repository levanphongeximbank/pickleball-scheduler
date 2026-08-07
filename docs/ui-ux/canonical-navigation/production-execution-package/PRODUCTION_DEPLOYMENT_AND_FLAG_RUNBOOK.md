# Production Deployment and Flag Runbook

**Program:** PICK_VN Canonical Navigation  
**Mode:** Proposed sequence only — **do not execute** any step until exact GO bindings are present  
**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED`  
**Vercel project:** `pickleball-scheduler` (`prj_glU9Gr0zPaNoMlTcIJCAHVk5UowG`)  
**Production domain:** `https://pickvn.app`  
**Source baseline SHA:** `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b`  
**Deployment operator:** Le Phong  
**Owner approval authority:** Le Phong  
**Execution window:** `2026-08-07T21:00:00+07:00` – `2026-08-07T23:00:00+07:00` (`Asia/Ho_Chi_Minh`)  
**Merge freeze:** **YES**

---

## Flag mechanics (must acknowledge)

| Fact | Binding |
|------|---------|
| Vite flag is build-time | **YES** — evaluated via `import.meta.env` and baked into the bundle |
| Redeploy is required | **YES** — after Production flag change |
| Environment change alone is insufficient | **YES** — setting the env var without Production redeploy does not activate the shell |
| Automatic deployment from `main` merges | Must **not** be mistaken for activation authorization (OBS-P5-PM-01) |
| No step may run before exact GO binding | **YES** — each step below requires the listed GO(s) |

Current mechanics GO: `PRODUCTION_FLAG_MECHANICS_GO=NO` (live re-attestation still PENDING).

---

## Proposed sequence (NOT EXECUTED)

| Step | Action | Required before step | Capture |
|------|--------|----------------------|---------|
| 1 | Verify execution package digest | Package frozen; digest computed | Package digest |
| 2 | Verify exact source SHA | Matches GO-bound SHA (baseline `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b` or Owner-updated final execution SHA) | Final execution SHA |
| 3 | Confirm Vercel project and Production target | Project ID `prj_glU9Gr0zPaNoMlTcIJCAHVk5UowG`; Production target for `pickleball-scheduler`; domain `https://pickvn.app` | Confirmation record |
| 4 | Re-attest Production flag state | Live Vercel read; expect ABSENT/OFF | Final live flag re-attestation |
| 5 | Confirm merge freeze | `MERGE_FREEZE=YES` in force for window | Freeze attestation |
| 6 | Confirm all GO tokens | Every required token YES and bound to digest/SHA/project/target/domain/window/operator/Owner timestamp | GO binding record |
| 7 | Set Production flag to TRUE | `PRODUCTION_GO=YES` + `PRODUCTION_FLAG_CHANGE_GO=YES` + `PRODUCTION_ENV_CHANGE_GO=YES` | Flag change evidence |
| 8 | Trigger Production redeploy | `PRODUCTION_REDEPLOY_GO=YES` | Deployment ID + deployment SHA |
| 9 | Capture deployment ID and SHA | After deploy succeeds | Deployment ID; deployment SHA |
| 10 | Verify Production domain points to intended deployment | Domain `https://pickvn.app` serves captured deployment | Domain→deployment proof |
| 11 | Start browser acceptance | `PRODUCTION_BROWSER_ACCEPTANCE_GO=YES` | Acceptance start timestamp |

---

## STOP conditions before / during sequence

- Any required GO token is NO or unbound  
- Package digest missing or mismatched  
- Source SHA mismatched  
- Wrong Vercel project or target  
- Live flag attestation unexpected (already TRUE when expecting ABSENT/OFF)  
- Merge freeze violated / uncontrolled `main` Production deploy  
- Redeploy fails or wrong SHA baked  
- Domain does not point to intended deployment  

On STOP: do not proceed to the next step; escalate to Owner approval authority (Le Phong).

---

## Current authorization state (authoring close)

| Token | Value |
|-------|-------|
| `PRODUCTION_GO` | **NO** |
| `PRODUCTION_FLAG_CHANGE_GO` | **NO** |
| `PRODUCTION_ENV_CHANGE_GO` | **NO** |
| `PRODUCTION_REDEPLOY_GO` | **NO** |
| `PRODUCTION_BROWSER_ACCEPTANCE_GO` | **NO** |
| `PRODUCTION_OPS_BINDING_GO` | **NO** |
| `PRODUCTION_FLAG_MECHANICS_GO` | **NO** |
| `PRODUCTION_IDENTITY_COVERAGE_GO` | **NO** |
| `PRODUCTION_IDENTITY_COVERAGE_PLANNING_GO` | **YES** |
| `IDENTITY_CREATION_GO` | **NO** |

**Production flag changes executed by this authoring:** **0**  
**Environment changes executed by this authoring:** **0**  
**Deployments initiated by this authoring:** **0**

---

## Explicit non-execution

This runbook documents the proposed sequence only. Do not set the Production flag. Do not change Vercel environment variables. Do not redeploy. Do not start browser acceptance.
