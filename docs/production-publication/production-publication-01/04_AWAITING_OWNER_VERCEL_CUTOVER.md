# PRODUCTION-PUBLICATION-01 — Owner Vercel Cutover Instructions

**Marker:** `PRODUCTION_PUBLICATION_01_AWAITING_OWNER_VERCEL_CUTOVER`  
**Database publication:** PASS (Club + 4 Courts live via RPC)  
**Agent Vercel credentials:** NONE — Owner must cut over via Dashboard

---

## Exact Dashboard steps

1. Open **Vercel Dashboard** → project **`pickleball-scheduler`**
2. Confirm Production domain: `https://pickleball-scheduler-eight.vercel.app`
3. Go to **Settings → Environment Variables**
4. Scope: **Production** only (do not change Preview/Development)
5. Variable:

| Field | Value |
|-------|-------|
| Key | `VITE_PUBLIC_CLUBS_COURTS_SOURCE` |
| Current | unset / absent (code default = `local`) |
| New | `remote` |

6. Save the env var
7. Go to **Deployments** → latest Production deployment → **⋯ → Redeploy**  
   (or trigger a new Production deployment so the build picks up the env)
8. Wait until the new Production deployment is Ready

---

## After cutover

Reply exactly:

```text
VERCEL CUTOVER COMPLETED
```

Agent will then: verify deployment, smoke `/clubs` + `/courts`, LIVE provenance, ACCC + Sân 3–6, no mock fallback, fail-closed, regressions, full unit, lint, foundation-lock, build, evidence, commit, push, open PR, stop before merge.

---

## Portal rollback (if needed)

1. Set `VITE_PUBLIC_CLUBS_COURTS_SOURCE` = `local` (or delete the variable)
2. Redeploy Production
3. Verify `/clubs` and `/courts` recover on local MIXED path

## Publication data rollback (DB; fingerprint-guarded)

- Restore ACCC club public fields to unlisted/null
- DELETE only the four projection IDs `...-n3` … `...-n6`
- Do **not** delete `club_data_v3` / Club / Venue / cluster
