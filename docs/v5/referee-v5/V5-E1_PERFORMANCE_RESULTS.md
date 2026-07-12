# Referee V5-E1 — Performance Results

**Target:** p95 ≤ 2 seconds (commit → second device rendered)

**Evidence:** `docs/v5/qa-evidence/phase-v5e1/REALTIME_LATENCY_REPORT.json`

---

## Measurement

```text
Device A: apply command via UI
Device B: wait until scoreboard matches official state (no manual reload)
```

Metrics recorded:

- `medianMs`
- `p95Ms`
- `maxMs`
- `p95WithinTarget` (≤ 2000ms)

---

## Notes

- Staging sample size is small; report documents observed values.
- No subscription leak — channel removed on unmount (`removeChannel`).

---

## Verification

```powershell
node scripts/verify-referee-v5-e1-staging-closure.mjs
```
