# Phase 1I-0 — Rollout Gates

**Owner authorization:** `AUTHORIZE_PHASE_1I_0_SQL_READ_MODEL_DESIGN` · **`APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES`**  
**Branch:** `feature/player-phase-1i-0-read-model-design`  
**Base `origin/main` SHA:** `bfb8980852d3c17174b3f77f17331605a5923457`  
**Classification:** Process only — no Production operation authorized now  
**Document verdict:** `READY_FOR_PHASE_1I_0_COMMIT`

---

## 1. Locked sequence (Owner)

```
1I-0  design
1I-A  facade / repository application contract
1I-B  SQL authoring and Staging apply
1I-C  list UI
1I-D  detail UI
1I-E  privacy / Staging QA
1I-F  closure and Production gate
```

**Hard rule:** Do **not** authorize **1I-B** before **1I-A**.

---

## 2. Gate map

| # | Gate | Now? | Token |
|---|------|------|-------|
| G0 | 1I-0 design approval + commit | Pending commit auth | `APPROVE_PHASE_1I_0_READ_MODEL_DESIGN_WITH_CHANGES` (done) → commit auth |
| G1 | **1I-A** app contract | After G0 commit | `AUTHORIZE_PHASE_1I_A_DIRECTORY_CONTRACT` |
| G2 | **1I-B** SQL authoring | **After G1** | `AUTHORIZE_PHASE_1I_B_SQL_AUTHORING` |
| G3 | Static SQL review | After G2 | Checklist |
| G4 | Staging apply | Separate | `AUTHORIZE_PHASE_1I_B_STAGING_APPLY` |
| G5–G6 | Staging auth + privacy-revoke QA | After UI as available | 1I-E |
| G7–G9 | Production approve / apply / smoke | 1I-F separate | Explicit tokens |
| G10 | Rollback readiness | Before G4/G8 | DROP FUNCTION plan |

---

## 3. Design exit criteria (G0) — remediated

- [x] DEFINER RPC pair  
- [x] `search_path = pg_catalog, public`  
- [x] Strict RPC fields only (no privacy_settings / raw verification)  
- [x] Server-side masking  
- [x] Avatar = identity field under publicProfileEnabled  
- [x] `EXCLUDE_SUSPENDED_ONLY` confirmed  
- [x] Opaque cursor; `INVALID_CURSOR` no first-page reset  
- [x] Sequence locks 1I-A before 1I-B  
- [ ] Docs committed (Owner commit auth)  

---

## 4. Staging QA themes (G5–G6)

- Unauthenticated denied  
- Suspended excluded  
- Privacy-off / unverified absent  
- Masked region/gender/handedness  
- No privacy_settings / raw verification in network payload  
- Invalid cursor → `INVALID_CURSOR`  
- Privacy revoke immediate  

---

## 5. Rollback

Drop RPCs (+ indexes if created). No data migration.

---

## 6. Exact Owner action next

1. Authorize **commit** of remediated 1I-0 docs.  
2. Then `AUTHORIZE_PHASE_1I_A_DIRECTORY_CONTRACT` only.  
3. Do **not** authorize 1I-B / Staging apply / Production under this step.
