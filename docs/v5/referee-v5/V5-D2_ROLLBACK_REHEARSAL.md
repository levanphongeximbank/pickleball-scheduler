# V5-D.2 — Rollback Rehearsal

**Environment:** Staging (`qyewbxjsiiyufanzcjcq`)  
**Type:** Dry-run / grant verification (no data destruction)

---

## Steps verified

| Step | Action | Result |
|------|--------|--------|
| 1 | Feature flag off (`VITE_REFEREE_V5_ENABLED=false`) | Default in repo ✅ |
| 2 | Disable Edge path | Edge not deployed — N/A |
| 3 | Internal RPC grants | `authenticated` revoked on commit RPCs ✅ |
| 4 | Legacy referee tests | 9/9 PASS after migration ✅ |
| 5 | Test data retention | `REFEREE_V5_TEST_*` rows preserved for audit |

---

## Rollback SQL (not executed — reference)

From `V5-D_ROLLBACK_PLAN.md`:

- Revoke public mutation RPCs (already revoked in V5D1)
- Drop V5-D policies if re-enabling legacy-only mode
- Do **not** DELETE from `match_events`

---

## Re-enable path

1. Re-grant `service_role` on commit RPCs (already granted)
2. Deploy Edge functions
3. Set staging flag `VITE_REFEREE_V5_ENABLED=true`
4. Re-run `verify-phase-v5d2-staging.mjs`

---

## Verdict

**Rollback rehearsal: CONDITIONAL PASS** — grant + legacy regression verified; full Edge disable drill pending Edge deploy.
