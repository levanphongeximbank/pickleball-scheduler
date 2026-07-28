# Staging Vercel Dashboard Deploy Procedure (B-STG-03)

**Workstream:** PLATFORM-HARD-CUTOVER-01  
**Purpose:** Exact dashboard-only Staging/Preview deploy + flag cutover when Vercel CLI is unavailable.  
**This document does not deploy or change flags.** Owner executes after M8 hotfix merge + fresh Staging backup + SQL apply GO.

## Exact Vercel project

| Field | Value |
|-------|-------|
| Vercel project name | `pickleball-scheduler` |
| Production alias (DO NOT change for Staging rehearsal) | `https://pickvn.app` |
| Project Production host (DO NOT redeploy for Staging rehearsal) | `https://pickleball-scheduler-eight.vercel.app` |
| GitHub repo | `levanphongeximbank/pickleball-scheduler` |

## Source SHA / branch

| Field | Value |
|-------|-------|
| Required merge tip before deploy | Owner-merged M8 text-tenant hotfix on `main` (record exact SHA after merge) |
| Deploy from | Git branch `main` (or Owner-designated Staging Preview branch tracking that SHA) |
| Environment scope | **Preview** (preferred) or dedicated Staging environment — **never Production** |

## Flags to enable (Staging / Preview only)

Set for the **Preview** (or Staging) environment only:

| Flag | Value |
|------|-------|
| `VITE_PLATFORM_HARD_CUTOVER_ENABLED` | `true` |
| `VITE_COMPETITION_REMOTE_SSOT_ENABLED` | `true` |
| `VITE_PICK_VN_RATING_V5_ENABLED` | `true` (after Rating seed readiness) |

Also ensure Preview points at Staging Supabase URL/anon key for project `qyewbxjsiiyufanzcjcq` (do not paste keys into evidence).

## Flags to keep disabled / untouched on Production

| Scope | Rule |
|-------|------|
| Production env | Leave hard-cutover + competition remote SSOT + rating V5 **unchanged / false** until separate Phase 5 GO |
| Production domain | Do not Redeploy Production; do not change Production env for this rehearsal |

## Dashboard steps (Owner)

1. Open https://vercel.com → project **pickleball-scheduler**.
2. **Settings → Environment Variables** → filter **Preview** (or Staging).
3. Add/update the three flags above for Preview only. Confirm Production column remains false/unset for those keys.
4. **Deployments** → select latest deployment built from required SHA → **Redeploy** (use existing build or trigger new Preview from `main`).
5. Open the Preview URL from the deployment card.
6. Verify:
   - Document title / app loads HTTP 200
   - Network calls hit Staging Supabase host for `qyewbxjsiiyufanzcjcq` (not Production)
   - Hard-cutover behavior active (legacy writers blocked)
7. Record evidence (no secrets): Preview URL hostname, deployment id, git SHA, flag names (not values if sensitive), timestamp.

## Rollback deployment

1. Vercel → Deployments → previous known-good Preview deployment → **Promote** / **Redeploy**.
2. Or unset the three Preview flags and Redeploy Preview.
3. Do **not** touch Production deployment or Production env vars during Staging rollback.

## Proof Production untouched

Owner checklist (tick after deploy):

- [ ] Production deployment id unchanged vs pre-rehearsal baseline  
- [ ] `https://pickvn.app` still serves prior Production SHA  
- [ ] Production env: hard-cutover / competition SSOT / rating V5 flags not modified  
- [ ] No Production Supabase SQL applied in this workstream  

## Agent restriction

Agents must **not** change Vercel flags or deploy during the M8 hotfix workstream. This file is preparation only.
