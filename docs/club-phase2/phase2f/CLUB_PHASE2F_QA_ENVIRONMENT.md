# Club Phase 2F — QA Environment Decision

| Environment | URL / source | SHA | Auth | Safe QA accounts | Safe Club fixtures | Mutations allowed | Browser automation |
|-------------|--------------|-----|------|------------------|--------------------|-------------------|--------------------|
| Local unit | Node test runner | Branch WIP | N/A | Synthetic fixtures | Synthetic | Mocked | N/A |
| Local app | `npm run dev` | Branch | Dev accounts if configured | Not assumed | Not assumed | **Not used** (no customer data) | Possible locally |
| Branch Preview | None | — | — | — | — | — | **Unavailable** (no PR/deploy) |
| Staging | Existing (if any) | Unknown vs branch | Unknown | Not used this run | Not used | Not used | Not run |
| Production | Live | main @ 7a5e6b9 | Real users | **Forbidden** | **Forbidden** | **Forbidden** | Not run |

**Preferred order followed:** (1) automated tests → (2) code inspection of Production routes → Preview/Staging/Production live **skipped** per restrictions.

**Limitation:** No Preview exists because PR/deploy forbidden. Visual/live certification is **VISUAL_QA_BLOCKED**.
