# Portal Rollback Procedure (Production)

## Goal

Restore Clubs/Courts public portal source to local without leaving a partial remote cutover.

## Steps

1. Set Production env `VITE_PUBLIC_CLUBS_COURTS_SOURCE=local` (or remove the variable — code default is `local`).  
2. Redeploy canonical Production on Vercel (project `pickleball-scheduler`, alias `https://pickleball-scheduler-eight.vercel.app`).  
3. Wait until deployment state success.  
4. Smoke:
   - `https://pickleball-scheduler-eight.vercel.app/clubs`
   - `https://pickleball-scheduler-eight.vercel.app/courts`
5. Confirm pages render from local MIXED path (not empty LIVE remote).

## Notes

- Portal rollback does not require dropping DB RPCs if DB security verification PASS.  
- If DB security FAIL, also run `04_DB_ROLLBACK.md`.  
- Propagation: typically < 2 minutes on Vercel Production after success status.
