# Production Rollback and Monitoring Runbook

**Program:** PICK_VN Canonical Navigation  
**Mode:** Runbook only — **do not execute** these steps in this authoring  
**Flag:** `VITE_CANONICAL_APP_SHELL_ENABLED` (Vite build-time; OFF/remove + redeploy restores legacy)  
**Production domain:** `https://pickvn.app`  
**Vercel project ID:** `prj_glU9Gr0zPaNoMlTcIJCAHVk5UowG`  
**Source baseline SHA:** `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b`

---

## Owner bindings

| Role | Owner |
|------|--------|
| Rollback owner | Le Phong |
| Monitoring owner | Le Phong |
| Evidence recorder | Le Phong |
| Deployment operator | Le Phong |
| Owner approval authority | Le Phong |

| Operations field | Bound value |
|------------------|-------------|
| Timezone | `Asia/Ho_Chi_Minh` |
| Execution window | `2026-08-07T21:00:00+07:00` – `2026-08-07T23:00:00+07:00` |
| Maximum decision time | **10** minutes |
| Monitoring interval | **5** minutes |
| Monitoring duration | **60** minutes |
| Merge freeze | **YES** |

---

## Rollback triggers

Declare rollback if any threshold is met. Decision must be made within **10** minutes of detection.

| Trigger | Threshold |
|---------|-----------|
| White screen | **> 0** |
| Auth redirect loop | **≥ 1** |
| Public route outage | **≥ 1** |
| Privilege bypass | **≥ 1** |
| Wrong-tenant exposure | **≥ 1** |
| Critical navigation route failure | **≥ 1** |

---

## Monitoring procedure (NOT EXECUTED)

1. Start monitoring immediately after activation browser smoke begins (or after deployment verification if smoke deferred by Owner).  
2. Every **5** minutes for **60** minutes: shell exclusivity spot-check; white-screen check; public route spot-check; note any auth/privilege anomalies.  
3. Watch for uncontrolled Production deploys under merge freeze (OBS-P5-PM-01).  
4. Evidence recorder captures timestamps, deployment ID, SHA, flag state, and screenshots.  
5. On any trigger: enter rollback sequence within maximum decision time.

---

## Rollback sequence (NOT EXECUTED)

| Step | Action | Owner |
|------|--------|-------|
| 1 | Stop acceptance | Deployment operator / Evidence recorder |
| 2 | Record trigger evidence | Evidence recorder |
| 3 | Set Production flag OFF or remove it | Rollback owner (requires env GO if not already emergency-authorized) |
| 4 | Redeploy Production | Rollback owner / Deployment operator |
| 5 | Verify legacy shell (`legacy-app-shell` present; canonical absent) | Rollback owner |
| 6 | Run public and authenticated smoke | Rollback owner / Evidence recorder |
| 7 | Monitor rollback state | Monitoring owner |
| 8 | Record closure verdict | Evidence recorder / Owner approval authority |

### Rollback verification cells

- RB-01 through RB-06 as defined in [`PRODUCTION_BROWSER_ACCEPTANCE_RUNBOOK.md`](./PRODUCTION_BROWSER_ACCEPTANCE_RUNBOOK.md)

### Notes

- Flag-only rollback does **not** require SQL, route deletions, or runtime code revert.  
- Environment change alone is insufficient — Production redeploy is required to bake OFF/absent.  
- Secondary code-revert path is out of normal flag rollback and requires separate Owner GO.

---

## Closure verdict placeholders

| Field | Status |
|-------|--------|
| Rollback triggered? | **PENDING** (not executed) |
| Trigger code(s) | **PENDING** |
| Rollback deployment ID | **PENDING** |
| Rollback deployment SHA | **PENDING** |
| Closure verdict | **PENDING** |

---

## Explicit non-execution

No monitoring window started. No rollback performed. No Production flag/env/deploy mutation by this authoring.
