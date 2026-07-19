# Club Phase 2G — QA Environment Decision

| Environment | URL / source | SHA | Auth | Safe QA accounts | Safe Club fixtures | Mutations | Browser automation |
|-------------|--------------|-----|------|------------------|--------------------|-----------|--------------------|
| Local unit | Node test runner | `f6ae0ee` | N/A | Synthetic fixtures | Synthetic | Mocked | N/A |
| Local app | `npm run dev` | Branch | No `.env.local` Supabase anon credentials in workspace | Not assumed | Not assumed | **Not used** | Not run |
| Phase 2F Preview | `https://pickleball-scheduler-d5zdbv01w-pickleball-scheduler.vercel.app` | `29de3b0` | Login required | **Unavailable** | **Unavailable** | Forbidden | Not run |
| Production alias | `https://pickleball-scheduler-eight.vercel.app` | `f6ae0ee` (deploy) | Real users | **Forbidden** for PII screenshots / mutation | **Forbidden** | **Forbidden** | Public `/login` only |
| Staging Supabase | `qyewbxjsiiyufanzcjcq` (token present in local staging env file) | Unknown vs app SHA | No browser QA user provided | Not used for UI | Not used | Not used | Not run |

**Preferred order followed:** (1) repo + Phase 2F ancestry → (2) automated smoke → (3) code re-inspection of Production routes → (4) public Production/Preview login probe → authenticated live **skipped**.

**Limitation:** Authenticated visual/console certification remains **BLOCKED** without Owner-approved synthetic Staging/Preview credentials.
